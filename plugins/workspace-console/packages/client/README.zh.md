# @deepseek-ai/dsh-client-ui-workspace-console

[English](README.md) | 中文

可逆的操作者终端界面。浏览器半边同时向 `shell.hero.utilities` 和 `conversation.session.header.utilities` 贡献“命令行控制台”图标，并占用布局拥有的 `shell.bottomPanel` 分栏。每个标签都挂载带 fit addon 的 xterm，按照到达顺序把原始键盘数据串行转发到自己持久的 `workspaceConsole` PTY，通过基于 offset 的轮询读取输出，并在分栏尺寸变化后发送行列数。新增标签会继承当前标签的工作空间，切换标签会保留两个 shell 会话。操作者可在每个所选工作空间的初始目录内使用 shell 状态、REPL、终端控制键和交互式程序。

已挂载面板拥有每个标签的 PTY id。关闭标签只终止对应会话；改变该标签的工作空间会替换其会话；关闭面板或卸载插件会终止全部剩余会话。可见性、标签和几何信息属于瞬时布局状态。删除其 cordis.yml 条目会关闭分栏并删除按钮与终端；删除独立 Host 条目会撤销终端权限，并等待 Host 侧进程清理完成。两种卸载路径都不改变工作空间或会话持久数据。

## 模型体验

无，因为此操作者界面不改变提示词、工具、消息或提供方请求。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- 输出通过有界轮询而不是流式 Remote 订阅抵达 xterm；面板断开或延迟期间，Host 只保留配置的字节尾部。
