# `@deepseek-ai/dsh-workspace-console`

[English](README.md) | 中文

仓库中受 Git 跟踪的外置 Workspace 终端插件 bundle，不属于 DSH 或 Desktop 的发布依赖闭包。它的 patch 同时挂载持久 [`dsh-host-workspace-console`](packages/host/README.md) PTY Remote，以及提供底部面板 UI 的 [`dsh-client-ui-workspace-console`](packages/client/README.md)。bundle 启用期间，Desktop 会把这些 Loader package 和共享 Workspace 布局安装为受管理的 profile alias。因此，停用或卸载该 bundle 会在同一个插件生命周期内移除这些 alias、Remote route、新会话与会话页头入口、已打开面板、PTY 进程和保留输出。

在 **设置 > 插件 > 插件列表 > 安装本地插件** 中选择 `plugins/workspace-console` 即可安装。只要该插件或其他依赖方仍处于启用状态，Desktop 就会激活插件外置的 Workspace 布局支持；最后一个依赖方停用或卸载后，profile-local package alias 会被移除，并恢复应用内置的 DSH 布局。

## 安全与限制

Host 执行器只接受已注册的 Workspace id，并以所选 Workspace 作为终端的初始工作目录。PTY 保留 Host 用户的文件系统与进程权限；选择 Workspace 并不构成沙箱。

## 模型体验

无，因为命令来自用户在控制台中的直接输入，不会进入 agent turn（智能体轮次）。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- **保留输出有界** —— Host 只为轮询 Client 保留已配置的终端输出字节尾部。
- **一元 Remote 传输** —— 终端输出通过轮询而不是流式订阅抵达 xterm。
