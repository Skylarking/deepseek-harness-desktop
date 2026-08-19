# Agent Note: Reversible workspace file and console surfaces

Status: implemented

English | [中文](2026-08-17-reversible-workspace-file-and-console-surfaces.zh.md)

## Problem

The Desktop surface needs workspace file inspection and an operator command console, but embedding either behavior in the shell would make plugin removal leave UI branches or Host authority behind. File preview and shell execution also have materially different authority and cannot share one capability.

## Decision

Two installable bundles own the features under `plugins/`. Each bundle contains its Host and Client packages and one patch that mounts them together. The file Host exposes bounded read-only list and preview methods under registered Workspace roots, while its Client owns Hero and Session triggers plus right-split content. Its full-height directory tree always sits beside the preview, including when the split is narrow, and their divider remains independently resizable. Its address bar accepts absolute or relative paths only when they resolve beneath the selected Workspace. Layout-owned split boundaries and the file plugin's inner boundary use highlight-only drag feedback without separate grip shapes. The terminal Host owns persistent operator PTYs rooted initially at selected Workspaces, while its Client owns Hero and Session triggers, bottom-split xterm tabs, and their PTY identities. Switching tabs preserves each PTY; closing a tab terminates only its PTY.

The private `plugins/shared/workspace-layout` support package preserves the official layout behavior and adds single-occupant `shell.rightPanel` and `shell.bottomPanel` slots, `shell.hero.utilities`, draggable split geometry, and open/close actions without importing either feature. Enabled bundle manifests request it as a profile-local alias for `@deepseek-ai/dsh-client-ui-layout`; Desktop removes that alias after the last dependent bundle is disabled or uninstalled. Each Client plugin first mounts its generated Remote contribution, then starts a child plugin that explicitly injects the resulting Remote namespace before registering its icon in the enhanced Hero and official Session utility lists and occupying one split slot. The child plugin closes its split during unload before the parent withdraws the Remote namespace. The terminal package's own build config attaches xterm's global stylesheet to its Client artifact, so Loader disposal removes dependency CSS with the plugin's CSS Modules. Removing a bundle therefore removes its triggers, panel, Remote route, Host authority, and transient state. Neither bundle writes Workspace or Session persistence.

The file gateway canonicalizes every target and rejects path traversal and escaping symlinks. The terminal is intentionally not described as workspace-confined: Workspace selection fixes the initial `cwd`, while the shell retains the Host user's authority. Its Host uses plugin-owned `node-pty`, brands operator session ids at the Remote boundary, retains a Loader-bounded output tail for offset polling, and forwards raw input and viewport resize. Each Client tab serializes its raw-input Remote calls so transport latency cannot reorder xterm input. Client or Host disposal aborts pending allocation, detaches output listeners, terminates every published PTY, and awaits exit, escalating from `SIGTERM` to `SIGKILL` after the configured grace period.

## Alternatives considered

**Add both feature implementations directly to Desktop preload and the official shell.** This would couple business behavior to one container and leave explicit feature cleanup branches when plugins are removed. The accepted design keeps feature code in external bundles and introduces enhanced split mechanics only through a reversible layout alias.

**Use one combined workspace utilities plugin.** File reading is bounded and read-only while shell execution is high authority. Separate Host and Client rows let deployments keep preview while removing every console surface and execution endpoint.

**Reuse the Agent-owned terminal registry or official subprocess packages.** `ctx.terminals` requires an exact live Agent owner and carries model-tool readiness, scrollback, and interruption policy. Extending official subprocess APIs for one external UI plugin would also modify `packages/`. The terminal bundle instead owns a smaller `node-pty` registry and its complete teardown behavior.

**Keep one-shot shell execution.** Separate `shell -lc` children make every command stateless and cannot provide REPLs, terminal control keys, or interactive applications. Bounded output and explicit disposal apply to a persistent PTY without removing those terminal semantics.

## Consequences

Installing either bundle adds removable, integrated file browsing or interactive terminal tabs without persistent schema changes or official package modifications. Layout tests pin independent right/bottom opening, both drag directions, closure, preservation of the original sidebar/details geometry, and complete slot removal. Desktop tests pin support-alias lifetime. File tests pin Workspace containment and supported previews; terminal tests pin persistent input, offset output, resize, exit facts, session limits, and cleanup of published and pending PTYs. Client assembly tests use the real Typert Remote service to pin namespace injection and calls through the registered split entries; browser tests pin independent tab lifetimes, xterm input, focus, resize, and unmount closure. Remote output uses bounded polling rather than a streaming subscription, and the terminal README discloses that selecting a Workspace is not a filesystem sandbox.
