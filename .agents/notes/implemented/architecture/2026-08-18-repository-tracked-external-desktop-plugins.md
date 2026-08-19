# Agent Note: Desktop feature plugins remain external to the release

Status: implemented

English | [中文](2026-08-18-repository-tracked-external-desktop-plugins.zh.md)

## Problem

Workspace files and the terminal were installed from packages in the Desktop runtime and appeared automatically in new profiles. This made the application release own those features even though the intended product is a clean Desktop host whose interface changes come only from separately installed plugins. Keeping only their bundle wrappers outside `packages/` would still leave the Host providers, Client UI, and core Remote assembly coupled to them.

## Decision

- **Desktop ships no feature plugins.** Its runtime dependency closure contains the DSH Web application and general plugin lifecycle support, but no Workspace files, terminal, or pet bundle. New profiles receive no Desktop default plugins, and plugin management installs only a directory selected by the user.
- **External plugin source remains in this repository.** `plugins/workspace-files`, `plugins/workspace-console`, and `plugins/codex-pets` are Git-tracked development sources. Each Workspace plugin root is the installable bundle and contains its Host and Client packages under `packages/`. Their workspace membership supports repository builds without making them CLI or Desktop release dependencies.
- **Plugins own their complete runtime contribution.** Each Workspace Client mounts its generated Remote contribution after the shared Client Remote service is available. The core `dsh-api-remotes` assembly has no imports, types, dependencies, or project references to either external plugin.
- **Workspace layout changes are reversible package aliases.** The file and terminal manifests declare the profile-local package aliases they require through `dsh.desktop.supportPackages`. Desktop records those aliases in `dsh.desktop.managedSupportPackages`, hides them from the user plugin list, and removes an alias after the last enabled plugin requiring it is disabled or uninstalled. Support-package commands preserve the exact feature-bundle enablement list; removal deletes both the manifest dependency and its profile symlink so the next start resolves the Web runtime's original layout package.
- **The terminal plugin owns its PTYs.** `plugins/workspace-console` uses `node-pty` directly for terminal creation, input, resize, exit, and awaited teardown. The official subprocess and terminal packages remain unchanged.
- **Desktop-only management is a support package.** `plugins/shared/desktop-plugin-inventory` replaces the read-only Web inventory through `apps/desktop/desktop.patch.yml`; ordinary `dsh web` keeps the official inventory. `plugins/shared/workspace-layout` and the inventory package support the host and external plugins, but they are not independently installable feature plugins.
- **Retired defaults are removed narrowly.** On upgrade, Desktop removes a package recorded in the former `dsh.desktop.defaultPlugins` ledger only when its dependency resolves inside the active Desktop runtime. A same-named plugin installed from another local path remains installed. The obsolete ledger is then removed.

## Verification

Desktop tests cover narrow retirement of runtime-owned defaults, preservation of an external replacement, support-alias reconciliation without feature-bundle re-enablement, profile-link removal, and filtering support aliases from the managed plugin list. Plugin lifecycle tests cover Client-owned Remote mounting, reversible UI registration, and real PTY input, output, resize, exit, and disposal. Component tests cover the Desktop lifecycle controls and the read-only browser fallback. The Desktop staging check verifies that its runtime closure contains the management support package but none of the three feature plugin bundles or the Workspace layout package.

## Alternatives considered

- **Keep Workspace files and the terminal as first-party defaults** — rejected because the Desktop release would continue to own and distribute optional interface features.
- **Move only the bundle directories** — rejected because core Remote assembly and the remaining Host and Client packages would still make the product depend on those plugins.
- **Move each plugin to a separate Git repository immediately** — rejected because source ownership and release ownership are independent; this repository can review and test the external plugins without packaging them into Desktop.
- **Delete every prior default by package name** — rejected because a user may already have replaced a former default with an external checkout under the same package name.

## Consequences

A clean Desktop installation exposes the generic DSH interface and plugin manager only. Users install any of the three repository plugins explicitly from `plugins/`. A plugin can add an overlay, settings namespace, or Workspace panel while enabled; disabling or uninstalling removes its registered effects, and uninstalling also removes its declared settings. Shared package aliases remain only while an enabled plugin requires them. Repository-wide development can still compile the external plugin packages, while DSH and Desktop releases no longer publish or stage the feature plugins as product dependencies.
