# @deepseek-ai/dsh-host-workspace-console

English | [中文](README.zh.md)

Persistent terminal Remote for registered Workspaces. `workspaceConsole/open` allocates a plugin-owned `node-pty` process with the selected Workspace's canonical path as `cwd`; `write`, `read`, `resize`, and `close` carry raw terminal input, offset-based bounded output, viewport changes, and awaited cleanup. The default shell is `/bin/zsh -l`, with a 2-second termination grace, 256 KiB retained output, 64 KiB input-call bound, and eight-session limit; all are Loader-validated configuration.

The external plugin publishes its strict Host descriptors from `./typert` and the matching Client contribution from `./remote`. Both artifacts share one plugin-owned descriptor list because the repository Typert generator scans official packages, not repository-tracked external plugins.

This plugin grants shell execution authority. It is separate from the read-only file gateway so deployments can remove its cordis.yml row without affecting file previews. Removing the plugin waits for pending opens, sends `SIGTERM` and then `SIGKILL` after the configured grace when needed, releases PTY listeners, and leaves no persistent terminal output.

## Model Experience

None, as this Remote is driven by the operator UI and does not register a model tool.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- A terminal has the Host process user's filesystem and process authority; Workspace selection controls only its initial working directory.
- Output reads retain only the configured byte tail. A reader whose offset falls behind that window receives the retained tail with `lossy: true`.
