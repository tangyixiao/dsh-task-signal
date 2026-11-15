import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { createStore } from '../lib/store.js'
import { createService } from '../lib/service.js'
import { createHandler, refusal, BASE } from '../lib/routes.js'
import { makeWav, validateWav, scaleWav, playerCommand } from '../lib/audio.js'
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-signal-test-'))
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }))
  const store = createStore(dir), played = []
  let at = new Date(2026, 10, 15, 12, 0).getTime()
  const service = createService(store, { now: () => at, player: { play: async file => { played.push(fs.readFileSync(file)); return { ok: true } }, dispose() {} } })
  t.after(() => service.dispose())
  return { dir, store, service, played, advance: ms => { at += ms } }
}
const session = { id: 's', header: { origin: 'user' } }
const end = turn => ({ type: 'turn/end', data: { turn, reason: { kind: 'completed' } } })
test('host-persisted settings survive restart, malformed settings degrade, custom files are bounded', t => {
  const { dir, store } = fixture(t)
  store.update({ volume: 0.23, events: { approval: { enabled: true } } })
  assert.equal(createStore(dir).settings.volume, 0.23)
  assert.equal(createStore(dir).settings.events.approval.enabled, true)
  fs.writeFileSync(path.join(dir, 'settings.json'), '{broken')
  assert.ok(createStore(dir).warning)
  const wav = makeWav(); assert.ok(validateWav(wav)); store.setCustom(wav); assert.deepEqual(store.custom(), wav)
  assert.throws(() => validateWav(Buffer.from('not audio')))
  const bad = Buffer.from(wav); bad.writeUInt32LE(0xffffffff, 40); assert.throws(() => validateWav(bad))
  assert.ok(scaleWav(wav, 0).subarray(44).every(v => v === 0))
})
test('foreground gating expires, cooldown merges bursts, mute resets with service', async t => {
  const { store, service, advance, played } = fixture(t)
  store.update({ backgroundOnly: true, output: 'native' })
  service.presence('client', true)
  assert.equal(service.onEvent(session, end(1)), null)
  advance(16000)
  assert.ok(service.onEvent(session, end(2)))
  assert.equal(service.onEvent(session, end(3)), null)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(played.length, 1)
  advance(1000); service.mute(true)
  assert.equal(service.onEvent(session, end(4)), null)
})
test('browser claim is exactly once across pages and old deliveries expire', t => {
  const { store, service, advance } = fixture(t)
  store.update({ output: 'browser' })
  const first = service.onEvent(session, end(1))
  assert.ok(service.claim(first.seq)); assert.equal(service.claim(first.seq), null)
  advance(1000); const second = service.onEvent(session, end(2)); advance(16000)
  assert.equal(service.claim(second.seq), null)
})
test('HTTP rejects foreign origins, DNS rebinding and non-owner principals', () => {
  const owner = { admit: () => ({ peer: { principal: { kind: 'owner' } } }) }
  const req = { headers: { host: '127.0.0.1:8520', origin: 'http://127.0.0.1:8520' } }
  assert.equal(refusal(req, owner), null)
  assert.equal(refusal({ headers: { ...req.headers, origin: 'https://evil.example' } }, owner), 403)
  assert.equal(refusal({ headers: { host: 'evil.example:8520' } }, owner), 403)
  assert.equal(refusal(req, undefined), 401)
  assert.equal(refusal(req, { admit: () => ({ peer: { principal: { kind: 'guest' } } }) }), 403)
})
test('real HTTP route validates auth, JSON, upload limits, and saves settings', async t => {
  const { service } = fixture(t)
  const handler = createHandler(service, () => ({ admit: req => req.headers['x-test-owner'] === 'yes' ? { peer: { principal: { kind: 'owner' } } } : { rejection: 401 } }))
  const server = http.createServer(handler)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const base = 'http://127.0.0.1:' + server.address().port + BASE
  assert.equal((await fetch(base + '/status')).status, 401)
  const headers = { 'x-test-owner': 'yes', 'content-type': 'application/json' }
  const saved = await fetch(base + '/settings', { method: 'POST', headers, body: JSON.stringify({ volume: 0.2 }) })
  assert.equal(saved.status, 200); assert.equal((await saved.json()).settings.volume, 0.2)
  assert.equal((await fetch(base + '/settings', { method: 'POST', headers, body: '[]' })).status, 400)
  assert.equal((await fetch(base + '/custom.wav', { method: 'PUT', headers, body: makeWav() })).status, 200)
  assert.equal((await fetch(base + '/custom.wav', { method: 'PUT', headers, body: Buffer.alloc(2 * 1024 * 1024 + 1) })).status, 413)
})
test('Windows command uses hidden process and environment data, not path interpolation', () => {
  const maliciousLookingPath = "D:/audio/it's $(calc).wav"
  const spec = playerCommand(maliciousLookingPath, 'win32')
  const code = Buffer.from(spec.args.at(-1), 'base64').toString('utf16le')
  assert.equal(spec.env.DSH_TASK_SIGNAL_WAV, maliciousLookingPath)
  assert.ok(!code.includes(maliciousLookingPath)); assert.ok(spec.args.includes('Hidden'))
})
test('Codex is the default; imported application presets work without redistribution', async t => {
  const { store, service, played } = fixture(t)
  assert.equal(store.settings.events.done.sound, 'codex')
  store.setPreset('codex', makeWav('ding', 1))
  store.setPreset('zcode', makeWav('knock', 1))
  assert.deepEqual(service.status().presets, { codex: true, zcode: true })
  const result = await service.preview('codex')
  assert.equal(result.ok, true); assert.ok(played[0].length > 44)
  assert.throws(() => store.setPreset('../outside', Buffer.from('x')))
  assert.equal(store.preset('../outside'), null)
})
