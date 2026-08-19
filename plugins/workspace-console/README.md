# `@deepseek-ai/dsh-workspace-console`

English | [中文](README.zh.md)

Repository-tracked external plugin bundle for the Workspace terminal. It is not part of the DSH or Desktop release dependency closure. Its patch mounts the persistent [`dsh-host-workspace-console`](packages/host/README.md) PTY Remote and the [`dsh-client-ui-workspace-console`](packages/client/README.md) bottom-panel UI together. While the bundle is enabled, Desktop installs those loader packages and the shared Workspace layout as managed profile aliases. Disabling or uninstalling the bundle removes the aliases, Remote route, new-session and session-header triggers, open panel, PTY processes, and retained output as one plugin lifecycle.

Install it from **Settings > Plugins > Plugin list > Install local plugin** by selecting `plugins/workspace-console`. Desktop activates the plugin's external Workspace layout support while this or another dependent plugin is enabled. Disabling or uninstalling the last dependent removes that profile-local package alias and restores the bundled DSH layout.

## Security and limits

The Host executor accepts only registered Workspace ids and starts the terminal with the selected Workspace as its initial working directory. The PTY retains the Host user's filesystem and process authority; Workspace selection is not a sandbox.

## Model Experience

None, as commands originate from direct user input in the console and do not enter an agent turn.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- **Bounded retained output** — the Host keeps only the configured terminal-output byte tail for polling clients.
- **Unary Remote transport** — terminal output reaches xterm through polling rather than a streaming subscription.
