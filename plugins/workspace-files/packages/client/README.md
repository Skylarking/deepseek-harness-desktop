# @deepseek-ai/dsh-client-ui-workspace-files

English | [中文](README.zh.md)

Reversible workspace file browser. The browser half adds a Project files icon to both `shell.hero.utilities` and `conversation.session.header.utilities`, then occupies the layout-owned `shell.rightPanel` split. A full-height directory tree and the bounded text or image preview always share the panel side by side, including at narrow panel widths, and their divider supports pointer and keyboard resizing. The toolbar accepts workspace-contained absolute or relative directory paths and presents the live client Workspace list in a compact filled selector. Both the inner and outer draggable boundaries highlight during interaction without covering the conversation.

The package owns only its button and panel content. Removing its cordis.yml row removes the button, closes and removes the split, and discards selection, expansion, and preview state without changing Workspace or Session data. Removing the Host gateway row also removes file-read authority.

## Model Experience

None, as this UI does not alter prompts, tools, messages, or provider requests.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- The preview is read-only and does not provide editing, search, syntax highlighting, or arbitrary binary rendering.
