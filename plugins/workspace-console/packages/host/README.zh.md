# @deepseek-ai/dsh-host-workspace-console

[English](README.md) | 中文

面向已注册工作空间的持久终端 Remote。`workspaceConsole/open` 通过插件自有的 `node-pty` 进程分配真实 PTY，并把所选工作空间的规范路径作为 `cwd`；`write`、`read`、`resize` 和 `close` 分别承载原始终端输入、基于 offset 的有界输出、视口变化和须等待的清理。默认 shell 为 `/bin/zsh -l`，终止宽限期为 2 秒，保留输出上限为 256 KiB，单次输入上限为 64 KiB，会话上限为八个；这些参数都经过 Loader 配置校验。

此外置插件通过 `./typert` 发布严格的 Host 描述符，并通过 `./remote` 发布对应的 Client contribution。两个产物共用一份插件自有的描述符列表，因为仓库 Typert generator 只扫描官方 package，不扫描由仓库跟踪的外置插件。

此插件会授予 shell 执行权限。它与只读文件网关保持独立，因此部署可以删除其 cordis.yml 条目而不影响文件预览。移除插件时会等待正在打开的会话，先发送 `SIGTERM`，必要时在配置的宽限期后发送 `SIGKILL`，随后释放 PTY listener，且不会留下持久终端输出。

## 模型体验

无，因为此 Remote 由操作者界面驱动，不注册模型工具。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- 终端拥有 Host 进程用户的文件系统和进程权限；工作空间选择只控制初始工作目录。
- 输出读取只保留配置的字节尾部。读取方的 offset 落后于该窗口时，会收到保留尾部和 `lossy: true`。
