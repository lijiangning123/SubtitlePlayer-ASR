# 📝 字幕播放器 SubtitlePlayer-ASR

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)

一个集成本地 ASR 的网页视频播放器，专注于网课复习场景下的字幕生成、浏览与编辑。支持视频加载、本地 ASR 生成 SRT、SRT/VTT/TXT 字幕上传、实时 CC 显示、文稿面板、编辑导出、多主题切换、键盘快捷键，所有数据可持久化。

推荐运行 `字幕播放器.cmd` 或 `start-player.cmd`，它会启动本地 ASR 服务并打开播放器页面。

---

## 快速开始

1. 运行 `字幕播放器.cmd`
2. 点击 **🎬 打开视频** 加载视频文件
3. 点击 **🎙 生成字幕** 自动生成 SRT，或点击 **📄 上传字幕** 加载已有 SRT、VTT、TXT 文件
4. 播放视频，右侧实时跟随当前字幕

> 也支持直接拖拽视频和字幕文件到页面上。

如果要使用「🎙 生成字幕」，推荐从项目根目录运行：

```powershell
.\字幕播放器.cmd
```

它会先打开本地 ASR 服务窗口，再打开播放器页面。生成字幕时请保持 ASR 服务窗口运行。

如果要把 `I:\subtitleplayer` 里的 AsrTools 运行时整合到本项目目录，先运行：

```powershell
.\integrate-asrtools-runtime.cmd
```

脚本会复制：

- `I:\subtitleplayer\runtime` -> `asr-service\runtime\python`
- `I:\subtitleplayer\ffmpeg.exe` -> `asr-service\runtime\ffmpeg\ffmpeg.exe`
- `I:\subtitleplayer\app` -> `asr-service\runtime\asrtools\app`

复制完成后，本项目会优先使用项目内 runtime，不再依赖 I 盘路径。

### 本地 ASR 生成字幕

「🎙 生成字幕」按钮会调用本机 `asr-service`。整合版优先使用项目内 `asr-service/runtime` 中的 Python、FFmpeg 和 AsrTools；如果这些文件不存在，会回退到已配置的外部 AsrTools 路径或系统环境。

Windows 可以直接运行：

```powershell
cd asr-service
.\run-asr-service.cmd
```

`run-asr-service.cmd` 会优先使用 `asr-service/runtime` 中的内置 Python、FFmpeg 和 AsrTools；没有内置 runtime 时，才回退到 `I:\subtitleplayer` 或系统环境。

启动服务后，打开本地视频并点击「🎙 生成字幕」。默认引擎是 AsrTools 的 `bijian` / B 接口，会返回 SRT 并自动加载到现有字幕面板。

许可证说明：整合版按 GPL-3.0-only 对外分发。原 SubtitlePlayer 前端仍保留 MIT 许可声明；由于整合包可包含 AsrTools / FFmpeg 等 GPL 组件，整体发行包按 GPL-3.0-only 处理。详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

---

## 功能一览

### 视频播放

| 功能 | 操作 |
|------|------|
| 打开本地视频 | 点击「🎬 打开视频」或拖拽到页面 |
| 打开网络视频 | 点击「🔗 打开URL」，粘贴直链（mp4/webm 等）|
| 播放 / 暂停 | 按钮、空格键 |
| 快退 / 快进 5 秒 | 键盘 `←` / `→` 短按 |
| 3× 倍速 | 长按 `→` 键，松开恢复 |
| 音量调节 | 键盘 `↑` / `↓` |
| 全屏 / 退出全屏 | 左键单击视频画面 / 全屏时右键 |
| 时间轴拖拽 | 按住进度条拖动 |
| 倍速精细控制 | 控制栏 `−` `+` `1×` 按钮 |

### 字幕

| 功能 | 操作 |
|------|------|
| 上传字幕 | 点击「📄 上传字幕」，支持 SRT / VTT / TXT |
| CC 实时字幕 | 视频下方黑色字幕栏，点击「💬 CC」开关 |
| CC 字体大小 | 顶栏 `A⁻` `A⁺` 调整，刷新记忆 |
| CC 拖拽定位 | 拖 `⋮⋮` 手柄到视频上 → 贴视频底端（半透明），可继续拖到任意位置 |
| 字幕文稿面板 | 右侧显示全部字幕，时间戳可点击跳转 |
| 搜索字幕 | 文稿面板上方搜索框，实时高亮过滤 |
| 自动滚动 | 点击「📍 跟滚」开关，当前字幕始终在面板中间 |
| 清除字幕 | 顶栏 `🗑`，确认不可撤销，同时删播放记录 |
| 字幕记忆 | 按视频自动存储，下次打开同一视频自动恢复 |
| CC 开关记忆 | 刷新生效 |

### 编辑字幕

| 功能 | 操作 |
|------|------|
| 进入编辑 | 文稿面板标题栏「✏️ 编辑」按钮 |
| 新建字幕 | 在播放位置点「➕ 新建」，自动按时间插入 |
| 修改文字 | 双击字幕文本编辑，失焦自动保存 |
| 删除字幕 | 单击选中字幕，点右侧 `✕` 按钮 |
| 撤销 / 重做 | 工具栏 `↩` `↪`，支持文字修改撤销 |
| 保存到原文件 | 点击「💾 保存」→ 回车确认覆盖 |
| 导出 SRT | 点击「📥 导出」下载新文件 |

### 笔记

| 功能 | 操作 |
|------|------|
| 进入笔记 | 文稿面板标题栏「📝 笔记」|
| 新建笔记 | 播放时点「➕」，自动插入当前时间戳 |
| 编辑文字 | 双击笔记文本修改，失焦自动保存 |
| 删除笔记 | 单击选中，点 ✕ 删除 |
| 撤销 / 重做 | 工具栏 `↩` `↪` |
| 搜索笔记 | 笔记区顶部搜索框，实时高亮过滤 |
| 保存到文件 | `💾` 弹出文件对话框保存 `.txt`，Firefox 回退到浏览器存储 |
| 导出 TXT | `📥` 下载笔记为 `.txt`，格式 `[分:秒] 文本` |
| 上传笔记 | 顶栏 `📝 上传笔记` 导入 `.txt` |
| 清除笔记 | 工具栏 `🗑`，确认不可撤销 |
| 笔记记忆 | 按视频自动存储，下次打开同一视频自动恢复 |

> 笔记模式下文稿面板对半分（可拖拽分隔条调整比例），上半字幕跟滚照常，下半独立记笔记。笔记就是 TXT 格式的字幕条目，每条自带时间戳。默认开启笔记模式，状态记忆刷新保留。

### 主题

| 主题 | 风格 |
|------|------|
| 🟤 香槟 | 复古暖棕色 |
| 🟢 黑客 | 黑底荧光绿终端风 |
| 🔵 月光 | 深蓝暗夜科技风 |
| 🌸 樱花 | 浅粉柔和 |
| 🌿 森林 | 自然清新绿 |
| 🌅 落日 | 橙红晚霞暖色调 |

点击顶栏「🎨 主题」展开菜单即可切换。刷新自动记忆。

### 持久化

每项数据同时存两份：一份 session 副本（当前标签页专用），一份全局备份（跨 session 恢复）。

| 数据 | 存储 | 跨 Session |
|------|------|-----------|
| 字幕内容 | localStorage（按视频） | ✅ 全局备份 |
| 播放位置 | localStorage（按视频） | ✅ 全局备份 |
| 笔记内容 | localStorage（按视频） | ✅ 全局备份 |
| 主题 / CC 字号 / CC 开关 | localStorage | ✅ 全局 |
| 笔记模式开关 | localStorage | ✅ 全局 |
| 视频文件句柄 | IndexedDB | ✅ 全局备份 |
| 字幕文件句柄 | IndexedDB | ✅ 全局备份 |
| Firefox 视频缓存 | IndexedDB | ❌ session 副本 |

**自动清理**：启动时扫描——
- 超过 7 天未活动的 session 数据（localStorage + IndexedDB）
- 超过 30 天未访问的视频的字幕和笔记数据
- 最多保留 20 个历史 session

### 多标签页

支持同时打开多个标签页，各自加载不同视频，互不干扰。每个标签页自动分配独立 session，播放位置、视频句柄完全隔离。字幕和笔记通过全局备份跨 session 持久化，同一视频在多标签页间共享数据。主题、CC、笔记模式开关跨标签页共享。

### 键盘快捷键

| 按键 | 功能 |
|------|------|
| `空格` | 播放 / 暂停 |
| `→` 短按 | 快进 5 秒 |
| `→` 长按 | 3× 倍速（松开恢复） |
| `←` | 快退 5 秒 |
| `↑` | 音量 +10% |
| `↓` | 音量 -10% |
| `C` | 开关 CC 字幕 |

### 全屏时间轴

全屏模式下，鼠标移动时底部浮现时间轴（当前时间 + 进度条 + 总时长），3 秒不动自动隐藏。点击进度条可跳转。

---

## 项目结构

```
├── 字幕播放器.html                 入口文件
├── asr-service/                  本地 ASR 服务，可集成 AsrTools runtime
├── css/
│   └── player.css             所有样式 + 6 套主题变量
└── js/
    ├── setup.js               DOM 引用、全局状态
    ├── utils.js               工具函数（格式化时间、toast 等）
    ├── parser.js              SRT / VTT / TXT 字幕解析
    ├── asr.js                 调用本地 ASR 服务并加载生成的 SRT
    ├── memory.js              IndexedDB + localStorage 持久化
    ├── subtitles.js           文稿面板、CC 显示、搜索滚动
    ├── edit.js                编辑模式、撤销重做、保存导出
    ├── notes.js               笔记模式、TXT 导出
    ├── video.js               视频加载、全屏、键盘、时间轴
    ├── drag.js                CC 拖拽、面板分隔条拖拽
    ├── theme.js               主题切换下拉菜单
    └── app.js                 初始化入口
```

所有 JS 模块通过全局 `DP` 命名空间通信，按依赖顺序在 `字幕播放器.html` 中加载。

---

## 浏览器兼容性

| 浏览器 | 视频记忆 | 字幕回写 | 基础功能 |
|--------|---------|---------|---------|
| Chrome / Edge | ✅ | ✅ | ✅ |
| Firefox | ✅ (文件缓存) | ❌ (导出) | ✅ |
| Safari | ❌ | ❌ | ✅ |

> 视频记忆双路径：Chrome/Edge 用 File System Access API 句柄，Firefox 用 IndexedDB 文件缓存。字幕回写依赖 File System Access API（仅 Chrome/Edge 支持）。

---

## FAQ

**Q: Chrome 和 Firefox 的视频记忆有什么区别？**
Chrome 存的是文件句柄（指向原始文件，需用户手势恢复权限），Firefox 存的是文件副本到 IndexedDB（无需权限，自动恢复）。

**Q: 为什么刷新后视频没了？**
刷新后打开同一视频，字幕和笔记会自动恢复；视频需点击 `🕐 恢复` 按钮授权（Chrome），Firefox 自动恢复。跨 session 的数据通过全局备份持久化。

**Q: 会不会产生垃圾数据？**
不会。启动时自动清理——超过 7 天的旧 session 数据（localStorage + IndexedDB），超过 30 天未访问的视频数据，最多保留 20 个历史 session。手动点 `🗑` 可立即清除当前数据。

**Q: 为什么有时候会生成 `.crswap` 文件？**
这是 Chrome 的 File System Access API 内部临时文件。本项目已改用 `showSaveFilePicker` 方式保存，正常操作不会产生。

**Q: 能否记住上次打开文件的文件夹？**
能。打开视频/字幕时，选择器会自动定位到上次使用的文件夹。

---

## 开源协议

整合发行包：GPL-3.0-only，见 [LICENSE](LICENSE)。

原 SubtitlePlayer 前端：MIT，见 [LICENSES/MIT-SubtitlePlayer.txt](LICENSES/MIT-SubtitlePlayer.txt)。

第三方组件和源码要求：见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
