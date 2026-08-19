# Agent Note: 可逆的工作空间文件与控制台界面

Status: implemented

[English](2026-08-17-reversible-workspace-file-and-console-surfaces.md) | 中文

## Problem

Desktop 界面需要工作空间文件检查和操作者命令控制台，但把任一行为嵌入 shell 都会导致插件移除后留下界面分支或 Host 权限。文件预览与 shell 执行的权限也有本质差异，不能共用一个能力。

## Decision

`plugins/` 下的两个可安装 bundle 分别拥有这两项功能。每个 bundle 都包含自己的 Host、Client 包和一个同时挂载二者的 patch。文件 Host 在已注册工作空间根目录下提供有界只读列表和预览方法，Client 拥有 Hero 与 Session 触发按钮和右侧分栏内容。全高目录树始终位于预览旁边，窄分栏下也会同时显示，两者之间的分隔线可以独立调节。地址栏只接受能够解析到所选工作空间内的绝对或相对路径。布局拥有的分栏边界与文件插件内部边界都只用高亮线反馈拖动，不显示独立的握柄图形。终端 Host 拥有以所选工作空间为初始目录的持久操作者 PTY，Client 拥有 Hero 与 Session 触发按钮、底部分栏 xterm 标签及其 PTY id。切换标签会保留每个 PTY，关闭标签只终止对应 PTY。

私有支持包 `plugins/shared/workspace-layout` 保留官方布局行为，并增加单占用方 `shell.rightPanel`、`shell.bottomPanel`、`shell.hero.utilities`、可拖动分栏几何以及打开/关闭动作，但不导入任一业务功能。已启用 bundle 的 manifest 会请求把它作为 `@deepseek-ai/dsh-client-ui-layout` 的 profile-local alias；最后一个依赖 bundle 停用或卸载后，Desktop 会移除该 alias。每个 Client 插件先挂载生成的 Remote 贡献，再启动一个显式注入相应 Remote namespace 的子插件；子插件随后在增强 Hero 和官方 Session utilities 中注册图标并占用一个分栏 slot。卸载时，子插件先关闭分栏，父插件再撤销 Remote namespace。终端包自己的构建配置会把 xterm 全局样式表归属到其 Client artifact，因此 Loader dispose 会同时删除依赖 CSS 与插件 CSS Modules。移除 bundle 会一并删除其触发按钮、面板、Remote route、Host 权限和瞬时状态。两个 bundle 都不写入工作空间或会话持久数据。

文件网关会规范化每个目标，并拒绝路径穿越和逃逸符号链接。终端刻意不描述为受限于工作空间：工作空间选择只确定初始 `cwd`，shell 仍拥有 Host 用户权限。它的 Host 使用插件自有的 `node-pty`，在 Remote 边界使用带品牌的操作者会话 id，为基于 offset 的轮询保留受 Loader 限制的输出尾部，并转发原始输入和视口 resize。每个 Client 标签都会串行发送原始输入 Remote 调用，避免传输延迟打乱 xterm 输入。Client 或 Host dispose 会中止待处理分配、移除输出 listener、终止每个已发布 PTY，并等待退出；超过配置的 grace period 后会从 `SIGTERM` 升级到 `SIGKILL`。

## Alternatives considered

**把两个功能实现直接加入 Desktop preload 和官方 shell。** 这会把业务行为绑定到单一容器，并在插件移除时留下显式的功能清理分支。最终设计把功能代码保留在外置 bundle 中，只通过可逆的布局 alias 引入增强分栏机制。

**使用一个合并的工作空间工具插件。** 文件读取有界且只读，shell 执行则拥有高权限。独立的 Host 与 Client 条目允许部署保留预览，同时删除全部控制台界面与执行端点。

**复用 Agent 拥有的终端注册表或官方 subprocess 包。** `ctx.terminals` 要求精确的存活 Agent owner，并承载模型工具的就绪、scrollback 与中断策略。为一个外置 UI 插件扩展官方 subprocess API 也会修改 `packages/`。终端 bundle 改为拥有更小的 `node-pty` 注册表及其完整释放行为。

**保留一次性 shell 执行。** 独立的 `shell -lc` 子进程会使每条命令无状态，无法提供 REPL、终端控制键或交互式应用。有界输出与显式 dispose 同样可以用于持久 PTY，而不必移除这些终端语义。

## Consequences

安装任一 bundle 都会增加可移除且与主窗口融合的文件浏览或交互式终端标签，不产生持久 schema 改动，也不修改官方包。布局测试固定右侧/底部分栏独立打开、两个拖动方向、关闭行为、原侧栏/详情栏几何不受影响及 slot 完整移除；Desktop 测试固定支持 alias 的生命周期；文件测试固定工作空间包含性和支持的预览；终端测试固定持久输入、基于 offset 的输出、resize、退出事实、会话限制以及已发布和待处理 PTY 的清理。Client 装配测试使用真实 Typert Remote service 固定 namespace 注入以及通过已注册分栏入口发起调用的行为；浏览器测试固定独立标签生命周期、xterm 输入、焦点、resize 和 unmount 关闭。Remote 输出使用有界轮询而不是流式订阅，终端 README 会披露选择工作空间并不构成文件系统沙箱。
