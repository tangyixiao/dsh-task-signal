import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createClassifier, inQuietHours, SOUNDS } from './core.js'
import { createPlayer, makeWav, scaleWav } from './audio.js'

export function createService(store, { player = createPlayer(), now = Date.now, home = '', whaleEnabled = () => false } = {}) {
  const classifier = createClassifier(), epoch = randomUUID(), clients = new Map()
  const outbox = [], claims = new Map()
  let sequence = 0, lastAt = -Infinity, muted = false, disposed = false, busy = false
  let lastPlayback = { ok: null }, lastSuppression = null
  function nativePlay(sound, volume) {
    if (busy) return Promise.resolve({ ok: false, error: 'Playback already active' })
    busy = true
    return Promise.resolve().then(() => {
      const custom = sound === 'custom' ? store.custom() : store.preset(sound)
      if (sound === 'custom' && !custom) throw new Error('Upload a custom WAV first')
      return player.play(store.writePlayback(custom ? scaleWav(custom, volume) : makeWav(sound, volume)))
    }).catch(() => ({ ok: false, error: 'Cannot prepare audio; upload a valid WAV or select a built-in sound' }))
      .then(result => { lastPlayback = { ...result, at: now() }; return result })
      .finally(() => { busy = false; store.cleanupPlayback() })
  }
  function whaleHandles(kind) {
    if (!home || !whaleEnabled()) return false
    try {
      const data = JSON.parse(fs.readFileSync(path.join(home, '.dshw-usage.json'), 'utf8'))
      return kind === 'done' ? data.settings?.taskEnd?.on === true : data.settings?.events?.[kind]?.soundOn === true
    } catch { return false }
  }
  const suppress = reason => { lastSuppression = reason; return null }
  const api = {
    store,
    status() { return { epoch, seq: sequence, settings: store.settings, muted, custom: !!store.custom(), presets: {codex: !!store.preset('codex'), zcode: !!store.preset('zcode')}, warning: store.warning,
      lastPlayback, lastSuppression, nativePlatform: process.platform, events: [...outbox], version: '0.1.2' } },
    presence(id, focused) {
      if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error('Invalid client id')
      clients.set(id, { at: now(), focused: focused === true })
      for (const [key, value] of clients) if (now() - value.at > 15000) clients.delete(key)
      if (clients.size > 32) clients.delete(clients.keys().next().value)
    },
    claim(seq) { // HTTP handler executes this synchronously: one client owns each browser delivery.
      const event = outbox.find(e => e.seq === seq)
      if (!event || now() - event.at > 15000 || claims.has(seq)) return null
      claims.set(seq, true)
      return event
    },
    mute(value) { muted = value === true; return muted },
    async preview(sound) {
      if (!Object.hasOwn(SOUNDS, sound) && sound !== 'custom') throw new Error('Unknown sound')
      return nativePlay(sound, store.settings.volume)
    },
    onEvent(session, event) {
      if (disposed) return null
      const settings = store.settings, at = now()
      const classified = classifier.event(session, event, settings, at)
      if (!classified) return null
      if (muted) return suppress('muted')
      if (inQuietHours(settings, new Date(at))) return suppress('quiet-hours')
      if (settings.backgroundOnly && [...clients.values()].some(c => at - c.at < 15000 && c.focused)) return suppress('foreground')
      if (settings.respectWhale && whaleHandles(classified.kind)) return suppress('whale')
      if (at - lastAt < settings.cooldownMs) return suppress('cooldown')
      lastAt = at; lastSuppression = null
      const item = { ...classified, seq: ++sequence, sound: settings.events[classified.kind].sound,
        output: settings.output, volume: settings.volume, notifications: settings.notifications,
        speech: settings.speech && classified.kind === 'done', speechText: settings.speechText }
      outbox.push(item)
      if (outbox.length > 64) { const removed = outbox.shift(); claims.delete(removed.seq) }
      if (item.output === 'native' && item.volume > 0) void nativePlay(item.sound, item.volume)
      return item
    },
    sessionDisposed(session) { classifier.dispose(session) },
    dispose() { disposed = true; player.dispose(); clients.clear(); claims.clear(); outbox.length = 0; store.cleanupPlayback() },
  }
  return api
}
