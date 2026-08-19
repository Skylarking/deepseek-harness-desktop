# @deepseek-ai/dsh-client-ui-workspace-console

English | [中文](README.zh.md)

Reversible operator terminal surface. The browser half contributes a Command console icon to both `shell.hero.utilities` and `conversation.session.header.utilities`, then occupies the layout-owned `shell.bottomPanel` split. Each tab mounts xterm with a fit addon, serializes raw keyboard data to its own persistent `workspaceConsole` PTY in arrival order, polls offset-based output, and sends row and column changes after the split resizes. Adding a tab inherits the active tab's Workspace, while switching tabs preserves both shell sessions. Operators can use shell state, REPLs, terminal control keys, and interactive programs inside each selected Workspace's initial directory.

The mounted panel owns every tab's PTY identity. Closing a tab terminates only its session; changing that tab's Workspace replaces its session; closing the panel or unloading the plugin terminates all remaining sessions. Visibility, tabs, and geometry are transient layout state. Removing its cordis.yml row closes the split and removes the button and terminals; removing the separate Host row revokes terminal authority and awaits Host-side process cleanup. Neither uninstall path changes Workspace or Session persistence.

## Model Experience

None, as this operator surface does not alter prompts, tools, messages, or provider requests.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- Output reaches xterm through bounded polling rather than a streaming Remote subscription; the Host retains only its configured byte tail while the panel is disconnected or delayed.
