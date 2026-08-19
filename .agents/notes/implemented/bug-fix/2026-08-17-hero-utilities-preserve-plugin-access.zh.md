# Agent Note: Hero 工具保持插件入口可用

Status: implemented

[English](2026-08-17-hero-utilities-preserve-plugin-access.md) | 中文

## Problem

空页面和空白 Session Hero 会隐藏 Session 页头。工作空间面板插件需要在 Session 产生对话历史之前提供触发按钮，但官方 Hero 没有通用 utilities list；如果只在 `conversation.session.header.utilities` 中注册，就无法在这个阶段打开面板，尽管两项能力操作的是 Workspace 而不是 Session 内容。

## Decision

外置的 `plugins/shared/workspace-layout` 包声明根作用域的 `shell.hero.utilities` 列表，并将其渲染在 Hero 右上角，而不修改官方 conversation 包。工作空间面板插件会在该列表和官方会话作用域的 `conversation.session.header.utilities` 列表中注册同一个触发组件。增强布局启用且没有非空白 Session 拥有页头时显示 Hero 入口；Session 入口仍是活动会话阶段的位置。

两项注册仍然都是插件 effect。卸载工作空间面板插件会删除其 Hero 与 Session 触发按钮、关闭布局分栏，并丢弃瞬时面板状态。停用最后一个依赖增强布局的插件会移除 profile alias，并在下次 runtime 启动时恢复官方布局包。

## Alternatives considered

**修改官方 conversation Hero。** 拒绝，因为可选的外置功能会在 `packages/client/ui-conversation` 中留下永久 slot 与渲染分支。

**在 Hero 阶段显示 Session 页头。** 拒绝，因为空白 Session 有意隐藏标题和标签页界面；恢复整个页头会加入空的 Session 上下文，并移动居中的 Hero 布局。

**把控件放入 composer。** 拒绝，因为目标位置是右上角工具区，而 composer 控件属于消息输入，不属于 Workspace 面板。

## Consequences

工作空间工具在新会话、空白会话和活动会话中均可访问，且不修改官方 conversation 代码。需要覆盖两个阶段的插件会注册两个工具列表；卸载插件会通过同一 Cordis fiber 反转两项贡献。布局与插件测试固定了 Hero 渲染、文件浏览与终端插件的双重注册、alias 移除和销毁行为。
