# `@skylarking/dsh-client-ui-desktop-plugin-inventory`

English | [中文](README.zh.md)

Private Desktop integration package that replaces the official read-only plugin inventory only for Electron-launched DSH. The Desktop overlay patch mounts this Client package in the existing Plugins settings tab; it keeps the Cordis component inventory and adds local installation, enable, disable, and confirmed uninstall actions through the context-isolated `window.dshDesktopPlugins` bridge.

The package is part of Desktop's generic plugin-management support, not a feature plugin. It is hidden from the user-managed plugin list and does not load when DSH Web runs without the Desktop patch.

## Model Experience

None, as the package changes only the human settings interface.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- Plugin mutations restart the Desktop-owned DSH process; the page does not hot-swap Host bundles in place.
