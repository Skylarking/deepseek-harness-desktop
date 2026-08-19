# @deepseek-ai/dsh-host-workspace-files

English | [中文](README.zh.md)

Read-only Remote gateway for files below registered Workspace roots. `workspaceFiles/list` returns one bounded directory level and `workspaceFiles/read` returns bounded UTF-8 text or PNG, JPEG, GIF, and WebP image data. Both methods resolve the Workspace from `ctx.workspaceRegistry`, canonicalize the target with `fs.realpath`, and reject absolute paths, parent traversal, unknown Workspaces, and symlinks that escape the root.

The external plugin publishes its strict Host descriptors from `./typert` and the matching Client contribution from `./remote`. Both artifacts share one plugin-owned descriptor list because the repository Typert generator scans official packages, not repository-tracked external plugins.

Generated and metadata directories such as `.git`, `node_modules`, `dist`, and `lib` remain visible but are marked ignored so the client does not expand them. Listings return at most 500 entries, text at most 1 MiB, and images at most 5 MiB. The package has no write, delete, rename, or native-open operation.

## Model Experience

None, as this Host Remote does not contribute model input or tools.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- Text previews require valid UTF-8; unsupported binary files are identified without transmission.
- Directory and byte bounds are security constants rather than deployment tuning because they cap untrusted Remote responses.
