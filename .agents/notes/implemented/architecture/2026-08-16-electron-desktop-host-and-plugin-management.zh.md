# Agent Note: Electron 桌面宿主与插件管理

Status: implemented

[English](2026-08-16-electron-desktop-host-and-plugin-management.md) | 中文

## 问题

官方 DSH UI 通过 `dsh web` 运行，而 macOS 用户需要应用生命周期、随应用打包的 runtime、工作区交接和本地插件管理，同时不能向 Web UI 授予原生文件系统权限。已有的 [GUI 分层决策](2026-07-19-gui-layering-and-rpc-protocol.md) 将 client RPC 语义与载体分离，但没有提供 Electron 宿主或 IPC 载体。

## 决策

`apps/desktop` 是一个 Electron 宿主，采用与原生智能体 client 相同的高层进程拆分：隔离的 UI renderer、单独监管的智能体 runtime 进程，以及由宿主持有的原生操作。应用会在准备 profile 前创建加载窗口，把任一启动阶段的错误交给同一个原生错误对话框，并且不会在启动被拒绝后留下无可见窗口的进程。应用打包一个已部署的 `@deepseek-ai/dsh` 依赖闭包，以 `web --host 127.0.0.1 --port 0` 启动它，解析 CLI 就绪行，然后加载得到的回环来源。关闭时先排空串行 runtime 操作，只向所属子进程发送 `SIGTERM`，并使用有时限的 `SIGKILL` 兜底。

官方 Web renderer 使用 `contextIsolation`、Electron 沙箱且没有 Node.js integration，并通过一条窄 preload bridge 执行 profile 插件生命周期操作。宿主只接受来自所属主 `webContents` 且来源为当前回环 origin 的 bridge 调用。安装会打开原生目录选择器，启用、停用和卸载则需要原生确认。renderer 中的外部导航会被拒绝，并交给操作系统处理。

独立的插件管理 renderer 只加载一个精确的随应用打包 `file://` URL。其 preload 仅暴露列表、本地目录安装、启用、停用、移除、打开源码或 profile，以及重启 runtime。每个 IPC handler 同时校验所属 `webContents` 和精确 sender-frame URL。安装和移除调用随应用打包的 CLI 来修改共享 `web` profile，启用状态通过 profile bundle 列表修改，所有 runtime 变更都经过一个 FIFO 操作队列。

## 插件模型

Desktop 增加类似 VS Code 的管理工作流，而不是 VS Code 的 Extension Host 隔离模型。Host 插件在 DSH Node.js runtime 内执行，Client 插件 bundle 则通过现有模块注册表加载到官方 Web renderer。设置页把用户安装的 profile 插件与只读的 Cordis 系统组件清单分开。没有 Desktop bridge 的浏览器部署仍只显示该只读清单。

停用用户插件会将其从 `dsh.profile.bundles` 移除，但保留 profile dependency、本地源码和设置，因此重新启用可恢复之前的状态。卸载插件会删除其 profile dependency 和声明拥有的设置 namespace，但绝不删除本地源码目录。专用的进程外 extension host、权限 manifest 和隔离插件 WebView 属于单独的安全工作。

启用的插件可以通过 `dsh.desktop.overlay` 声明 Web 入口、收起尺寸、可选展开尺寸与可选初始坐标。在 macOS 上，Desktop 创建一个透明且不抢焦点的 Electron `panel`，将其层级设为 `floating`，并使其跨所有 Space 和全屏应用保持可见。插件被停用、离开 profile 或 runtime 重启时，Desktop 会销毁该 panel。兼容 sandbox 的 CommonJS preload 为 overlay renderer 提供一条启用 context isolation 的窄 bridge，以受限增量移动窗口，并在插件声明的尺寸之间切换，同时保持右下角锚点不变。主 Web renderer 不会获得这条 overlay bridge，IPC 消息也只接受自仍然存活的 overlay 窗口。

Desktop 不识别宠物名称、sprite 格式、任务状态或插件 id。宠物插件负责发现 `~/.codex/pets` 下与 Codex 兼容的内容、动画、交互状态和任务呈现。其 client bundle 会在普通 Desktop Web surface 中抑制自身，只在所声明的 overlay surface 中渲染。因此，卸载插件会同时移除窗口和 UI，不会留下 Desktop 设置或插件专属代码路径。

## 传输

首个 Desktop 版本使用随机回环 HTTP/WebSocket 载体，因为组装后的 Web UI 需要静态路由、启动 manifest 转换、插件 bundle endpoint 和 WebSocket 下行。RPC 设计仍允许后续使用 `file://` renderer 和 IPC fetch 载体实现。Desktop 不会声称该尚未实现的载体已经存在。

## 验证

无密钥测试覆盖显式加载窗口展示顺序、任一启动阶段的可见错误处理、就绪解析、分段输出、启动超时子进程回收、有界启动输出捕获、插件发现、精确的权限 frame 校验、runtime 操作串行化、macOS panel 与 Space 行为、overlay preload 隔离、插件拥有的尺寸和锚定展开几何行为。仓库中的 Codex Pets Client 产物还会挂载到当前 keyed 设置 slot 与 list overlay slot，并验证卸载时两项注册均被回收。打包验证会审计暂存依赖闭包是否存在指向 runtime 之外的链接、在 Electron-as-Node 下启动暂存 CLI、在 Electron 中加载官方 UI，并启动打包后的应用。

## 考虑过的替代方案

**直接通过 `file://` 加载 Web dist。** 当前 Web 组合需要同源 HTTP route、WebSocket、index 转换和插件资源 endpoint。只重建静态加载会产生不完整应用，而不是复用官方 UI。

**向官方 Web renderer 暴露宽泛的原生权限。** 通用文件系统或进程权限会让任意受信任 Client bundle 超出其 UI 职责。主 renderer 只获得 profile 插件生命周期方法，原生确认保护变更操作，独立的精确文档 renderer 则继续负责打开源码或 profile 以及显式重启 runtime。

**从 Desktop 运行源码 checkout。** 打包应用会依赖仓库路径、pnpm workspace 链接和开发工具。暂存的自包含 runtime 让应用脱离 checkout 独立运行。

**在 Desktop 内实现特定宠物。**卸载插件后，宿主仍会留下宠物代码、设置和 UI 决策。通用的窄 overlay 能力可让产品行为留在已安装插件中。

**向 overlay renderer 提供 Electron API。**任意已安装 Client 代码并不需要文件系统、进程或通用窗口权限。窄 preload 只暴露声明 surface 所需的两项原生操作。

## 后果

该应用提供原生 macOS 生命周期、共享 profile 插件工作流和可回溯的屏幕常驻插件 surface，同时保留官方 Web UI 与 DSH 插件系统。它也继承回环监听器和当前的受信任 Client 插件模型：已加载的 Client bundle 与能够请求插件生命周期操作的 renderer 共享进程，但变更仍受原生确认保护。overlay 插件共享一个很小的原生能力面，并继续负责自身 UI 与数据格式。runtime 暂存会增加产物体积，本地未正式签名构建会触发正常的 macOS 信任警告，公开分发仍依赖 Developer ID 签名和 Apple 公证。
