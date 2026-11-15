import os from 'node:os'
import path from 'node:path'
import { createStore } from './store.js'
import { createService } from './service.js'
import { BASE, createHandler } from './routes.js'

export const name = 'dsh-task-signal'
export const inject = []
export function apply(ctx) {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  const store = createStore(path.join(home, 'dsh-task-signal'))
  // Only an ACTIVE whale entry counts. An old settings file is not activation evidence.
  const whaleEnabled = () => {
    const loader = ctx.get('loader')
    try { return [...loader.entries()].some(e => /(?:^|\/)dsh-whale-widget(?:\/|$)/.test(String(e.options?.name ?? '')) && e.fiber?.state === 2) } catch { return false }
  }
  const service = createService(store, { home, whaleEnabled })
  ctx.effect(() => () => service.dispose())
  const root = ctx.root ?? ctx
  // Documented session/event is synchronous; listener never returns a playback promise.
  ctx.effect(() => root.on('session/event', (session, event) => { try { service.onEvent(session, event) } catch (e) { ctx.logger?.warn?.('Task Signal could not process an event') } }))
  ctx.effect(() => root.on('session/disposed', session => service.sessionDisposed(session)))
  ctx.inject(['webServer', 'connection'], scoped => {
    const dispose = scoped.webServer.register({ kind: 'prefix', path: BASE, handler: createHandler(service, () => scoped.get('connection')) })
    return dispose
  })
  ctx.logger?.info?.('Task Signal 0.1.0 ready (completion sounds enabled)')
}
