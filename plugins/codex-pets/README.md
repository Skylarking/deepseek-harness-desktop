# Generic DSH pet plugin

English | [中文](README.zh.md)

Runs animated pets in DSH Web using the Codex `pet.json` protocol. The plugin scans `~/.codex/pets/*/pet.json` by default and includes Jiaran as a fallback asset.

## Install

```sh
cd /path/to/deepseek-harness-desktop
pnpm dsh plugin --profile web add ./plugins/codex-pets
pnpm dsh web
```

Clicking waves, hovering jumps, and horizontal dragging runs in the matching direction. Double-clicking jumps and returns the pet to the bottom-right corner. Right-click the pet to cycle through discovered pets.

## Add pets

A pet directory contains at least:

```text
my-pet/
├── pet.json
└── spritesheet.webp
```

`pet.json` uses the Codex format:

```json
{
  "id": "my-pet",
  "displayName": "My pet",
  "spriteVersionNumber": 2,
  "spritesheetPath": "spritesheet.webp"
}
```

Place the complete directory at `~/.codex/pets/<pet-name>/` and restart DSH. Desktop and plugin source do not need modification. This is the same installation directory and manifest format used by Codex. The plugin supports v1 (8×9) and v2 (8×11) atlases. Standard rows are idle, running-right, running-left, waving, jumping, failed, waiting, running, and review.

## Configuration

Open `Settings -> Plugins -> Plugin configuration` to manage this plugin. The
card can show or hide the desktop pet, choose any discovered Codex pet, and
resize it from 50% to 200%. These values belong to `codex-pets` and are stored
under that namespace in the profile settings document.

Override plugin configuration in the profile's `cordis.patch.yml`:

```yaml
- id: codex-pets
  config:
    activePet: my-pet
    codexPetsRoot: /path/to/codex/pets
    petDirectories:
      - /path/to/another-pet
```

- `activePet`: initially selected pet id.
- `codexPetsRoot`: automatically scanned root, defaulting to `~/.codex/pets`.
- `petDirectories`: additional individual pet directories.

The configuration card is removed with the plugin. Removing `codex-pets` also
removes its `codex-pets` settings section; other plugin and product settings
remain untouched.

## Session activity

The number badge beside the pet shows active session count. Clicking it opens a list containing the current or background running sessions, sessions awaiting input or plan review, and unread completed sessions. Clicking a row opens that session in DSH.

## State mapping

- The first activity is running: running.
- The first activity awaits approval, an answer, or plan review: waiting.
- The first activity is an unread completion: review.
- The current session has an Agent error and no activity: failed.
- No activity: idle.

Frame counts, per-frame timing, return to slow idle after three action loops, activity priority, and drag thresholds follow the Codex state machine.

## Uninstall

```sh
cd /path/to/deepseek-harness-desktop
pnpm dsh plugin --profile web remove codex-pets
```

Desktop destroys the plugin-declared transparent window after removal. The main interface, settings, and pet directory retain no plugin-injected state. User-installed assets under `~/.codex/pets` are not deleted.
