# Agent Note: Hero utilities preserve plugin access

Status: implemented

English | [中文](2026-08-17-hero-utilities-preserve-plugin-access.zh.md)

## Problem

The empty and blank Session Hero hides the Session header. Workspace panel plugins need triggers before a Session contains conversation history, but the official Hero exposes no general utilities list. Registering only in `conversation.session.header.utilities` would make the panels unreachable during that phase even though both capabilities operate on a Workspace rather than Session content.

## Decision

The external `plugins/shared/workspace-layout` package declares the root-scoped `shell.hero.utilities` list and renders it at the Hero's top-right edge without modifying the official conversation package. Workspace panel plugins register the same trigger component in that list and in the official session-scoped `conversation.session.header.utilities` list. The Hero entry is rendered only while the enhanced layout is active and no non-blank Session owns the header; the Session entry remains the active-phase location.

Both registrations remain plugin effects. Unloading a workspace panel plugin removes its Hero and Session triggers, closes its layout split, and discards its transient panel state. Disabling the last plugin that requires the enhanced layout removes its profile alias and restores the official layout package on the next runtime start.

## Alternatives considered

**Modify the official conversation Hero.** Rejected because an optional external feature would then leave a permanent slot and rendering branch in `packages/client/ui-conversation`.

**Show the Session header during the Hero phase.** Rejected because blank Sessions intentionally hide title and tab chrome, and restoring the whole header would add empty Session context and move the centered Hero layout.

**Place the controls inside the composer.** Rejected because the requested location is the top-right utility row, and the composer controls are scoped to message input rather than Workspace panels.

## Consequences

Workspace utilities remain reachable on new, blank, and active conversations without changing official conversation code. A plugin that needs both phases registers both utility lists; unloading it reverses both contributions through the same Cordis fiber. Layout and plugin tests pin Hero rendering, dual registration, alias removal, and disposal for the file-browser and terminal plugins.
