# Agent Note: Desktop feature plugins use independent repositories

Status: implemented

English | [中文](2026-08-21-external-desktop-plugin-repositories.zh.md)

## Problem

Sidebar docks, pets, and other optional interface features must be installable without making the Desktop release own their source, dependencies, or release cadence. Keeping plugin packages in the root workspace makes the main lockfile, TypeScript programs, repository checks, and staged runtime depend on local plugin directories even when the application does not ship those plugins.

## Decision

- **Desktop ships no feature plugins.** Its runtime dependency closure contains the DSH Web application and generic plugin lifecycle support, but no optional Sidebar, pet, or renderer bundle. A new profile receives no Desktop feature plugin automatically.
- **Each feature plugin owns an independent repository.** The [DSH Plugins collection](https://github.com/Skylarking/dsh-plugins) pins the repositories as Git submodules for discovery and coordinated checkout. The Desktop root workspace, lockfile, TypeScript project references, Knip configuration, and runtime staging do not include those repositories. A developer may keep ignored plugin checkouts under `plugins/` for local installation tests without making them Desktop source.
- **Plugins own their complete runtime contribution.** An installable plugin bundle contains its Host and Client packages and declares its upstream Harness dependencies. `dsh-sidebar` owns both docks, their file and terminal views, the persistent PTY and bounded file Remotes, and their shared view registration API. Plugin UI slots, routes, services, listeners, settings namespaces, native overlays, and support-package aliases exist only while that plugin participates in the active profile.
- **Sidebar combines presentation without combining authority.** One `dsh-sidebar` lifecycle mounts the resizable right and bottom docks and a catalog that permits either dock to host file or terminal tabs. The file Remote canonicalizes targets, rejects traversal and escaping symlinks, and bounds previews beneath registered Workspace roots. The terminal Remote creates persistent plugin-owned PTYs whose initial directory is the selected Workspace but whose process authority remains that of the Host user. Closing the plugin disposes both docks, their transient tab state, pending file work, and every published or allocating PTY; it writes no Workspace or Session persistence.
- **Desktop owns generic lifecycle operations.** The native plugin manager installs a selected local package directory, enables or disables its profile bundle, uninstalls its dependency, removes plugin-declared settings on uninstall, reconciles enabled support-package aliases, and restarts the managed DSH runtime. Desktop does not require a plugin-provided inventory replacement to expose these operations.
- **Replacement is explicit and reversible.** A plugin may declare `dsh.desktop.replacement` and `dsh.desktop.conflicts`. Desktop asks for confirmation before enabling the replacement, records the enabled conflicting bundles and their order, disables them, and restores them when the replacement is disabled or uninstalled. Package-name and declared support-package matches identify conflicts; unrelated bundles remain unchanged.
- **Retired defaults are removed narrowly.** On upgrade, Desktop removes a package recorded in the former `dsh.desktop.defaultPlugins` ledger only when its dependency resolves inside the active Desktop runtime. A same-named plugin installed from another local path remains installed. Desktop then removes the obsolete ledger.

## Verification

Desktop tests cover local plugin discovery, enablement, disablement, uninstall cleanup, support-package reconciliation, replacement confirmation state, restoration order, and narrow retirement of runtime-owned defaults. The Desktop typecheck and build verify that the application compiles and stages its runtime without external plugin workspace aliases or packages. Lockfile and Git checks verify that no `plugins/` importer or tracked plugin source remains in the Desktop repository. The Sidebar repository owns tests for independent dock geometry, view registration, tab lifetime, Workspace-contained file access, persistent PTY input and resize, bounded output polling, and complete disposal.

## Alternatives considered

- **Ship Sidebar docks as first-party defaults** — rejected because the Desktop release would distribute optional interface features and make their dependencies part of every installation.
- **Keep plugin source in the Desktop workspace without staging it** — rejected because the root lockfile, compiler programs, and repository checks would still couple independent plugins to Desktop development and releases.
- **Keep files and terminals as separate feature plugins** — rejected because both views use the same two-dock tab model and must be addable to either dock. A single lifecycle owns that composition while separate Remotes preserve the different file and process authority.
- **Move only installable bundle wrappers** — rejected because leaving their Host providers or Client UI in the main repository would preserve the same source and build dependency under a different directory layout.
- **Remove Desktop lifecycle support with the plugin source** — rejected because native overlays, profile mutation, settings cleanup, and reversible replacement require a generic application host even though the feature implementation is external.
- **Remove retired defaults by package name alone** — rejected because a user may install an external checkout under the same package name.

## Consequences

Desktop and each plugin can version, test, and publish independently. Cloning Desktop produces a clean application workspace and lockfile; cloning the collection with submodules produces the optional plugin development tree. A plugin must declare every package and lifecycle resource it owns, and its repository must run its own build and tests. Cross-repository compatibility is explicit rather than enforced by the Desktop monorepo, while disabling or uninstalling a plugin restores the application composition without modifying unrelated profile data or local plugin source. Sidebar tab order and geometry remain transient, and terminal output uses bounded polling rather than a streaming Remote subscription.
