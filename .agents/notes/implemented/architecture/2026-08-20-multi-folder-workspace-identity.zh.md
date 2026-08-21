# Agent Note: 分离 workspace 身份与主要项目文件夹

Status: implemented

[English](2026-08-20-multi-folder-workspace-identity.md) | 中文

## 问题

多文件夹项目此前把第一个选择的目录保留为不可变的原生 workspace 路径，只在插件上下文中记录不同的 primaryPath。因此，新会话仍从第一个目录启动，Git 与配置发现仍跟随该目录，文件沙箱也不能写入附加目录。改变界面显示的主要文件夹不会改变执行语义。

Workspace 成员关系还要求每个会话头的 cwd 等于 workspace 路径。该规则把路径变成了身份键：改变主要文件夹会移除旧会话，即使它们仍属于同一个用户项目。

## 决策

- **Workspace id 负责项目身份。** 会话属于其持久 sessionIds 记录包含该会话的唯一 workspace。运行时 attach 与 detach 会跨 workspace 实体串行执行，重复归属会被拒绝。
- **Workspace path 是当前主要文件夹。** WorkspaceRegistry.setPath(id, path) 规范化一个现有目录，拒绝已被其他 workspace 占用的路径，并且只持久更新路径和修改时间。新会话使用当前路径作为 cwd。现有会话头保持不可变，其 workspace 归属也保持不变。
- **附加文件夹扩展写入权限。** SandboxExecutionPolicy.additionalWritableRoots 携带会话 cwd 之外的项目文件夹。同步 provider 通过 SandboxPolicyService.registerAdditionalWritableRoots() 按会话贡献当前根目录。解析会规范化并去重这些目录；文件系统、bwrap、Landlock、Seatbelt 和 Windows ACL 强制执行共同消费最终的项目根集合。
- **外部 multi-workspace 插件按 workspace id 持久化。** 项目记录包含 workspaceId、paths 和 primaryPath。创建时将选定的主要文件夹传给原生 workspace 创建。编辑时先更新原生 workspace 路径，再提交插件映射；如果插件持久化失败，则回滚路径。在另一个文件夹成为主要文件夹之前，当前主要文件夹不能被移除。
- **拒绝旧插件存储格式。** 带版本的对象格式替代无版本且以根路径为键的数组。仓库仍处于预发布阶段，因此不保留兼容读取器。

本决策取代外部[多 workspace 插件记录](https://github.com/Skylarking/dsh-plugin-workspace-multi/blob/main/AGENT_NOTE.md)中不可变原生根目录的假设；该记录仍负责插件加载、Remote 路由和 workspace 行菜单适配器。

## 验证

Workspace 测试覆盖主要路径验证与持久化、路径改变后的成员保留、重复归属拒绝，以及竞争 attach 的串行化。沙箱测试覆盖项目根目录规范化与去重、动态 provider 释放，以及 bwrap／Landlock 多根 profile。插件测试覆盖从选定主要文件夹创建原生 workspace、稳定 id RPC、路径更新回滚、附加根贡献、版本拒绝和编辑规则。

## 考虑过的替代方案

- **保持第一个文件夹不可变，只在提示词中把另一个文件夹描述为主要文件夹**：拒绝，因为 cwd、Git、指令发现和配置会与界面显示的主要文件夹不一致。
- **每个文件夹创建一个原生 workspace**：拒绝，因为一个用户项目的会话归属和项目级界面状态会被拆散。
- **主要文件夹改变时重写旧会话 cwd**：拒绝，因为会话头记录该任务的启动位置，不是可变项目配置。
- **通过 danger-full-access 授权附加文件夹**：拒绝，因为多文件夹项目仍必须在明确文件夹集合之外保持 workspace-write 限制。

## 后果

一个项目可以包含多个文件夹，而不与原生单目录 cwd 模型冲突：任一时刻只有一个主要文件夹，workspace id 则负责组合项目及其会话。改变主要文件夹会影响未来会话和从 workspace 路径开始的发现，但不会迁移活跃或历史任务。在 workspace-write 下，所有附加文件夹都可写，无关目录仍会被拒绝。
