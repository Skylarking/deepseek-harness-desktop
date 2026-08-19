# DeepSeek Harness Desktop

English | [中文](README.zh.md)

**A macOS desktop application for DeepSeek Harness.**

DeepSeek Harness Desktop brings the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) agent experience into a standalone application. It includes the DSH runtime and Web UI, manages its own local service, and supports installable plugins that can extend the application without permanently changing it.

This project is independently maintained and is not an official DeepSeek release.

## Features

### A desktop form that reuses the complete DSH stack

Running DSH directly starts the local Web service from a terminal and opens its interface in an external browser:

```text
Terminal
└── npx @deepseek-ai/dsh web
    └── starts local dsh web
        └── External browser
            └── DSH Web UI
                └── DSH Core
                    └── Cordis
```

DeepSeek Harness Desktop packages the same path inside Electron:

```text
Electron Desktop
└── starts bundled dsh web
    └── Electron window
        └── DSH Web UI
            └── DSH Core
                └── Cordis
```

The Desktop therefore reuses the original DSH Web UI, DSH Core, and Cordis runtime. Electron supplies the macOS application window and manages the bundled `dsh web` process; it does not replace the existing agent implementation.

### Self-contained local runtime

The installed application includes the DSH runtime and starts its local service automatically. Opening and closing the Desktop also starts and stops the process it owns, so ordinary use does not require Node.js, `npx`, or a separately managed Web server.

### Reversible plugin management

Desktop treats changes to the application interface and runtime as plugin-owned contributions rather than permanent modifications to the application itself. Panels, settings, Host capabilities, and native overlays exist only while the plugin that contributes them is enabled.

- **Disable:** removes the plugin from the active composition and disposes its interface and runtime contributions, while preserving its installation, source, and settings. Re-enabling it restores the same plugin with its previous configuration.
- **Uninstall:** removes the plugin dependency and active contributions, then deletes the settings namespaces declared by that plugin. Desktop-managed UI and runtime state return to the form they had before installation, without changing Workspace data, Sessions, unrelated settings, local plugin source, or user assets.

#### How reversibility works

Reversibility follows ownership recorded in manifests instead of relying on code that tries to reconstruct the previous interface:

1. The Web profile's `dependencies` records which plugin packages are installed, while `dsh.profile.bundles` records which of them participate in the active composition. Disabling a plugin changes only the bundle list, so its package and configuration remain available for an exact re-enable.
2. A bundle mounts its Host and Client plugins into the Cordis plugin tree. Routes, services, listeners, settings cards, and UI slots are lifecycle registrations owned by that tree. After a plugin-management change, Desktop restarts its managed DSH runtime from the updated bundle list, so a disabled or removed plugin contributes nothing to the new runtime.
3. A plugin that needs a replaceable Host package declares it through `dsh.desktop.supportPackages`. Desktop installs the profile-local alias only while at least one enabled plugin requires it. Disabling or uninstalling the last dependent removes the alias, so normal package resolution restores the DSH implementation bundled with the application.
4. Desktop-native windows are not permanent patches to the Web UI. A plugin declares an overlay through `dsh.desktop.overlay`; Desktop creates it only for an enabled plugin and destroys it when that plugin leaves the active profile.
5. A plugin declares the settings it owns through `dsh.settings.namespaces`. Uninstall removes only those namespaces together with the package dependency. Workspace data, Sessions, other plugins' settings, local source directories, and user-installed assets remain outside that cleanup.

## Plugins

Workspace files, Terminal, and Codex pets are repository-tracked external plugins. They are not included in the Desktop release and appear only after the user installs their local plugin directories. Each plugin owns the interface and runtime resources described below, and plugin management removes those contributions when the plugin is disabled or uninstalled.

### Project files

The Workspace files plugin adds a resizable right-hand panel with a directory tree, path navigation, and side-by-side preview for text and common image formats. The panel remains available while a Session is open and does not cover the conversation.

### Terminal

The Terminal plugin adds a resizable bottom panel with multiple terminal tabs. Every tab is backed by an independent persistent PTY, so shells, REPLs, control keys, and interactive programs behave like a real terminal.

### Desktop pets

The optional Codex pets plugin loads Codex-compatible `pet.json` assets and displays an animated companion above other applications and full-screen Spaces. It supports pet selection, scaling, dragging, and Session activity states. Removing the plugin also removes its window and settings without deleting user-installed pet assets.

See the [workspace files reference](plugins/workspace-files/README.md), [Terminal reference](plugins/workspace-console/README.md), [desktop application reference](apps/desktop/README.md), and [pet plugin reference](plugins/codex-pets/README.md) for detailed behavior and limitations.

<a id="run"></a>

## Run from source

Install Node.js `^22.19` or `>=24` and pnpm, then run from the repository root:

```sh
pnpm install
pnpm desktop:dev
```

The command builds the Electron host and renderers, stages a self-contained DSH runtime, and starts the application. Use **File > Open Workspace** to select the directory used by the managed runtime. Open **Settings > Models** to configure DeepSeek or another supported endpoint, then create a Session and assign a task.

To run the upstream-style Web application without Electron:

```sh
pnpm dsh web
```

## Package for macOS

Build an unsigned local application and DMG:

```sh
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm desktop:package
```

Artifacts are written to `apps/desktop/release/`. The current package targets Apple Silicon Macs. An ad-hoc build is suitable for development on the build Mac; public distribution requires a Developer ID Application signature, hardened runtime, Apple notarization, and a Gatekeeper assessment. Release DMGs belong in GitHub Releases rather than Git history.

## Security and limitations

- The main Web renderer has no Node.js integration and receives only narrow context-isolated Desktop bridges.
- Installed Host plugins execute inside the DSH Node.js runtime, and Client plugin bundles join the Web renderer. This project does not provide an isolated extension host.
- Native overlays are manifest-driven and receive only movement, sizing, visibility, and expansion controls; the ordinary Web renderer does not receive that bridge.
- Windows and Linux desktop installers are not currently provided.

## Relationship to upstream

DeepSeek Harness Desktop is an unofficial macOS distribution based on [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). This repository maintains the desktop host and its desktop-specific plugins while integrating applicable upstream updates. The underlying Harness remains a developer preview and may introduce compatibility-breaking changes.

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md). Desktop-specific behavior is documented in [apps/desktop](apps/desktop/README.md).

For agents, follow [AGENTS.md](AGENTS.md).

## License

This downstream project retains the upstream [MIT License](LICENSE). Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
