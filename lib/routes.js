import { validateWav } from './audio.js'
export const BASE = '/dsh-task-signal'
function loopback(host) {
  if (typeof host !== 'string') return false
  try { const url = new URL('http://' + host); return ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && url.username === '' && url.password === '' } catch { return false }
}
export function refusal(req, connection) {
  if (!loopback(req.headers.host)) return 403
  if (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])) return 403
  if (req.headers.origin) {
    try { const o = new URL(req.headers.origin); if (!['http:', 'https:'].includes(o.protocol) || o.host !== req.headers.host) return 403 } catch { return 403 }
  }
  if (!connection) return 401
  try { const admission = connection.admit(req); return 'rejection' in admission ? admission.rejection : admission.peer?.principal?.kind === 'owner' ? null : 403 } catch { return 401 }
}
function json(res, code, body) {
  const bytes = Buffer.from(JSON.stringify(body))
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': bytes.length, 'X-Content-Type-Options': 'nosniff' })
  res.end(bytes)
}
async function body(req, limit) {
  const chunks = []; let size = 0
  for await (const chunk of req) { size += chunk.length; if (size > limit) throw Object.assign(new Error('Request too large'), { status: 413 }); chunks.push(chunk) }
  return Buffer.concat(chunks)
}
export function createHandler(service, getConnection) {
  return async (req, res) => {
    try {
      const denied = refusal(req, getConnection())
      if (denied) { json(res, denied, { error: 'Unauthorized request' }); return }
      const pathname = new URL(req.url, 'http://localhost').pathname
      const method = req.method, route = pathname.slice(BASE.length)
      if (method === 'GET' && route === '/status') { json(res, 200, service.status()); return }
      if (method === 'GET' && ['/presets/codex.wav', '/presets/zcode.wav'].includes(route)) {
        const bytes = service.store.preset(route.includes('/codex.') ? 'codex' : 'zcode')
        if (!bytes) { json(res, 404, { error: 'Local preset not imported' }); return }
        validateWav(bytes)
        res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(bytes); return
      }
      if (method === 'GET' && route === '/custom.wav') {
        const bytes = service.store.custom()
        if (!bytes) { json(res, 404, { error: 'No custom WAV uploaded' }); return }
        res.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(bytes); return
      }
      if (method === 'DELETE' && route === '/custom.wav') {
        const events = Object.fromEntries(Object.entries(service.store.settings.events).filter(([, e]) => e.sound === 'custom').map(([kind]) => [kind, { sound: 'codex' }]))
        service.store.update({ events }); service.store.deleteCustom(); json(res, 200, { ok: true }); return
      }
      if (method === 'PUT' && route === '/custom.wav') {
        const bytes = await body(req, 2 * 1024 * 1024); validateWav(bytes); service.store.setCustom(bytes); json(res, 200, { ok: true }); return
      }
      if (method !== 'POST' || !['/settings', '/presence', '/claim', '/mute', '/preview'].includes(route)) { json(res, 405, { error: 'Method or route unavailable' }); return }
      if (!req.headers['content-type']?.startsWith('application/json')) { json(res, 415, { error: 'Expected JSON' }); return }
      const raw = JSON.parse((await body(req, 16384)).toString('utf8'))
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Expected object')
      if (route === '/settings') { json(res, 200, { settings: service.store.update(raw) }); return }
      if (route === '/presence') { service.presence(raw.id, raw.focused); json(res, 200, { ok: true }); return }
      if (route === '/claim') { json(res, 200, { event: service.claim(raw.seq) }); return }
      if (route === '/mute') { json(res, 200, { muted: service.mute(raw.muted) }); return }
      if (route === '/preview') { const result = await service.preview(raw.sound); json(res, result.ok ? 200 : 503, result); return }
    } catch (error) {
      if (!res.headersSent) json(res, error.status ?? (error.code ? 500 : 400), { error: error.code ? 'Cannot access local settings or audio' : error.message })
      else res.end()
    }
  }
}
