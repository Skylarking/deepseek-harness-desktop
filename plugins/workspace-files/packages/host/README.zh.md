# @deepseek-ai/dsh-host-workspace-files

[English](README.md) | 中文

已注册工作空间根目录之下文件的只读 Remote 网关。`workspaceFiles/list` 返回有界的单层目录，`workspaceFiles/read` 返回有界的 UTF-8 文本或 PNG、JPEG、GIF、WebP 图片数据。两个方法都会通过 `ctx.workspaceRegistry` 解析工作空间，用 `fs.realpath` 规范化目标，并拒绝绝对路径、父级穿越、未知工作空间和逃逸根目录的符号链接。

此外置插件通过 `./typert` 发布严格的 Host 描述符，并通过 `./remote` 发布对应的 Client contribution。两个产物共用一份插件自有的描述符列表，因为仓库 Typert generator 只扫描官方 package，不扫描由仓库跟踪的外置插件。

`.git`、`node_modules`、`dist`、`lib` 等生成或元数据目录仍会显示，但被标记为忽略，因此客户端不会展开。目录最多返回 500 项，文本最多 1 MiB，图片最多 5 MiB。本包不提供写入、删除、重命名或原生打开操作。

## 模型体验

无，因为此 Host Remote 不贡献模型输入或工具。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- 文本预览要求有效 UTF-8；不支持的二进制文件只返回类型判断，不传输内容。
- 目录与字节限制属于限制不可信 Remote 响应的安全常量，而不是部署调优参数。
