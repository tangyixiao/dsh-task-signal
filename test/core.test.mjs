import test from 'node:test'
import assert from 'node:assert/strict'
import { createClassifier, defaults, normalize, inQuietHours } from '../lib/core.js'
const session = { id: 'parent', header: { origin: 'user' } }
const event = (type, data, time = 10000) => ({ type, data, time })
test('only true completion; cancellation, tool results and unknown events are silent', () => {
  const c = createClassifier(), s = defaults()
  for (const kind of ['aborted', 'interrupted', 'blocked', 'forked', 'max-tokens']) assert.equal(c.event(session, event('turn/end', { turn: kind, reason: { kind } }), s), null)
  assert.equal(c.event(session, event('tool/result', { turn: 0 }), s), null)
  assert.equal(c.event(session, event('new/event', {}), s), null)
  assert.equal(c.event(session, event('turn/end', { turn: 1, reason: { kind: 'completed' } }), s).kind, 'done')
})
test('deduplicates turn and question identities without suppressing independent sessions', () => {
  const c = createClassifier(), s = normalize({ events: { question: { enabled: true } } })
  const end = event('turn/end', { turn: 1, reason: { kind: 'completed' } })
  assert.ok(c.event(session, end, s)); assert.equal(c.event(session, end, s), null)
  assert.ok(c.event({ id: 'other' }, end, s))
  const question = event('tool/call', { name: 'ask_user_question', callId: 'q' })
  assert.ok(c.event(session, question, s)); assert.equal(c.event(session, question, s), null)
})
test('subagents opt in; thresholds require an observed start and do not delay questions', () => {
  const c = createClassifier(), s = normalize({ minDurationSeconds: 10, events: { question: { enabled: true } } })
  const child = { id: 'child', header: { origin: 'subagent' } }
  assert.equal(c.event(child, event('turn/end', { turn: 1, reason: { kind: 'completed' } }), s), null)
  assert.equal(c.event(session, event('turn/end', { turn: 1, reason: { kind: 'completed' } }), s), null)
  c.event(session, event('turn/start', { turn: 2 }, 1000), s)
  assert.equal(c.event(session, event('turn/end', { turn: 2, reason: { kind: 'completed' } }, 9000), s), null)
  c.event(session, event('turn/start', { turn: 3 }, 1000), s)
  assert.equal(c.event(session, event('turn/end', { turn: 3, reason: { kind: 'completed' } }, 12000), s).durationMs, 11000)
  assert.equal(c.event(session, event('tool/call', { name: 'ask_user_question', callId: 'q' }), s).kind, 'question')
  assert.ok(c.event(child, event('turn/end', { turn: 2, reason: { kind: 'completed' } }), normalize({ subagents: true })))
})
test('settings patches retain siblings and clamp malformed fields', () => {
  const next = normalize({ volume: Infinity, events: { done: { sound: '__proto__' }, error: { enabled: true } }, quietHours: { start: '25:00' } })
  assert.equal(next.volume, 0.55); assert.equal(next.events.done.sound, 'codex'); assert.equal(next.events.error.enabled, true)
  assert.equal(next.quietHours.start, '23:00')
  assert.equal(normalize({ volume: -1 }).volume, 0)
})
test('quiet hours cross midnight with inclusive start and exclusive end', () => {
  const s = normalize({ quietHours: { enabled: true, start: '23:00', end: '07:00' } })
  assert.ok(inQuietHours(s, new Date(2026, 10, 15, 23, 0)))
  assert.ok(inQuietHours(s, new Date(2026, 10, 16, 6, 59)))
  assert.equal(inQuietHours(s, new Date(2026, 10, 16, 7, 0)), false)
})
