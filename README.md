# 任务提示音 · DSH Task Signal

任务完成时响一声；Windows 系统播放不依赖窗口是否在前台。默认只开启主任务完成提醒，采用 **Codex 风格**。

[GitHub 源码](https://github.com/tangyixiao/dsh-task-signal) · [npm 安装包](https://www.npmjs.com/package/dsh-task-signal) · [English](README.en.md)

![实际 DSH 设置页](docs/assets/settings-desktop.jpg)

## 功能

- 任务完成、需要回答、等待授权、运行出错：四类提醒独立开关、选音和试听。
- Codex 风格（默认）、ZCode 风格、六种原创合成音效和自定义 PCM WAV，均可试听和调音量。可从本机已安装的应用导入原声音效；导入后标为“本机音效”，没有导入时使用独立合成的近似音色。
- Windows 默认由宿主调用系统播放器，切到别的程序或最小化也可发声。也可选择页面播放。
- 默认子代理不响；可单独开启。完成时长阈值默认 0 秒，每轮都提醒，可改为长任务提醒。
- 只监听激活后新产生的正式 `session/event`，正常 `turn/end completed` 才算完成；主动停止、历史记录和页面刷新不响。
- 同一回合去重、900ms 连续提醒间隔；浏览器播放通过宿主一次性领取，多个标签页不重复。
- 宿主 JSON 原子保存设置，桌面端重启换端口后仍保留。临时静音在宿主重启后复原。
- 可选仅后台提醒、跨午夜免打扰、系统通知、完成语音播报（文稿可编辑），以及向已激活的小鲸鱼让开提示音。

## 使用

进入左侧「插件 → dsh-task-signal」，详情页内有「任务提示音」配置面板；支持该插槽的宿主也可从插件设置标签进入。

首次使用点“任务完成”旁的 **试听**。Windows 默认选择“宿主系统”；想让网页所在的电脑响，改为“当前页面”，再点一次试听。输入区的音符按钮控制临时静音。

语音播报、系统通知与页面播放需要页面保持打开；系统通知需授予权限。默认播报文稿是“任务完成了”，可在界面修改。系统播放不依赖页面，但 **DSH 宿主必须运行**。

仅后台提醒通过打开页面的焦点心跳判断，心跳最多保留 15 秒；页面关闭后或焦点状态过期，宿主按后台处理。免打扰时段使用宿主电脑本地时间。小鲸鱼去重仅针对已激活的 `dsh-whale-widget`，不覆盖其他第三方提醒插件；若同时启用其他提示音插件，应关闭其相同事件。

自定义音频：16 位 PCM WAV，单/双声道，8–48 kHz，最多 2 MiB、8 秒。主音量同样生效；删除后使用它的事件回退到 Codex 音。文件仅存本机，不向外网发送。

源码中的 `tools/import-local-sounds.mjs` 可选地导入本机 Codex/ZCode 原音：

```powershell
node tools/import-local-sounds.mjs --codex "D:\CodexApp\app\resources\codex-notification.wav" --zcode-asar "D:\ZCode\resources\app.asar" --ffmpeg "D:\ffmpeg\bin\ffmpeg.exe"
```

路径按实际安装位置填写；ZCode 导入仅使用现有 ffmpeg，不会安装或下载。原音保留在本机，不包含在插件发行包中。未导入时，两种风格都是本插件合成的近似声音。

## 安装

在 DSH 桌面端的「插件 → 添加插件」中输入 `dsh-task-signal@0.1.0`，安装并启用。CLI 管理的网页 profile 可直接从 npm 安装：

```powershell
dsh plugin --profile web add dsh-task-signal@0.1.0
```


开发环境不需要安装依赖：

```powershell
npm run check
npm pack
```

将生成的 `.tgz` 用 DSH 桌面端插件管理器的本地安装功能安装并启用。CLI 管理的 web profile 可使用：

```powershell
dsh plugin --profile web add file:D:\path\dsh-task-signal-0.1.0.tgz
```

兼容目标为 DSH **0.2.2-rc.3**。Windows 是本次原生播放验证目标；macOS 的 `afplay`、Linux 的 `aplay` 路径未做真机验证，缺少播放器时界面会报告错误，可选择页面播放。发布包可从 npm 和 GitHub Releases 获取；第三方市场收录进度单独记录。

## 数据与验证边界

数据位于 `$DSH_HOME/dsh-task-signal/`（默认 `~/.dsh/dsh-task-signal/`）：`settings.json`、可选 `custom.wav`、可选本机预设 `codex.wav`/`zcode.wav`。临时 `playback-*.wav` 播放结束即清理。最多缓存 64 条内存提醒，不存聊天内容；无外部网络请求或遥测。设置和音频接口要求本机 DSH owner 身份。

自动测试覆盖完成/取消区分、子代理与阈值、去重、焦点和免打扰、设置重启、WAV 验证、HTTP 身份与大小限制。系统播放器正常退出证明调用完成，实际听到声音仍取决于系统音量、输出设备和用户听感。模拟完成事件不等于付费模型实测。

参考方案和许可证来源见 [NOTICE.md](NOTICE.md)。[English](README.en.md)
