# `@deepseek-ai/dsh-workspace-files`

English | [中文](README.zh.md)

Repository-tracked external plugin bundle for the Workspace file browser. It is not part of the DSH or Desktop release dependency closure. Its patch mounts the bounded read-only [`dsh-host-workspace-files`](packages/host/README.md) Remote provider and the [`dsh-client-ui-workspace-files`](packages/client/README.md) right-panel UI together. While the bundle is enabled, Desktop installs those loader packages and the shared Workspace layout as managed profile aliases. Disabling or uninstalling the bundle removes the aliases, Host routes, new-session and session-header triggers, open panel, and transient browser state as one plugin lifecycle.

Install it from **Settings > Plugins > Plugin list > Install local plugin** by selecting `plugins/workspace-files`. Desktop activates the plugin's external Workspace layout support while this or another dependent plugin is enabled. Disabling or uninstalling the last dependent removes that profile-local package alias and restores the bundled DSH layout.

## Security and limits

The Host provider accepts only registered Workspace ids, resolves paths beneath the selected Workspace root, and rejects traversal.

## Model Experience

None, as the bundle adds a human-facing file browser and registers no model-visible input or tool.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- **Read-only access** — the bundle provides browsing and preview operations but no file writes.
- **Bounded previews** — text and image reads use the Host provider's size limits; the panel is not a general binary-file viewer.
