# `@skylarking/dsh-client-ui-desktop-plugin-inventory`

[English](README.md) | 中文

仅供 Electron 启动的 DSH 使用、用于替换官方只读插件清单的私有 Desktop 集成包。Desktop overlay patch 会把该 Client 包挂载到现有插件设置标签页；它保留 Cordis 组件清单，并通过启用 context isolation 的 `window.dshDesktopPlugins` bridge 增加本地安装、启用、停用和经确认的卸载操作。

该包属于 Desktop 的通用插件管理支持，不是功能插件。它不会显示在用户管理的插件列表中，而且在没有 Desktop patch 的 DSH Web 中不会加载。

## 模型体验

无，因为该包只改变面向用户的设置界面。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- 插件变更会重启 Desktop 管理的 DSH 进程；该页面不会原地热替换 Host bundle。
