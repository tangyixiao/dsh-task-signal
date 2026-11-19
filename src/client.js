const React = require('react')
const h = React.createElement
const SOUNDS = __SOUNDS__
const BASE = '/dsh-task-signal'
const ZH = { title: '任务提示音', intro: '任务跑完，响一声。默认只提醒主任务完成。', enabled: '启用提醒', output: '播放位置', native: '宿主系统（后台可靠播放）', browser: '当前页面（需先点击试听）', volume: '提示音量', done: '任务完成', question: '需要回答', approval: '等待授权', error: '运行出错', preview: '试听', custom: '自定义 WAV', subagents: '子代理完成也提醒', background: '仅在 DSH 不在前台时提醒', threshold: '完成提醒最短时长（秒，0 表示每次）', cooldown: '连续提醒最小间隔（毫秒）', notify: '同时显示系统通知', speech: '完成时语音播报（当前页面）', transcript: '播报文稿', quiet: '免打扰时段（宿主本地时间）', start: '开始', end: '结束', whale: '已启用的小鲸鱼发声时让开，避免重复', upload: '上传音效', uploadHelp: '16 位 PCM WAV，单声道或双声道，8–48 kHz；最多 2 MiB、8 秒。音频保存在宿主，不上传到外网。', remove: '删除自定义音效', save: '保存设置', saved: '设置已保存', loading: '正在连接…', mute: '临时静音', unmute: '恢复提醒', status: '播放状态', ready: '已就绪', unlock: '请点击试听以允许页面播放声音', nativeOk: '上次系统播放进程已完成；实际音量取决于系统设备', configured: '自定义音效已上传', nativeHelp: 'Windows 使用系统自带播放器。页面关闭后仍可发声，但 DSH 宿主必须保持运行。macOS/Linux 原生播放尚需设备验证。', browserHelp: '页面必须保持打开，先点一次试听。后台页面可能被浏览器限制。', notifDenied: '系统通知权限未授予；声音设置仍可使用。', quietHelp: '开始和结束相同时不限制。任务时长阈值只影响完成提醒。', deliveryHelp: '每个回合只提醒一次；同一宿主的多个页面通过领取机制避免重复。自行停止、页面刷新和旧会话不触发完成音。', settings: '打开任务提示音设置', noFile: '请选择 WAV 文件', muteHelp: '临时静音会在 DSH 宿主重启后恢复。语音播报与通知需要页面保持打开。' }
const EN = { title: 'Task Signal', intro: 'A short sound when work finishes. Main-task completion only by default.', enabled: 'Enable alerts', output: 'Play audio on', native: 'Host system (background playback)', browser: 'This page (preview first)', volume: 'Volume', done: 'Task completed', question: 'Answer needed', approval: 'Approval needed', error: 'Run failed', preview: 'Preview', custom: 'Custom WAV', subagents: 'Include subagents', background: 'Only when DSH is in the background', threshold: 'Minimum completion duration (seconds; 0 = every turn)', cooldown: 'Minimum interval between alerts (ms)', notify: 'Also show system notifications', speech: 'Speak on completion (this page)', transcript: 'Spoken transcript', quiet: 'Quiet hours (host local time)', start: 'From', end: 'Until', whale: 'Yield when an enabled whale widget already plays this event', upload: 'Upload sound', uploadHelp: '16-bit PCM WAV, mono/stereo, 8–48 kHz; up to 2 MiB and 8 seconds. Stored on the host; no external upload.', remove: 'Remove custom sound', save: 'Save settings', saved: 'Settings saved', loading: 'Connecting…', mute: 'Mute temporarily', unmute: 'Unmute alerts', status: 'Playback status', ready: 'Ready', unlock: 'Preview once to allow page audio', nativeOk: 'Last native playback process completed; audibility depends on the system device', configured: 'Custom WAV uploaded', nativeHelp: 'Windows uses its built-in player. Sound continues without an open page while the DSH host runs. macOS/Linux native playback still needs device validation.', browserHelp: 'Keep the page open and preview once. Background tabs may be restricted by the browser.', notifDenied: 'Notification permission was not granted; sound remains available.', quietHelp: 'Equal start/end disables the time restriction. Duration threshold applies only to completion.', deliveryHelp: 'One alert per turn; host claims prevent duplicate browser delivery. Cancelled turns, refreshes and old sessions stay quiet.', settings: 'Open Task Signal settings', noFile: 'Select a WAV file', muteHelp: 'Temporary mute resets when the DSH host restarts. Speech and notifications require an open page.' }
exports.name = 'dsh-task-signal-client'
exports.inject = ['slots', 'locale']
exports.apply = function apply(ctx) {
  let stopped = false, timer, epoch, seq, state, error = '', soundContext, currentAudio, audioTimer
  let cleanupAudio = () => {}
  const subscribers = new Set(), id = crypto.randomUUID()
  const t = ctx.locale.bind('task-signal')
  ctx.effect(() => ctx.locale.register('task-signal', { zh: ZH, en: EN }))
  function emit() { for (const fn of subscribers) fn() }
  function report(e) { error = String(e?.message || e); emit() }
  async function request(route, payload, method = 'POST') {
    const response = await fetch(BASE + route, { method, credentials: 'same-origin', cache: 'no-store',
      signal: AbortSignal.timeout(16000), headers: payload === undefined ? {} : { 'Content-Type': 'application/json' }, body: payload === undefined ? undefined : JSON.stringify(payload) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'HTTP ' + response.status)
    return data
  }
  function unlock() {
    try {
      if (!soundContext) soundContext = new (window.AudioContext || window.webkitAudioContext)()
      if (soundContext.state === 'suspended') void soundContext.resume().catch(report)
    } catch (e) { report(e) }
  }
  async function play(sound, volume) {
    if (volume <= 0) return
    if (sound === 'custom' || state?.presets?.[sound]) {
      const audioPath = sound === 'custom' ? '/custom.wav' : '/presets/' + sound + '.wav'
      const response = await fetch(BASE + audioPath, { credentials: 'same-origin', signal: AbortSignal.timeout(5000) })
      if (!response.ok) throw new Error(t('noFile'))
      const blob = await response.blob()
      if (stopped) return
      cleanupAudio()
      const url = URL.createObjectURL(blob), audio = new Audio(url)
      currentAudio = audio; audio.volume = volume
      const cleanup = () => { URL.revokeObjectURL(url); if (currentAudio === audio) { currentAudio = undefined; cleanupAudio = () => {} } }
      cleanupAudio = () => { audio.pause(); cleanup() }
      audio.addEventListener('ended', cleanup, { once: true }); audio.addEventListener('error', cleanup, { once: true })
      clearTimeout(audioTimer); audioTimer = setTimeout(() => { audio.pause(); cleanup() }, 10000)
      try { await audio.play() } catch (e) { cleanup(); throw e }
      return
    }
    if (!soundContext || soundContext.state !== 'running') throw new Error(t('unlock'))
    for (const [frequency, at, duration] of SOUNDS[sound].notes) {
      const osc = soundContext.createOscillator(), gain = soundContext.createGain(), start = soundContext.currentTime + at
      osc.type = 'sine'; osc.frequency.value = frequency
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(volume * 0.35, start + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
      osc.connect(gain); gain.connect(soundContext.destination); osc.start(start); osc.stop(start + duration + 0.01)
      osc.onended = () => { osc.disconnect(); gain.disconnect() }
    }
  }
  async function preview(sound) {
    error = ''; unlock()
    try {
      if (state.settings.output === 'native') await request('/preview', { sound })
      else { if (soundContext?.state === 'suspended') await soundContext.resume(); await play(sound, state.settings.volume) }
      await refresh()
    } catch (e) { report(e) }
  }
  async function deliver(event) {
    if (event.output === 'browser' && event.volume > 0) await play(event.sound, event.volume).catch(report)
    if (event.notifications && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const notification = new Notification(t(event.kind), { body: 'DSH · Task Signal', tag: 'task-signal-' + event.sessionId, silent: true })
      notification.onclick = () => { window.focus(); notification.close() }
      setTimeout(() => notification.close(), 15000)
    }
    if (event.speech && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(event.speechText)
      utterance.volume = event.volume; utterance.lang = /[\u4e00-\u9fff]/.test(event.speechText) ? 'zh-CN' : 'en-US'
      window.speechSynthesis.speak(utterance)
    }
  }
  let refreshing
  async function refresh() {
    if (refreshing) return refreshing
    refreshing = (async () => {
      const fresh = await request('/status', undefined, 'GET')
      if (stopped) return
      state = fresh
      if (epoch !== fresh.epoch || seq === undefined) { epoch = fresh.epoch; seq = fresh.seq }
      else {
        for (const event of fresh.events) if (event.seq > seq) {
          seq = event.seq
          if (Date.now() - event.at > 15000) continue
          if (event.output === 'browser' || event.notifications || event.speech) {
            const result = await request('/claim', { seq: event.seq })
            if (!stopped && result.event) await deliver(result.event)
          }
        }
      }
      emit()
    })().finally(() => { refreshing = undefined })
    return refreshing
  }
  async function poll() {
    try { await request('/presence', { id, focused: !document.hidden && document.hasFocus() }); await refresh() } catch (e) { if (!stopped) report(e) }
    if (!stopped) timer = setTimeout(poll, 1800)
  }
  function presence() { void request('/presence', { id, focused: !document.hidden && document.hasFocus() }).catch(() => {}) }
  function useStateSnapshot() {
    const [, redraw] = React.useState(0)
    React.useEffect(() => { const fn = () => redraw(v => v + 1); subscribers.add(fn); return () => subscribers.delete(fn) }, [])
    return state
  }
  async function save(patch) {
    error = ''
    try { await request('/settings', patch); await refresh(); return true } catch (e) { report(e); return false }
  }
  const check = (label, value, onChange) => h('label', { className: 'ts-check' }, h('input', { type: 'checkbox', checked: value, onChange: e => onChange(e.target.checked) }), label)
  function Panel() {
    const current = useStateSnapshot()
    const [message, setMessage] = React.useState(''), [uploading, setUploading] = React.useState(false)
    if (!current) return h('div', { className: 'ts-panel', role: 'status' }, error || t('loading'))
    const s = current.settings
    const update = patch => { void save(patch).then(ok => setMessage(ok ? t('saved') : '')) }
    const number = (label, value, min, max, onChange) => h('label', { className: 'ts-row' }, h('span', null, label), h('input', { 'aria-label': label, type: 'number', min, max, value, onChange: e => onChange(Number(e.target.value)) }))
    const soundName = key => key === 'custom' ? t('custom') : (t('title') === 'Task Signal' ? SOUNDS[key].en : SOUNDS[key].zh) + (current.presets?.[key] ? (t('title') === 'Task Signal' ? ' · local audio' : ' · 本机音效') : '')
    return h('section', { className: 'ts-panel', 'aria-label': t('title') },
      h('h2', null, t('title')), h('p', { className: 'ts-muted' }, t('intro')),
      check(t('enabled'), s.enabled, enabled => update({ enabled })),
      h('label', { className: 'ts-row' }, h('span', null, t('output')), h('select', { value: s.output, onChange: e => update({ output: e.target.value }) }, h('option', { value: 'native' }, t('native')), h('option', { value: 'browser' }, t('browser')))),
      h('p', { className: 'ts-muted' }, t(s.output === 'native' ? 'nativeHelp' : 'browserHelp')),
      h('label', { className: 'ts-row' }, h('span', null, t('volume') + ' · ' + Math.round(s.volume * 100) + '%'), h('input', { type: 'range', min: 0, max: 100, value: Math.round(s.volume * 100), onChange: e => update({ volume: Number(e.target.value) / 100 }), 'aria-label': t('volume') })),
      h('div', { className: 'ts-events' }, ...['done', 'question', 'approval', 'error'].map(kind => h('div', { className: 'ts-event', key: kind },
        check(t(kind), s.events[kind].enabled, enabled => update({ events: { [kind]: { enabled } } })),
        h('select', { 'aria-label': t(kind), title: soundName(s.events[kind].sound), value: s.events[kind].sound, onChange: e => update({ events: { [kind]: { sound: e.target.value } } }) }, ...[...Object.keys(SOUNDS), 'custom'].map(key => h('option', { key, value: key, disabled: key === 'custom' && !current.custom }, soundName(key)))),
        h('button', { type: 'button', onClick: () => void preview(s.events[kind].sound), 'aria-label': t(kind) + ' · ' + t('preview') }, t('preview'))))),
      number(t('threshold'), s.minDurationSeconds, 0, 86400, minDurationSeconds => update({ minDurationSeconds })),
      number(t('cooldown'), s.cooldownMs, 0, 10000, cooldownMs => update({ cooldownMs })),
      check(t('subagents'), s.subagents, subagents => update({ subagents })),
      check(t('background'), s.backgroundOnly, backgroundOnly => update({ backgroundOnly })),
      check(t('whale'), s.respectWhale, respectWhale => update({ respectWhale })),
      check(t('quiet'), s.quietHours.enabled, enabled => update({ quietHours: { enabled } })),
      s.quietHours.enabled && h('div', { className: 'ts-row' }, ...['start', 'end'].map(k => h('label', { key: k }, t(k) + ' ', h('input', { type: 'time', value: s.quietHours[k], onChange: e => update({ quietHours: { [k]: e.target.value } }) })))),
      h('p', { className: 'ts-muted' }, t('quietHelp')),
      check(t('notify'), s.notifications, async notifications => { if (notifications && (typeof Notification === 'undefined' || await Notification.requestPermission() !== 'granted')) { setMessage(t('notifDenied')); return } update({ notifications }) }),
      check(t('speech'), s.speech, speech => update({ speech })),
      s.speech && h('label', { className: 'ts-row' }, h('span', null, t('transcript')), h('input', { type: 'text', maxLength: 120, defaultValue: s.speechText, onBlur: e => update({ speechText: e.target.value }) })),
      h('h3', null, t('upload')), h('p', { className: 'ts-muted' }, t('uploadHelp')),
      h('input', { type: 'file', accept: '.wav,audio/wav', 'aria-label': t('upload'), disabled: uploading, onChange: async e => {
        const file = e.target.files?.[0]; if (!file) return
        if (file.size > 2 * 1024 * 1024) { report(t('uploadHelp')); return }
        setUploading(true)
        try { const response = await fetch(BASE + '/custom.wav', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'audio/wav' }, body: file, signal: AbortSignal.timeout(10000) }); const result = await response.json(); if (!response.ok) throw new Error(result.error); await refresh(); setMessage(t('configured')) } catch (err) { report(err) } finally { setUploading(false) }
      } }),
      current.custom && h('button', { type: 'button', onClick: async () => { try { await request('/custom.wav', undefined, 'DELETE'); await refresh() } catch (e) { report(e) } } }, t('remove')),
      h('div', { className: 'ts-status', role: 'status' }, h('strong', null, t('status') + ': '), error || (current.lastPlayback.ok === false ? current.lastPlayback.error : current.lastPlayback.ok ? t('nativeOk') : t('ready')), message && h('p', null, message), current.warning && h('p', null, current.warning)),
      h('button', { type: 'button', onClick: async () => { try { await request('/mute', { muted: !current.muted }); await refresh() } catch (e) { report(e) } } }, t(current.muted ? 'unmute' : 'mute')),
      h('p', { className: 'ts-muted' }, t('muteHelp')), h('p', { className: 'ts-muted' }, t('deliveryHelp')))
  }
  function MuteButton() {
    const current = useStateSnapshot()
    return h('button', { type: 'button', title: t(current?.muted ? 'unmute' : 'mute'), 'aria-label': t(current?.muted ? 'unmute' : 'mute'), 'aria-pressed': !!current?.muted, onClick: async () => { try { await request('/mute', { muted: !state?.muted }); await refresh() } catch (e) { report(e) } }, style: { background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: '5px' } }, current?.muted ? '♩×' : '♪')
  }
  const style = document.createElement('style')
  style.textContent = '.ts-panel{max-width:760px;padding:24px;color:var(--dsw-alias-label-primary,inherit);font:14px/1.65 system-ui,"Microsoft YaHei",sans-serif;box-sizing:border-box}.ts-panel h2{font-size:23px;line-height:1.3;margin:0 0 8px}.ts-panel h3{font-size:16px;margin:22px 0 4px}.ts-muted{opacity:.65;font-size:12px;margin:8px 0 16px}.ts-row{display:flex;gap:16px;align-items:center;justify-content:space-between;margin:14px 0;flex-wrap:wrap}.ts-check{display:flex;align-items:center;gap:9px;margin:10px 0}.ts-events{border-block:1px solid var(--dsw-alias-border-l2,#8884);margin:18px 0;padding:8px 0}.ts-event{display:grid;grid-template-columns:minmax(110px,1fr) minmax(90px,160px) auto;gap:10px;align-items:center}.ts-panel input[type=number]{width:95px}.ts-panel select,.ts-panel input[type=text],.ts-panel input[type=number],.ts-panel input[type=time]{font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-2,transparent);border:1px solid var(--dsw-alias-border-l2,#8886);border-radius:6px;padding:5px 8px;max-width:100%;box-sizing:border-box}.ts-panel input[type=range]{width:180px}.ts-panel button{font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-2,transparent);border:1px solid var(--dsw-alias-border-l2,#8886);border-radius:6px;padding:5px 12px;cursor:pointer}.ts-status{padding:12px;border:1px solid #8884;border-radius:8px;margin:18px 0;overflow-wrap:anywhere}@media(max-width:520px){.ts-panel{padding:14px}.ts-event{grid-template-columns:minmax(90px,1fr) minmax(70px,110px) auto;gap:6px}.ts-panel input[type=text]{width:100%}.ts-panel button{padding:5px 8px}}'
  document.head.appendChild(style)
  const off = []
  for (const [slot, options, component] of [
    ['plugins.bundle.config', { key: 'dsh-task-signal' }, props => props.view === 'page' ? h(Panel) : null],
    ['settings.plugins.tab', { key: 'dsh-task-signal', id: 'dsh-task-signal', label: () => t('title'), order: 55 }, Panel],
    ['conversation.input.left', { id: 'dsh-task-signal-mute', order: 30 }, MuteButton],
  ]) {
    try { off.push(ctx.slots.inject(slot, () => ctx.slots.register({ name: slot, locale: 'task-signal', ...options }, component))) } catch (e) { console.warn('[Task Signal] slot unavailable:', slot) }
  }
  const onFocus = () => presence()
  window.addEventListener('focus', onFocus); window.addEventListener('blur', onFocus); document.addEventListener('visibilitychange', onFocus)
  document.addEventListener('pointerdown', unlock, { once: true })
  void poll()
  ctx.effect(() => () => { stopped = true; clearTimeout(timer); clearTimeout(audioTimer); for (const dispose of off) if (typeof dispose === 'function') dispose(); style.remove(); subscribers.clear(); cleanupAudio(); void soundContext?.close(); document.removeEventListener('pointerdown', unlock); window.removeEventListener('focus', onFocus); window.removeEventListener('blur', onFocus); document.removeEventListener('visibilitychange', onFocus) })
  console.info('[Task Signal] client 0.1.3 ready')
}
