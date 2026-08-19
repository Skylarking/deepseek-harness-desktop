# Agent Note：Desktop 插件包分类

Status: implemented

[English](2026-08-19-desktop-plugin-package-classification.md) | 中文

## 问题

Desktop profile 可以同时包含 DSH bundle、skill 包和普通 NPM 依赖。插件管理器原先把所有依赖都当作可启停的 bundle，并把启用的包名写入 `dsh.profile.bundles`。因此启用 skill 包会导致下次启动失败，因为该包没有声明 `dsh.bundle.patch`。插件管理还会占用一个较大的独立窗口，并在每次变更期间把主窗口导航到加载页。

## 决策

- 只有 manifest 声明非空字符串 `dsh.bundle.patch` 的包才是可启停插件。Desktop 插件管理只能把这类包加入 `dsh.profile.bundles`。
- 包含 `skill/SKILL.md` 的包显示为 skill 包，其他依赖显示为普通包。这些分类只影响展示，不赋予包 bundle 语义。
- profile 同步会从 `dsh.profile.bundles` 中移除已安装 manifest 未声明 bundle patch 的 dependency-backed 条目。没有对应 dependency 的 bundle 条目保持不变，因为内置 profile layer 也可以使用这类条目。
- 插件管理器作为主窗口的紧凑原生子窗口打开，使用 Web UI 主题 token 与 macOS 原生关闭和缩放控件。由于 macOS 会在最小化子窗口时连同父窗口一起最小化，因此禁用最小化，同时禁止进入全屏。
- 插件管理器及其原生生命周期对话框根据 macOS 首选系统语言的第一项选择中文或英文文案，不支持的语言回退英文。
- 插件变更会停止并重启由 Desktop 管理的 DSH runtime，但不会把主窗口从 Web UI 导航走。进度与失败信息保留在插件管理器中。

## 验证

Desktop 测试覆盖 bundle、skill 与普通包分类，拒绝启用 skill 包，清理历史无效 bundle 条目，保留内置 bundle 条目，以及原生子窗口选项。打包后的应用还会接受实际操作验收，确认管理器与主窗口保持关联，并且包变更不会用加载页替换 Web UI。

## 曾考虑的替代方案

- **隐藏所有非 bundle 依赖**：否决，因为用户仍需识别并移除已安装的 skill 包与普通包。
- **继续把所有依赖视为插件**：否决，因为 NPM dependency 并不满足 DSH bundle loader 的要求。
- **把插件管理渲染为主窗口页面**：否决，因为包管理是短暂的次要任务，替换活动会话会打断主要工作流。

## 后果

skill 包与普通包仍是已安装的 profile dependency，可以打开或移除，但不能作为 DSH bundle 启用。现有 profile 会在同步时清理 dependency-backed 的无效 bundle 条目。插件管理在视觉上从属于当前 Desktop 会话，runtime 重启也不再替换会话视图。
