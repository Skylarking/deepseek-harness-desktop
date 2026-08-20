# Agent Note：Desktop 功能插件保持在发布包之外

Status: implemented

[English](2026-08-18-repository-tracked-external-desktop-plugins.md) | 中文

## 问题

工作区文件与终端原先从 Desktop runtime 中的包安装，并自动出现在新 profile 中。这使应用发布包拥有了这些功能，但产品目标是保持 Desktop 宿主干净，只有单独安装的插件才能改变其界面。只把 bundle 外壳移出 `packages/`，仍会让 Host provider、Client UI 与核心 Remote 装配依赖它们。

## 决策

- **Desktop 不随包提供功能插件。** 它的 runtime 依赖闭包包含 DSH Web 应用与通用插件生命周期支持，但不包含工作区文件、终端或宠物 bundle。新 profile 不会收到 Desktop 默认插件；插件管理只安装用户选择的目录。
- **外置插件源码继续保存在本仓库。** `plugins/workspace-files`、`plugins/workspace-console` 与 `plugins/codex-pets` 是受 Git 跟踪的开发源码。每个 Workspace 插件根目录都是可安装 bundle，并在 `packages/` 子目录中包含自己的 Host 与 Client 包。插件自有包名与 Remote 标识使用 `@skylarking` scope；其 manifest 中的 `@deepseek-ai` 名称只表示上游 Harness 依赖与可逆的官方布局 alias。加入 workspace 可以让仓库统一构建这些源码，但不会让它们成为 CLI 或 Desktop 的发布依赖。
- **插件拥有完整运行时扩展。** 每个 Workspace Client 在共享 Client Remote service 可用后挂载自己生成的 Remote 贡献。核心 `dsh-api-remotes` 装配不再导入这两个外置插件，也不保留其类型、依赖或 project reference。
- **Workspace 布局变化使用可逆的包别名。** 文件与终端 manifest 通过 `dsh.desktop.supportPackages` 声明所需的 profile-local package alias。Desktop 把这些别名记录在 `dsh.desktop.managedSupportPackages` 中，不在用户插件列表中显示它们，并在最后一个依赖该别名的已启用插件被停用或卸载后移除别名。支持包命令会原样保留功能 bundle 的启停列表；移除时会同时删除 manifest dependency 与 profile symlink，使下次启动解析到 Web runtime 原有的布局包。
- **终端插件拥有自己的 PTY。** `plugins/workspace-console` 直接使用 `node-pty` 管理终端创建、输入、resize、退出与等待完成的释放过程。官方 subprocess 与 terminal 包保持不变。
- **Desktop 专用管理功能属于支持包。** `plugins/shared/desktop-plugin-inventory` 通过 `apps/desktop/desktop.patch.yml` 替换只读 Web 插件清单；普通 `dsh web` 仍使用官方清单。`plugins/shared/workspace-layout` 与插件清单包为宿主和外置插件提供支持，但不是可独立安装的功能插件。
- **旧默认插件按来源精确移除。** 升级时，Desktop 只会移除旧 `dsh.desktop.defaultPlugins` 记录中、且 dependency 确实解析到当前 Desktop runtime 内的包。从其他本地路径安装的同名插件会继续保留，随后删除已经废弃的记录字段。

## 验证

Desktop 测试覆盖 runtime 所有旧默认插件的精确移除、外部替代插件的保留、支持别名同步时不重新启用功能 bundle、profile link 清理，以及不在受管理插件列表中显示支持别名。插件生命周期测试覆盖 Client 自行挂载 Remote、UI 注册的可逆释放，以及真实 PTY 的输入、输出、resize、退出和释放。组件测试覆盖 Desktop 生命周期控件与浏览器只读回退。Desktop 暂存检查验证其 runtime 依赖闭包包含插件管理支持包，但不包含三个功能插件 bundle 或 Workspace 布局包。

## 曾考虑的替代方案

- **继续把工作区文件与终端作为第一方默认插件**：否决，因为 Desktop 发布包仍会拥有并分发可选界面功能。
- **只移动 bundle 目录**：否决，因为核心 Remote 装配以及留下的 Host、Client 包仍会让产品依赖这些插件。
- **立即把每个插件拆到独立 Git 仓库**：否决，因为源码所有权与发布所有权相互独立；当前仓库可以评审和测试外置插件，而不把它们打进 Desktop。
- **按包名删除所有旧默认插件**：否决，因为用户可能已经用同名的外部检出目录替换了之前的默认插件。

## 后果

干净安装的 Desktop 只显示通用 DSH 界面和插件管理器。用户需要从 `plugins/` 显式安装这三个仓库插件中的任意一个。插件启用时可以增加 overlay、设置 namespace 或 Workspace 面板；停用或卸载会移除其注册效果，卸载还会删除其声明的设置。共享包别名只会在至少一个已启用插件需要时存在。仓库开发流程仍可编译外置插件包，但 DSH 与 Desktop 发布不再把功能插件作为产品依赖发布或暂存。
