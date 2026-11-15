import fs from 'node:fs'
import path from 'node:path'
import { normalize } from './core.js'

export function createStore(dir) {
  const file = path.join(dir, 'settings.json')
  let settings, warning = null
  try { settings = normalize(JSON.parse(fs.readFileSync(file, 'utf8'))) }
  catch (e) { settings = normalize(null); if (e.code !== 'ENOENT') warning = 'Settings unreadable; using defaults. Save to repair.' }
  function atomic(target, bytes) {
    fs.mkdirSync(dir, { recursive: true })
    const temp = target + '.' + process.pid + '.tmp'
    try { fs.writeFileSync(temp, bytes, { mode: 0o600 }); fs.renameSync(temp, target) }
    finally { try { fs.unlinkSync(temp) } catch {} }
  }
  return {
    dir, get settings() { return structuredClone(settings) }, get warning() { return warning },
    update(raw) { const next = normalize(raw, settings); atomic(file, JSON.stringify(next, null, 2) + '\n'); settings = next; warning = null; return this.settings },
    custom() { try { return fs.readFileSync(path.join(dir, 'custom.wav')) } catch { return null } },
    preset(name) { if (!['codex', 'zcode'].includes(name)) return null; try { return fs.readFileSync(path.join(dir, name + '.wav')) } catch { return null } },
    setPreset(name, bytes) { if (!['codex', 'zcode'].includes(name)) throw new Error('Unknown preset'); atomic(path.join(dir, name + '.wav'), bytes) },
    setCustom(bytes) { atomic(path.join(dir, 'custom.wav'), bytes) },
    deleteCustom() { try { fs.unlinkSync(path.join(dir, 'custom.wav')) } catch (e) { if (e.code !== 'ENOENT') throw e } },
    writePlayback(bytes) { const file = path.join(dir, 'playback.wav'); atomic(file, bytes); return file },
    cleanupPlayback() { try { fs.unlinkSync(path.join(dir, 'playback.wav')) } catch {} },
  }
}
