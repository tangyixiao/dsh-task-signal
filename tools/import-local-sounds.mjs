/** Optional personal-use import. No application audio ships in the plugin tarball. */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { createStore } from '../lib/store.js'
import { validateWav } from '../lib/audio.js'
const args = process.argv.slice(2), options = {}
for (let i = 0; i < args.length; i += 2) { if (!['--home', '--codex', '--zcode-asar', '--ffmpeg'].includes(args[i]) || !args[i + 1]) throw new Error('Use --codex WAV and/or --zcode-asar ASAR --ffmpeg EXE; optional --home DSH_HOME'); options[args[i]] = args[i + 1] }
const dir = path.join(options['--home'] || process.env.DSH_HOME || path.join(os.homedir(), '.dsh'), 'dsh-task-signal')
const store = createStore(dir), imported = []
if (options['--codex']) { const bytes = fs.readFileSync(options['--codex']); validateWav(bytes); store.setPreset('codex', bytes); imported.push('codex') }
if (options['--zcode-asar']) {
  if (!options['--ffmpeg']) throw new Error('Provide an existing ffmpeg executable; this tool never downloads one')
  const fd = fs.openSync(options['--zcode-asar'], 'r'), head = Buffer.alloc(16)
  let bytes
  try {
    fs.readSync(fd, head, 0, 16, 0)
    const length = head.readUInt32LE(12)
    if (length < 2 || length > 32 * 1024 * 1024) throw new Error('Invalid ASAR header')
    const header = Buffer.alloc(length); fs.readSync(fd, header, 0, length, 16)
    const tree = JSON.parse(header.toString('utf8')), matches = []
    function walk(files) { for (const [name, entry] of Object.entries(files)) { if (entry.files) walk(entry.files); else if (/^task-notification-pop[-\w]*\.mp3$/.test(name)) matches.push(entry) } }
    walk(tree.files)
    if (matches.length !== 1 || matches[0].unpacked) throw new Error('Expected one packed ZCode task notification sound')
    const entry = matches[0], offset = Number(entry.offset), size = Number(entry.size)
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(size) || size < 1 || size > 1024 * 1024) throw new Error('Invalid sound entry')
    bytes = Buffer.alloc(size)
    if (fs.readSync(fd, bytes, 0, size, 8 + head.readUInt32LE(4) + offset) !== size) throw new Error('Incomplete audio entry')
  } finally { fs.closeSync(fd) }
  fs.mkdirSync(dir, { recursive: true })
  const input = path.join(dir, `import-${process.pid}.mp3`), output = path.join(dir, `import-${process.pid}.wav`)
  try {
    fs.writeFileSync(input, bytes)
    execFileSync(options['--ffmpeg'], ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-t', '8', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', output], { windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 })
    const wav = fs.readFileSync(output); validateWav(wav); store.setPreset('zcode', wav); imported.push('zcode')
  } finally { for (const file of [input, output]) try { fs.unlinkSync(file) } catch {} }
}
if (!imported.length) throw new Error('Specify at least one application sound source')
console.log(JSON.stringify({ imported, directory: dir, redistributed: false }))
