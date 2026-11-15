import { spawn } from 'node:child_process'
import { SOUNDS } from './core.js'

/** Original sine tones, shared with browser playback; no third-party audio assets. */
export function makeWav(sound = 'chime', volume = 0.55) {
  const notes = SOUNDS[sound]?.notes
  if (!notes) throw new Error('Unknown built-in sound')
  const rate = 22050, count = Math.ceil(Math.max(...notes.map(([, at, duration]) => at + duration)) * rate)
  const out = Buffer.alloc(44 + count * 2)
  out.write('RIFF'); out.writeUInt32LE(out.length - 8, 4); out.write('WAVEfmt ', 8)
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22)
  out.writeUInt32LE(rate, 24); out.writeUInt32LE(rate * 2, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34)
  out.write('data', 36); out.writeUInt32LE(count * 2, 40)
  for (let i = 0; i < count; i++) {
    let v = 0
    for (const [hz, at, duration] of notes) {
      const t = i / rate - at
      if (t >= 0 && t < duration) v += Math.sin(2 * Math.PI * hz * t) * Math.min(1, t / 0.008) * Math.pow(1 - t / duration, 2)
    }
    out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * volume * 0.45)) * 32767), 44 + i * 2)
  }
  return out
}
/** Strict, bounded PCM WAV, supported by Windows SoundPlayer and browsers. */
export function validateWav(bytes) {
  if (bytes.length < 44 || bytes.length > 2 * 1024 * 1024 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Use a PCM WAV file, up to 2 MiB and 8 seconds')
  if (bytes.readUInt32LE(4) + 8 !== bytes.length) throw new Error('Invalid WAV length')
  let format, data
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const size = bytes.readUInt32LE(offset + 4), end = offset + 8 + size
    if (end > bytes.length) throw new Error('Invalid WAV chunk')
    const name = bytes.toString('ascii', offset, offset + 4)
    if (name === 'fmt ') { if (size < 16) throw new Error('Invalid WAV format'); format = offset + 8 }
    if (name === 'data') data = { offset: offset + 8, size }
    offset = end + (size % 2)
  }
  if (!format || !data || bytes.readUInt16LE(format) !== 1 || bytes.readUInt16LE(format + 14) !== 16) throw new Error('Use 16-bit PCM WAV')
  const channels = bytes.readUInt16LE(format + 2), rate = bytes.readUInt32LE(format + 4)
  if (![1, 2].includes(channels) || rate < 8000 || rate > 48000 || bytes.readUInt16LE(format + 12) !== channels * 2 || bytes.readUInt32LE(format + 8) !== rate * channels * 2 || data.size % (channels * 2) || data.size === 0 || data.size / (rate * channels * 2) > 8) throw new Error('WAV must be mono/stereo, 8–48 kHz, at most 8 seconds')
  return data
}
export function scaleWav(bytes, volume) {
  const data = validateWav(bytes), out = Buffer.from(bytes)
  for (let p = data.offset; p < data.offset + data.size; p += 2) out.writeInt16LE(Math.round(out.readInt16LE(p) * volume), p)
  return out
}
export function playerCommand(file, platform = process.platform) {
  if (platform === 'win32') {
    // Fixed script; file is passed through the environment, never interpolated as code.
    const code = "$ErrorActionPreference='Stop';$p=New-Object System.Media.SoundPlayer;$p.SoundLocation=$env:DSH_TASK_SIGNAL_WAV;$p.Load();$p.PlaySync();$p.Dispose()"
    return { command: 'powershell.exe', args: ['-NoLogo', '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', Buffer.from(code, 'utf16le').toString('base64')], env: { ...process.env, DSH_TASK_SIGNAL_WAV: file } }
  }
  return { command: platform === 'darwin' ? 'afplay' : 'aplay', args: platform === 'darwin' ? [file] : ['-q', file], env: process.env }
}
export function createPlayer() {
  let active, disposed = false
  return {
    async play(file) {
      if (disposed) return { ok: false, error: 'Player disposed' }
      if (active) return { ok: false, error: 'Playback already active' }
      const spec = playerCommand(file)
      return new Promise(resolve => {
        const child = spawn(spec.command, spec.args, { env: spec.env, windowsHide: true, stdio: 'ignore', shell: false })
        active = child
        let settled = false
        const finish = result => { if (settled) return; settled = true; clearTimeout(timer); if (active === child) active = undefined; resolve(result) }
        const timer = setTimeout(() => { child.kill(); finish({ ok: false, error: 'Playback timed out' }) }, 12000)
        child.once('error', error => finish({ ok: false, error: error.code === 'ENOENT' ? 'Native player unavailable; select browser playback' : 'Native playback failed' }))
        child.once('close', code => finish(code === 0 ? { ok: true } : { ok: false, error: 'Native playback failed' }))
      })
    },
    dispose() { disposed = true; active?.kill() },
  }
}
