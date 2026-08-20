# Agent Note: Separate workspace identity from the primary project folder

Status: implemented

English | [中文](2026-08-20-multi-folder-workspace-identity.zh.md)

## Problem

A multi-folder project previously kept the first selected directory as an immutable native workspace path and stored a different primaryPath only in plugin context. New sessions therefore still started in the first directory, Git and configuration discovery followed that directory, and the file sandbox could not write attached folders. Changing the displayed primary folder did not change execution semantics.

Workspace membership also required every session header cwd to equal the workspace path. That rule made the path an identity key: changing the primary folder would remove old sessions even though they still belonged to the same user project.

## Decision

- **Workspace id owns project identity.** A session belongs to the one workspace whose durable sessionIds account contains it. Runtime attach and detach operations are serialized across workspace entities, and duplicate ownership rejects.
- **Workspace path is the current primary folder.** WorkspaceRegistry.setPath(id, path) canonicalizes an existing directory, rejects a path owned by another workspace, and durably updates only the path and modification time. New sessions use the current path as cwd. Existing session headers remain immutable and their workspace membership remains intact.
- **Attached folders extend write authority.** SandboxExecutionPolicy.additionalWritableRoots carries project folders besides the session cwd. Synchronous providers contribute current roots per session through SandboxPolicyService.registerAdditionalWritableRoots(). Resolution canonicalizes and deduplicates them; filesystem, bwrap, Landlock, Seatbelt, and Windows ACL enforcement consume the resulting project-root set.
- **The external multi-workspace plugin persists by workspace id.** Project records contain workspaceId, paths, and primaryPath. Creation passes the selected primary folder to native workspace creation. Editing updates the native workspace path before committing the plugin mapping and rolls it back if plugin persistence fails. The current primary folder cannot be removed until another folder becomes primary.
- **Old plugin storage is rejected.** The versioned object format replaces the unversioned root-path-keyed array. This repository is pre-release and does not retain a compatibility reader.

This decision supersedes the immutable-native-root assumption in plugins/workspace-multi/AGENT_NOTE.md; that note remains authoritative for plugin loading, Remote routing, and the row-menu adapter.

## Verification

Workspace tests cover primary-path validation and persistence, membership retention across a path change, duplicate-owner rejection, and competing attach serialization. Sandbox tests cover project-root canonicalization and deduplication, dynamic provider disposal, and bwrap/Landlock multi-root profiles. Plugin tests cover native creation from the selected primary folder, stable-id RPCs, path update rollback, attached-root contribution, version rejection, and editing rules.

## Alternatives considered

- **Keep the first folder immutable and describe another folder as primary in the prompt** — rejected because cwd, Git, instruction discovery, and configuration would disagree with the displayed primary folder.
- **Create one native workspace per folder** — rejected because one user project would fragment its session account and project-level UI state.
- **Rewrite old session cwd when primary changes** — rejected because a session header records where that task started and is not mutable project configuration.
- **Grant attached folders through danger-full-access** — rejected because multi-folder projects must retain the standing workspace-write restriction outside their explicit folder set.

## Consequences

A project can contain multiple folders without conflicting with the native one-directory cwd model: exactly one folder is primary at a time, while the workspace id groups the project and its sessions. Changing primary affects future sessions and discovery from the workspace path; it does not relocate active or historical tasks. Under workspace-write, all attached folders are writable and unrelated directories remain denied.
