# DeepSeek Harness Desktop

[English](README.md) | 中文

macOS 桌面应用在隔离的 Electron renderer 中承载官方 DSH Web UI，并管理一个随应用打包的 DSH runtime 子进程。子进程绑定操作系统分配的 `127.0.0.1` 端口；宿主等待 CLI 就绪行后才加载该来源。Web renderer 没有 Node.js integration，只获得范围很窄且启用 context isolation 的 Desktop bridge。宿主会在准备 profile 前创建可见的加载窗口，并通过原生对话框报告任一启动阶段的错误，而不会留下无窗口的应用进程。宿主负责 runtime 启动、重启、关闭、工作区选择、外部导航和 profile 插件生命周期。

## 开发

在仓库根目录运行：

```sh
pnpm desktop:dev
```

该命令构建 Electron 宿主和插件管理 renderer，暂存自包含的 DSH runtime，然后启动应用。使用 **File > Open Workspace** 修改子进程工作目录。所选工作区在当前应用运行期间有效。

## 插件管理

在 **设置 > 插件 > 插件列表** 中把本地插件目录安装到共享 `web` profile，也可以停用、重新启用或卸载已安装插件。Desktop 不随包提供功能插件，也不会向新 profile 自动添加插件。停用只把包移出 `dsh.profile.bundles`，保留依赖、源码和设置；卸载会移除依赖和插件声明拥有的设置 namespace，但不删除本地源码。独立的 **Plugins > Manage Plugins** 窗口仍可用于打开源码/profile 和手动重启 runtime。

已启用插件可以通过 `dsh.desktop.supportPackages` 声明 profile-local package alias。Desktop 会在每次重启前根据完整的已启用插件集合校准这些 alias；只要仍有插件需要同一路径，共享支持包就会保留，最后一个依赖消失后则恢复 DSH 随包提供的 runtime package。支持包 alias 属于实现细节，不会显示为可单独管理的插件。

具有权限的插件管理 renderer 只加载一个随应用打包的 `file://` 文档，并通过窄 preload API 工作。主 Web renderer 获得第二条 bridge，但只允许列出、本地插件安装、启停和经确认的移除；IPC 仅接受来自所属主 `webContents` 且处于当前 loopback origin 的调用。本地安装会打开原生目录选择器，启用、停用和卸载都需要原生确认后才修改 runtime 或 profile。已安装的 Host 插件仍在 DSH Node.js runtime 中执行，Client 插件 bundle 仍加入官方 UI renderer；此版本不提供 VS Code 式隔离 Extension Host。

插件也可以在自身 package manifest 的 `dsh.desktop.overlay` 中声明一个受限的 Desktop overlay。插件拥有收起和展开尺寸以及所渲染的 Web surface。在 macOS 上，宿主创建透明且不抢焦点的 `panel`，使其始终显示在其他应用上方，并跨 Space 和全屏应用保持可见。兼容 sandbox 的 CommonJS preload 只提供移动与展开能力。Overlay 创建仍由 manifest 驱动；插件离开 profile 时，宿主会销毁窗口，因此卸载不会留下 overlay 状态。普通官方 Web 窗口不会获得该 bridge。

## 打包

在仓库根目录构建未正式签名的本地 macOS 应用和 DMG：

```sh
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm desktop:package
```

产物写入 `apps/desktop/release/`。本地构建可以使用 ad-hoc 签名。在开发 Mac 之外分发需要 Apple Developer ID Application 证书、Hardened Runtime 签名和公证。

## 传输

当前宿主有意通过随机回环端口复用已发布的浏览器载体，因为 Web client 依赖 HTTP route、WebSocket、启动 manifest 注入和插件 bundle URL。与通道无关的 RPC 层允许后续实现使用 Electron IPC fetch 载体的 `file://` client；该替换尚未包含在此应用中。
