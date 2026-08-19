# DeepSeek Harness Desktop

English | [中文](README.zh.md)

The macOS desktop application hosts the official DSH Web UI in an isolated Electron renderer and owns a bundled DSH runtime child process. The child binds an OS-assigned `127.0.0.1` port; the host waits for the CLI readiness line before loading that origin. The Web renderer has no Node.js integration and receives only narrow context-isolated Desktop bridges. The host creates a visible loading window before profile preparation and reports any startup-stage failure in a native dialog instead of leaving a headless application process. The host owns runtime startup, restart, shutdown, workspace selection, external navigation, and profile plugin lifecycle.

## Development

Run from the repository root:

```sh
pnpm desktop:dev
```

The command builds the Electron host and plugin-manager renderer, stages a self-contained DSH runtime, then starts the application. Use **File > Open Workspace** to change the child process working directory. The selected workspace lasts for the current application run.

## Plugin management

Use **Settings > Plugins > Plugin list** to install a local plugin directory into the shared `web` profile, disable or re-enable an installed plugin, and uninstall it. Desktop ships no feature plugins and does not add any to a new profile. Disable removes only the package from `dsh.profile.bundles`, preserving its dependency, source, and settings; uninstall removes the dependency and plugin-declared settings namespaces without deleting local source. The separate **Plugins > Manage Plugins** window remains available for source/profile opening and manual runtime restart.

An enabled plugin may declare profile-local package aliases through `dsh.desktop.supportPackages`. Desktop reconciles those aliases from the complete enabled-plugin set before each restart. Shared support remains active while any enabled plugin requires the same path, and removing the last requirement restores the runtime package bundled with DSH. Support aliases are implementation details and do not appear as separately manageable plugins.

The privileged plugin-manager renderer loads one packaged `file://` document behind a narrow preload API. The main Web renderer receives a second bridge limited to listing, local installation, enablement, and confirmed removal; IPC accepts it only from the owned main `webContents` at the active loopback origin. Local installation opens a native directory picker, and enable/disable/uninstall require native confirmation before the runtime or profile changes. Installed Host plugins still execute in the DSH Node.js runtime, and Client plugin bundles join the official UI renderer; this release does not provide a VS Code-style isolated Extension Host.

Plugins may declare a constrained Desktop overlay in their package manifest under `dsh.desktop.overlay`. The plugin owns its collapsed and expanded dimensions and its rendered Web surface. On macOS, the host creates a transparent non-focusable `panel`, keeps it above other applications, and makes it visible across Spaces and full-screen applications. A sandbox-compatible CommonJS preload exposes only movement and expansion. Overlay creation remains manifest-driven and the host destroys the window when its plugin leaves the profile, so removal leaves no overlay state behind. Ordinary official Web windows do not receive this bridge.

## Packaging

Build an unsigned local macOS application and DMG from the repository root:

```sh
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm desktop:package
```

Artifacts are written to `apps/desktop/release/`. Local builds can use ad-hoc signing. Distribution outside the development Mac requires an Apple Developer ID Application certificate, hardened-runtime signing, and notarization.

## Transport

The current host deliberately reuses the shipped browser carrier over a random loopback port because the Web client depends on HTTP routes, WebSockets, boot-manifest injection, and plugin bundle URLs. The channel-independent RPC layer permits a later `file://` client with an Electron IPC fetch carrier; that replacement is not part of this application yet.
