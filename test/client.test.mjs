import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { defaults } from '../lib/core.js'
test('client factory mounts settings and mute slots, ignores initial history, cleans up', async () => {
  const timers = new Set(), disposers = [], slots = [], elements = [], calls = []
  let exported, registered = false
  const state = { epoch: 'epoch', seq: 3, settings: defaults(), events: [{ seq: 3, at: Date.now(), kind: 'done', output: 'browser' }], lastPlayback: {} }
  const React = { createElement: (type, props, ...children) => ({ type, props, children }), useState: initial => [initial, () => {}], useEffect: () => {} }
  const doc = { hidden: false, hasFocus: () => false, addEventListener() {}, removeEventListener() {}, head: { appendChild: e => elements.push(e) }, createElement: () => ({ remove() {} }) }
  const window = { __ModuleLoader__: { load: module => { exported = module.factory(() => React) } }, addEventListener() {}, removeEventListener() {} }
  const sandbox = { window, document: doc, crypto: { randomUUID: () => 'client' }, console, AbortSignal, Date,
    setTimeout: fn => { timers.add(fn); return fn }, clearTimeout: fn => timers.delete(fn),
    fetch: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => structuredClone(state) } } }
  vm.runInNewContext(fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), sandbox)
  const ctx = { locale: { bind: () => key => key, register: () => { registered = true; return () => {} } }, effect: fn => { const off = fn(); if (typeof off === 'function') disposers.push(off) },
    slots: { inject: (name, fn) => fn(), register: (options, component) => { slots.push({ options, component }); return () => {} } } }
  exported.apply(ctx)
  await new Promise(resolve => setImmediate(resolve))
  assert.ok(registered)
  assert.ok(slots.some(x => x.options.name === 'plugins.bundle.config' && x.options.key === 'dsh-task-signal'))
  assert.ok(slots.some(x => x.options.name === 'conversation.input.left'))
  const panel = slots.find(x => x.options.name === 'plugins.bundle.config').component({ view: 'page' })
  const rendered = panel.type()
  assert.equal(rendered.type, 'section')
  assert.equal(calls.some(x => x.url.endsWith('/claim')), false, 'initial event history must not be claimed')
  for (const dispose of disposers.reverse()) dispose()
  assert.equal(timers.size, 0)
})
