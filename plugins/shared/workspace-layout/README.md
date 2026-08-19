# `@skylarking/dsh-client-ui-workspace-layout`

English | [中文](README.zh.md)

Private support package for the repository's Workspace files and terminal plugins. DeepSeek Harness Desktop installs it into the Web profile under the `@deepseek-ai/dsh-client-ui-layout` dependency key while at least one enabled plugin declares it through `dsh.desktop.supportPackages`. It preserves the official sidebar, conversation, details, overlay, theme, and `ctx.layout` behavior while adding `shell.hero.utilities`, `shell.rightPanel`, and `shell.bottomPanel` slots with resizable split geometry.

This package is not a separately manageable plugin and is not part of the Desktop release. Removing the last enabled dependent removes the profile-local alias, so the next DSH start resolves the official layout package bundled with the runtime.

## Model Experience

None, as the package changes only operator-controlled layout and registers no model-visible input.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- The package replaces one profile-local package resolution entry; it cannot be enabled independently of a feature plugin.
