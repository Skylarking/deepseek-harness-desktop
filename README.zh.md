# DeepSeek Harness Desktop

[English](README.md) | 中文

**DeepSeek Harness 的 macOS 桌面应用。**

DeepSeek Harness Desktop 将 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) agent 体验带入独立桌面应用。应用内置 DSH 运行时与 Web UI，会自行管理本地服务，并支持通过可安装插件扩展功能，无需永久修改应用本体。

本项目由社区独立维护，不是 DeepSeek 官方发行版。

## 功能特性

### 复用完整 DSH 能力的桌面形态

直接运行 DSH 时，用户从终端启动本地 Web 服务，再通过外部浏览器打开界面：

```text
Terminal
└── npx @deepseek-ai/dsh web
    └── starts local dsh web
        └── External browser
            └── DSH Web UI
                └── DSH Core
                    └── Cordis
```

DeepSeek Harness Desktop 使用 Electron 封装同一条运行链路：

```text
Electron Desktop
└── starts bundled dsh web
    └── Electron window
        └── DSH Web UI
            └── DSH Core
                └── Cordis
```

因此，Desktop 复用了原有的 DSH Web UI、DSH Core 与 Cordis 运行时。Electron 负责提供 macOS 应用窗口并管理随应用打包的 `dsh web` 进程，而不是重新实现现有的 agent 能力。

### 自包含的本地运行

安装后的应用内置 DSH 运行时，并会自动启动本地服务。打开和关闭 Desktop 时，应用也会启动和停止自己管理的进程，因此日常使用不需要 Node.js、`npx` 或另外维护 Web 服务。

### 可逆的插件管理

Desktop 将应用界面和运行时的变化作为插件拥有的扩展管理，而不是永久修改应用本体。面板、设置项、Host 能力和原生 overlay 只在提供它们的插件启用期间存在。

- **禁用：**将插件移出活跃组合并释放其界面与运行时扩展，同时保留安装记录、来源和设置；重新启用后会按原有配置恢复同一插件。
- **卸载：**移除插件依赖与活跃扩展，并清理该插件声明的设置命名空间。由 Desktop 管理的界面和运行时会恢复到安装插件前的形态，同时不改变 Workspace 数据、Session、无关设置、本地插件源代码或用户资源。

#### 可逆性如何实现

可逆性由 manifest 中记录的资源归属保证，而不是依靠代码事后猜测并重建原来的界面：

1. Web profile 的 `dependencies` 记录已经安装的插件包，`dsh.profile.bundles` 记录其中参与活跃组合的插件。禁用只修改 bundle 列表，因此插件包与配置仍然保留，重新启用时可以按原配置恢复。
2. Bundle 将 Host 与 Client 插件挂载到 Cordis 插件树。Route、service、listener、设置卡片和 UI slot 都是归属于该插件树生命周期的注册项。插件状态改变后，Desktop 会根据更新后的 bundle 列表重启自己管理的 DSH 运行时，因此被禁用或卸载的插件不会向新运行时贡献任何能力。
3. 需要替换 Host 包的插件通过 `dsh.desktop.supportPackages` 声明依赖。只要仍有启用的插件需要该支持包，Desktop 就会保留 profile-local alias；最后一个依赖插件停用或卸载后，Desktop 删除该 alias，普通包解析随即恢复应用内置的 DSH 实现。
4. Desktop 原生窗口不是对 Web UI 的永久修改。插件通过 `dsh.desktop.overlay` 声明 overlay；Desktop 只为已启用插件创建窗口，并在插件离开活跃 profile 时销毁窗口。
5. 插件通过 `dsh.settings.namespaces` 声明自己拥有的设置。卸载时只会随插件依赖清理这些命名空间；Workspace 数据、Session、其他插件设置、本地源代码目录和用户安装的资源都不在清理范围内。

## 插件

工作区文件、终端与 Codex 宠物都是仓库中受 Git 跟踪的外置插件，不包含在 Desktop 发布包中，只有用户安装对应的本地插件目录后才会出现。每个插件分别拥有下述界面与运行时资源；禁用或卸载插件时，插件管理会移除这些扩展。

### 项目文件

工作区文件插件会增加可调整大小的右侧面板，其中包含目录树、路径跳转，以及文本和常见图片格式的并排预览。打开 Session 后仍可使用该面板，且不会遮挡会话内容。

### 终端

终端插件会增加可调整大小的底部面板，并支持多个终端标签。每个标签都由独立的持久 PTY 支持，因此 shell、REPL、控制键与交互式程序的行为和真实终端一致。

### 桌面宠物

可选的 Codex 宠物插件会读取兼容 Codex 的 `pet.json` 资源，并在其他应用和全屏 Space 上方显示动画宠物。它支持宠物选择、缩放、拖动和 Session 活动状态。卸载插件会同时移除宠物窗口与设置，但不会删除用户安装的宠物资源。

详细行为与限制参见[工作区文件参考](plugins/workspace-files/README.md)、[终端参考](plugins/workspace-console/README.md)、[桌面应用参考](apps/desktop/README.md)与[宠物插件参考](plugins/codex-pets/README.md)。

<a id="run"></a>

## 从源码运行

安装 Node.js `^22.19` 或 `>=24` 和 pnpm，然后在仓库根目录运行：

```sh
pnpm install
pnpm desktop:dev
```

该命令会构建 Electron Host 与 renderer、暂存自包含的 DSH 运行时并启动应用。使用 **File > Open Workspace** 选择受管理运行时使用的目录。在 **Settings > Models** 中配置 DeepSeek 或其他支持的 endpoint，然后创建 Session 并提交任务。

如需在不使用 Electron 的情况下运行上游形式的 Web 应用：

```sh
pnpm dsh web
```

## 打包 macOS 应用

构建未正式签名的本地应用和 DMG：

```sh
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm desktop:package
```

产物写入 `apps/desktop/release/`。当前打包版本面向 Apple Silicon Mac。ad-hoc 构建适合在构建所用的 Mac 上开发；公开分发需要 Developer ID Application 签名、Hardened Runtime、Apple 公证和 Gatekeeper 评估。发布用 DMG 应上传到 GitHub Releases，而不是写入 Git 历史。

## 安全与限制

- 主 Web renderer 没有 Node.js integration，只获得范围很窄且启用 context isolation 的桌面 bridge。
- 已安装的 Host 插件在 DSH Node.js 运行时中执行，Client 插件 bundle 加入 Web renderer。本项目不提供隔离的 Extension Host。
- 原生 overlay 由 manifest 驱动，只获得移动、尺寸、可见性和展开控制；普通 Web renderer 不会获得该 bridge。
- 当前不提供 Windows 或 Linux 桌面安装程序。

## 与上游的关系

DeepSeek Harness Desktop 是基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 开发的非官方 macOS 发行版。本仓库维护桌面 Host 与桌面专用插件，并持续集成适用的上游更新。底层 Harness 仍处于开发者预览阶段，可能出现破坏兼容性的变更。

## 开发

请先阅读[开发指南](docs/development.md)与[架构文档](docs/architecture.md)。桌面专用行为记录在 [apps/desktop](apps/desktop/README.md) 中。

面向 agent：请遵循 [AGENTS.md](AGENTS.md)。

## 许可证

本下游项目保留上游的 [MIT 许可证](LICENSE)。第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
