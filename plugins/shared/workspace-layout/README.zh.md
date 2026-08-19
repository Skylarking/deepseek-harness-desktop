# `@skylarking/dsh-client-ui-workspace-layout`

[English](README.md) | 中文

仓库内工作区文件与终端插件共用的私有支持包。只要至少一个已启用插件通过 `dsh.desktop.supportPackages` 声明该支持，DeepSeek Harness Desktop 就会在 Web profile 中把它安装到 `@deepseek-ai/dsh-client-ui-layout` dependency key。它保留官方 sidebar、conversation、details、overlay、theme 和 `ctx.layout` 行为，并增加带可调分栏几何的 `shell.hero.utilities`、`shell.rightPanel` 与 `shell.bottomPanel` slot。

该支持包不能作为独立插件管理，也不属于 Desktop 发布包。最后一个已启用依赖方消失后，Desktop 会删除 profile-local alias，下一次 DSH 启动将重新解析到 runtime 随附的官方布局包。

## 模型体验

无，因为该包只改变操作者控制的布局，不注册模型可见输入。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- 该包会替换一个 profile-local package resolution entry，不能脱离功能插件单独启用。
