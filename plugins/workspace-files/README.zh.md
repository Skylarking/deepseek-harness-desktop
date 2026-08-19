# `@deepseek-ai/dsh-workspace-files`

[English](README.md) | 中文

仓库中受 Git 跟踪的外置 Workspace 文件浏览器插件 bundle，不属于 DSH 或 Desktop 的发布依赖闭包。它的 patch 同时挂载提供受限只读 Remote 的 [`dsh-host-workspace-files`](packages/host/README.md)，以及提供右侧面板 UI 的 [`dsh-client-ui-workspace-files`](packages/client/README.md)。bundle 启用期间，Desktop 会把这些 Loader package 和共享 Workspace 布局安装为受管理的 profile alias。因此，停用或卸载该 bundle 会在同一个插件生命周期内移除这些 alias、Host route、新会话与会话页头入口、已打开面板和浏览器瞬时状态。

在 **设置 > 插件 > 插件列表 > 安装本地插件** 中选择 `plugins/workspace-files` 即可安装。只要该插件或其他依赖方仍处于启用状态，Desktop 就会激活插件外置的 Workspace 布局支持；最后一个依赖方停用或卸载后，profile-local package alias 会被移除，并恢复应用内置的 DSH 布局。

## 安全与限制

Host 提供方只接受已注册的 Workspace id，在所选 Workspace 根目录内解析路径，并拒绝路径穿越。

## 模型体验

无，因为该 bundle 只添加面向用户的文件浏览器，不注册模型可见输入或 tool。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- **只读访问** —— 该 bundle 提供浏览和预览操作，但不提供文件写入。
- **预览大小受限** —— 文本和图片读取受 Host 提供方的大小限制；该面板不是通用二进制文件查看器。
