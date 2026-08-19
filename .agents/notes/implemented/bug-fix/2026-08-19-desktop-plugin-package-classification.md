# Agent Note: Desktop plugin package classification

Status: implemented

English | [中文](2026-08-19-desktop-plugin-package-classification.zh.md)

## Problem

The Desktop profile can contain DSH bundles, skill packages, and ordinary NPM dependencies. The plugin manager previously treated every dependency as a toggleable bundle and wrote enabled package names to `dsh.profile.bundles`. Enabling a skill package therefore made the next runtime start fail because the package declared no `dsh.bundle.patch`. Plugin management also occupied a separate large window and navigated the main window to a loading page during each mutation.

## Decision

- A package is a toggleable plugin only when its manifest declares a non-empty `dsh.bundle.patch` string. Only those packages can enter `dsh.profile.bundles` through Desktop plugin management.
- A package containing `skill/SKILL.md` is presented as a skill package. Other dependencies are presented as ordinary packages. These classifications affect presentation only and do not grant bundle semantics.
- Profile synchronization removes dependency-backed entries from `dsh.profile.bundles` when their installed manifests do not declare a bundle patch. Bundle entries without a matching dependency remain untouched because built-in profile layers can use them.
- The plugin manager opens as a compact native child of the main window. It uses the Web UI theme tokens and native macOS close and zoom controls. Minimize is disabled because macOS minimizes the parent together with a child window, and fullscreen remains disabled.
- The plugin manager and its native lifecycle dialogs select Chinese or English copy from the first macOS preferred system language. Unsupported languages fall back to English.
- A plugin mutation stops and restarts the managed DSH runtime without navigating the main window away from the Web UI. Progress and failures remain in the plugin manager.

## Verification

Desktop tests cover bundle, skill, and ordinary-package classification; rejection of skill enablement; cleanup of an invalid historical bundle entry; preservation of built-in bundle entries; and the native child-window options. The packaged application is also exercised to verify the manager remains associated with the main window and package mutations do not replace the Web UI with a loading page.

## Alternatives considered

- **Hide every non-bundle dependency**: rejected because users still need to identify and remove installed skill and ordinary packages.
- **Continue treating every dependency as a plugin**: rejected because an NPM dependency does not satisfy the DSH bundle loader requirements.
- **Render plugin management as a main-window page**: rejected because package management is a short secondary task and replacing the active session disrupts the primary workflow.

## Consequences

Skill and ordinary packages remain installed profile dependencies and can be opened or removed, but they cannot be enabled as DSH bundles. Existing profiles recover from dependency-backed invalid bundle entries during synchronization. Plugin management stays visually subordinate to the active Desktop session, and runtime restarts no longer replace the session view.
