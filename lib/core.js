export const KINDS = ['done', 'question', 'approval', 'error']
export const SOUNDS = {
  codex: { zh: 'Codex 风格（默认）', en: 'Codex style (default)', notes: [[783.99, 0, 0.17], [1046.5, 0.12, 0.3]] },
  zcode: { zh: 'ZCode 风格', en: 'ZCode style', notes: [[659.25, 0, 0.1], [880, 0.11, 0.14], [659.25, 0.26, 0.18]] },
  chime: { zh: '清脆叮咚', en: 'Chime', notes: [[880, 0, 0.15], [1174.66, 0.16, 0.24]] },
  ding: { zh: '轻响', en: 'Ding', notes: [[1046.5, 0, 0.28]] },
  bell: { zh: '柔和铃声', en: 'Soft bell', notes: [[659.25, 0, 0.4], [987.77, 0.12, 0.38]] },
  music: { zh: '上行旋律', en: 'Rising melody', notes: [[523.25, 0, 0.16], [659.25, 0.16, 0.16], [783.99, 0.32, 0.3]] },
  knock: { zh: '两声叩门', en: 'Knock', notes: [[392, 0, 0.1], [392, 0.2, 0.14]] },
  alert: { zh: '低音警示', en: 'Alert', notes: [[440, 0, 0.16], [329.63, 0.18, 0.25]] },
}
export function defaults(platform = process.platform) {
  return { enabled: true, output: platform === 'win32' ? 'native' : 'browser', volume: 0.55,
    backgroundOnly: false, minDurationSeconds: 0, subagents: false, cooldownMs: 900,
    notifications: false, speech: false, speechText: '任务完成了', respectWhale: true,
    quietHours: { enabled: false, start: '23:00', end: '07:00' },
    events: { done: { enabled: true, sound: 'codex' }, question: { enabled: false, sound: 'music' },
      approval: { enabled: false, sound: 'knock' }, error: { enabled: false, sound: 'alert' } } }
}
const finite = (v, fallback, min, max) => typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
export function normalize(raw, base = defaults()) {
  const out = structuredClone(base)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const k of ['enabled', 'backgroundOnly', 'subagents', 'notifications', 'speech', 'respectWhale']) {
    if (typeof raw[k] === 'boolean') out[k] = raw[k]
  }
  if (['native', 'browser'].includes(raw.output)) out.output = raw.output
  out.volume = finite(raw.volume, out.volume, 0, 1)
  out.minDurationSeconds = finite(raw.minDurationSeconds, out.minDurationSeconds, 0, 86400)
  out.cooldownMs = finite(raw.cooldownMs, out.cooldownMs, 0, 10000)
  if (typeof raw.speechText === 'string') out.speechText = raw.speechText.trim().slice(0, 120) || '任务完成了'
  for (const k of KINDS) {
    const e = raw.events?.[k]
    if (typeof e?.enabled === 'boolean') out.events[k].enabled = e.enabled
    if (e?.sound === 'custom' || Object.hasOwn(SOUNDS, e?.sound)) out.events[k].sound = e.sound
  }
  if (typeof raw.quietHours?.enabled === 'boolean') out.quietHours.enabled = raw.quietHours.enabled
  for (const k of ['start', 'end']) if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(raw.quietHours?.[k])) out.quietHours[k] = raw.quietHours[k]
  return out
}
export function inQuietHours(settings, date = new Date()) {
  const q = settings.quietHours
  if (!q.enabled || q.start === q.end) return false
  const time = String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0')
  return q.start < q.end ? time >= q.start && time < q.end : time >= q.start || time < q.end
}
/** Only durable events emitted AFTER activation; never scans old logs or running flags.
 * https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/agent-lifecycle.md
 */
export function createClassifier() {
  const starts = new Map(), seen = new Map()
  const boundedSet = (map, key, value) => { map.set(key, value); if (map.size > 2048) map.delete(map.keys().next().value) }
  return {
    dispose(session) { const id = session?.id ?? session?.header?.id; for (const key of starts.keys()) if (key.startsWith(id + ':')) starts.delete(key) },
    event(session, event, settings, now = Date.now()) {
      const sid = session?.id ?? session?.header?.id
      if (typeof sid !== 'string' || !event || !event.data) return null
      const data = event.data, turn = data.turn
      const key = sid + ':' + String(turn ?? '')
      if (event.type === 'turn/start') { boundedSet(starts, key, Number(event.time) || now); return null }
      let kind, identity
      if (event.type === 'turn/end') {
        kind = data.reason?.kind === 'completed' ? 'done' : data.reason?.kind === 'error' ? 'error' : null
        identity = 'end:' + key
      } else if (event.type === 'tool/call' && data.name === 'ask_user_question') {
        kind = 'question'; identity = 'question:' + sid + ':' + String(data.callId ?? event.seq ?? event.time)
      } else if (event.type === 'approval/asked') {
        kind = 'approval'; identity = 'approval:' + sid + ':' + String(data.id ?? event.seq ?? event.time)
      }
      const start = starts.get(key)
      if (event.type === 'turn/end') starts.delete(key)
      if (!kind || seen.has(identity)) return null
      boundedSet(seen, identity, true)
      if (!settings.enabled || !settings.events[kind].enabled) return null
      const subagent = session.header?.origin === 'subagent' || session.header?.origin?.kind === 'subagent'
      if (subagent && !settings.subagents) return null
      const durationMs = start === undefined ? null : Math.max(0, (Number(event.time) || now) - start)
      if (kind === 'done' && settings.minDurationSeconds > 0 && (durationMs === null || durationMs < settings.minDurationSeconds * 1000)) return null
      return { kind, sessionId: sid, subagent, durationMs, at: now }
    },
  }
}
