# Agent Note: Electron desktop host and plugin management

Status: implemented

English | [中文](2026-08-16-electron-desktop-host-and-plugin-management.zh.md)

## Problem

The official DSH UI runs through `dsh web`, while macOS users need an application lifecycle, packaged runtime, workspace handoff, and local plugin management without granting the Web UI native filesystem authority. The existing [GUI layering decision](2026-07-19-gui-layering-and-rpc-protocol.md) separates client RPC semantics from carriers but does not supply an Electron host or an IPC carrier.

## Decision

`apps/desktop` is an Electron host with the same high-level process split as a native agent client: an isolated UI renderer, a separately supervised agent runtime process, and host-owned native operations. The application creates its loading window before profile preparation, sends every startup-stage failure to one native error dialog, and never leaves a startup-rejected process without a visible window. It packages a deployed `@deepseek-ai/dsh` dependency closure, launches it with `web --host 127.0.0.1 --port 0`, parses the CLI readiness line, and then loads the resulting loopback origin. Shutdown first drains serialized runtime operations, sends `SIGTERM` only to the owned child, and uses a bounded `SIGKILL` fallback.

The official Web renderer uses `contextIsolation`, Electron sandboxing, no Node.js integration, and a narrow preload bridge for profile-plugin lifecycle operations. The host accepts that bridge only from the owned main `webContents` at the active loopback origin. Installation opens a native directory picker, while enablement, disablement, and removal require native confirmation. External navigation is denied in the renderer and handed to the operating system.

The separate plugin-manager renderer loads one exact packaged `file://` URL. Its preload exposes only listing, local-directory installation, enablement, disablement, removal, source/profile opening, and runtime restart. Every IPC handler verifies both the owning `webContents` and exact sender-frame URL. Install and remove invoke the packaged CLI against the shared `web` profile, enablement changes the profile bundle list, and all runtime mutations pass through one FIFO operation queue.

## Plugin model

Desktop adds a VS Code-like management workflow, not VS Code's Extension Host isolation model. Host plugins execute inside the DSH Node.js runtime, while Client plugin bundles are loaded into the official Web renderer through the existing module registry. The settings page separates user-installed profile plugins from the read-only Cordis system-component inventory. Browser deployments without the Desktop bridge retain that read-only inventory.

Disabling a user plugin removes it from `dsh.profile.bundles` but retains its profile dependency, source, and settings so re-enabling restores its prior state. Removing a plugin deletes its profile dependency and declared settings namespaces but never deletes its local source directory. A dedicated out-of-process extension host, permission manifest, and isolated plugin WebViews remain separate security work.

An enabled plugin may declare `dsh.desktop.overlay` with a Web entry, collapsed dimensions, optional expanded dimensions, and optional initial coordinates. On macOS, Desktop creates one transparent non-focusable Electron `panel`, sets its level to `floating`, and makes it visible on every Space and over full-screen applications. Desktop destroys the panel when the plugin is disabled, leaves the profile, or the runtime restarts. A sandbox-compatible CommonJS preload gives the overlay renderer a narrow context-isolated bridge that moves the window by bounded deltas and switches between plugin-declared sizes while preserving its bottom-right anchor. The main Web renderer does not receive this overlay bridge, and IPC messages are accepted only from a live overlay window.

Desktop does not recognize pet names, sprite formats, task states, or plugin ids. A pet plugin owns Codex-compatible discovery under `~/.codex/pets`, animation, interaction state, and task presentation. Its client bundle suppresses itself in the ordinary Desktop Web surface and renders only in its declared overlay surface. Removing the plugin therefore removes the window and UI without leaving Desktop settings or plugin-specific code paths.

## Transport

The first Desktop release uses a random loopback HTTP/WebSocket carrier because the assembled Web UI requires static routing, boot-manifest transforms, plugin bundle endpoints, and WebSocket downlinks. The RPC design still permits a future `file://` renderer with an IPC implementation of the fetch carrier. Desktop does not claim that unimplemented carrier.

## Verification

Keyless tests cover explicit loading-window reveal order, visible failure handling for every startup stage, readiness parsing, split output, startup timeout child disposal, bounded startup capture, plugin discovery, exact privileged-frame checks, serialized runtime operations, macOS panel and Space behavior, overlay preload isolation, plugin-owned dimensions, and anchored expansion geometry. The checked-in Codex Pets Client artifact also mounts against the current keyed-settings and list-overlay slot declarations and proves both registrations unwind on unload. Packaging verification audits the staged dependency closure for links outside the runtime, launches the staged CLI under Electron-as-Node, loads the official UI in Electron, and starts the packaged application.

## Alternatives considered

**Load the Web dist directly with `file://`.** The current Web composition requires same-origin HTTP routes, WebSockets, index transforms, and plugin asset endpoints. Recreating only static loading would produce a partial application rather than reuse the official UI.

**Expose broad native authority to the official Web renderer.** General filesystem or process access would let any trusted Client bundle escape its UI role. The main renderer receives only profile-plugin lifecycle methods, native confirmation guards mutations, and the separate exact-document renderer retains source/profile opening and explicit runtime restart.

**Run the source checkout from Desktop.** A packaged application would depend on repository paths, pnpm workspace links, and developer tooling. A staged self-contained runtime makes the application independent of the checkout.

**Implement a specific pet inside Desktop.** Plugin removal would leave pet code, settings, and UI decisions in the host. A generic narrow overlay capability keeps product behavior in the installed plugin.

**Give an overlay renderer the Electron API.** Arbitrary installed Client code does not need filesystem, process, or general window authority. The narrow preload exposes only the two native operations needed by the declared surface.

## Consequences

The application delivers a native macOS lifecycle, shared-profile plugin workflow, and reversible screen-resident plugin surfaces while retaining the official Web UI and DSH plugin system. It also inherits a loopback listener and the current trusted-Client-plugin model: a loaded Client bundle shares the renderer that can request plugin lifecycle operations, although native confirmation guards mutations. Overlay plugins share one small native capability surface and remain responsible for their own UI and data formats. Runtime staging increases artifact size, local unsigned builds trigger normal macOS trust warnings, and public distribution remains dependent on Developer ID signing and Apple notarization.
