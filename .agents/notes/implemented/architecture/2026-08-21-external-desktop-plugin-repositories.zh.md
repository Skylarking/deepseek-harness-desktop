# Agent Note: Desktop 功能插件使用独立仓库

Status: implemented

[English](2026-08-21-external-desktop-plugin-repositories.md) | 中文

## 问题

Sidebar Dock、宠物和其他可选界面功能必须可以单独安装，不能让 Desktop 发布包拥有它们的源码、依赖或发布节奏。把插件包放在根 workspace 中会使主锁文件、TypeScript 程序、仓库检查和暂存运行时依赖本地插件目录，即使应用并不随包提供这些插件。

## 决策

- **Desktop 不随包提供功能插件。** 它的运行时依赖闭包包含 DSH Web 应用和通用插件生命周期支持，但不包含可选的 Sidebar、宠物或 renderer bundle。新 profile 不会自动收到 Desktop 功能插件。
- **每个功能插件拥有独立仓库。** [DSH Plugins 集合](https://github.com/Skylarking/dsh-plugins)通过 Git submodule 固定各插件仓库，供用户发现和统一检出。Desktop 的根 workspace、锁文件、TypeScript project reference、Knip 配置和运行时暂存都不包含这些仓库。开发者可以把忽略跟踪的插件 checkout 放在 `plugins/` 下进行本地安装测试，但它们不会成为 Desktop 源码。
- **插件拥有完整的运行时扩展。** 可安装的 plugin bundle 包含自己的 Host 与 Client 包，并声明上游 Harness 依赖。`dsh-sidebar` 同时拥有两个 Dock、文件与终端视图、持久 PTY 与有界文件 Remote，以及共享的视图注册 API。插件的 UI slot、route、service、listener、设置 namespace、原生 overlay 和支持包 alias 只在该插件参与活跃 profile 期间存在。
- **Sidebar 合并展示层但不合并权限。** 一个 `dsh-sidebar` 生命周期挂载可调整大小的右侧与底部 Dock，以及允许任一 Dock 承载文件或终端标签的 catalog。文件 Remote 会规范化目标、拒绝路径穿越和逃逸符号链接，并把有界预览限制在已注册 Workspace 根目录下。终端 Remote 创建插件拥有的持久 PTY，其初始目录是所选 Workspace，但进程权限仍属于 Host 用户。关闭插件会释放两个 Dock、瞬时标签状态、待处理文件工作，以及所有已发布或正在分配的 PTY；插件不写入 Workspace 或 Session 持久数据。
- **Desktop 拥有通用生命周期操作。** 原生插件管理器负责安装用户选择的本地包目录，启用或停用其 profile bundle，卸载其依赖，在卸载时清理插件声明的设置，同步已启用插件需要的支持包 alias，并重启受管 DSH 运行时。Desktop 不依赖插件提供的清单替换包来提供这些操作。
- **替换行为需要显式声明且可逆。** 插件可以声明 `dsh.desktop.replacement` 与 `dsh.desktop.conflicts`。Desktop 在启用替换插件前请求确认，记录已启用冲突 bundle 及其顺序，停用这些 bundle，并在替换插件停用或卸载时恢复它们。冲突通过包名或声明的支持包匹配识别；无关 bundle 保持不变。
- **旧默认插件按来源精确移除。** 升级时，Desktop 只移除旧 `dsh.desktop.defaultPlugins` 记录中、且 dependency 确实解析到当前 Desktop 运行时内的包。从其他本地路径安装的同名插件会继续保留，随后 Desktop 删除已经废弃的记录字段。

## 验证

Desktop 测试覆盖本地插件发现、启用、停用、卸载清理、支持包同步、替换确认状态、原顺序恢复，以及对运行时自带旧默认插件的精确移除。Desktop 类型检查与构建验证应用不依赖外部插件 workspace alias 或包也能编译和暂存运行时。锁文件与 Git 检查验证 Desktop 仓库中没有 `plugins/` importer 或受跟踪的插件源码。Sidebar 仓库负责测试独立 Dock 几何、视图注册、标签生命周期、限制在 Workspace 内的文件访问、持久 PTY 输入与 resize、有界输出轮询，以及完整资源释放。

## 曾考虑的替代方案

- **把 Sidebar Dock 作为第一方默认插件随包提供**：否决，因为 Desktop 发布包会分发可选界面功能，并使其依赖进入每个安装包。
- **把插件源码留在 Desktop workspace 中但不暂存**：否决，因为根锁文件、编译程序和仓库检查仍会把独立插件与 Desktop 开发及发布耦合在一起。
- **继续把文件与终端作为两个独立功能插件**：否决，因为两种视图使用同一个双 Dock 标签模型，并且都必须能添加到任一 Dock。单个生命周期拥有该组合，独立 Remote 则保留不同的文件与进程权限。
- **只移动可安装的 bundle 包装层**：否决，因为把 Host provider 或 Client UI 留在主仓库，仍会以不同目录布局保留相同的源码与构建依赖。
- **随插件源码一起移除 Desktop 生命周期支持**：否决，因为原生 overlay、profile 修改、设置清理和可逆替换仍需要通用应用宿主，即使功能实现位于外部仓库。
- **只按包名移除旧默认插件**：否决，因为用户可能用相同包名安装外部 checkout。

## 后果

Desktop 与每个插件可以独立确定版本、运行测试和发布。克隆 Desktop 会得到干净的应用 workspace 与锁文件；递归克隆插件集合会得到可选的插件开发目录树。插件必须声明自己拥有的全部包与生命周期资源，其仓库必须运行自己的构建和测试。跨仓库兼容性改为显式管理，不再由 Desktop monorepo 强制保证；停用或卸载插件仍会恢复应用组合，不会修改无关 profile 数据或本地插件源码。Sidebar 标签顺序与几何属于瞬时状态，终端输出使用有界轮询而不是流式 Remote 订阅。
