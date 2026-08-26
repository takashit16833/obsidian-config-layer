# Config Layer

Config Layer is a desktop-only Obsidian plugin for sharing CSS and keyboard shortcuts across multiple vaults without replacing vault-specific configuration.

The shared files can live either inside a vault or anywhere else on the local file system, such as a Git-managed dotfiles repository.

> Status: early development. The current implementation is intended to establish and test the core behavior before broader distribution.

## What it does

### Shared CSS

Point Config Layer at a folder containing CSS files:

```text
~/dotfiles/obsidian/css/
├── common.css
├── editor.css
└── navigation.css
```

The plugin discovers `.css` files in that folder and lets each vault enable or disable them independently.

Enabled files are injected directly into Obsidian, so they do not need to be copied into `.obsidian/snippets/`.

When external file watching is enabled, edits to a shared CSS file are reloaded automatically.

### Shared hotkeys

Point Config Layer at a folder containing:

```text
~/dotfiles/obsidian/
└── hotkeys.json
```

Config Layer merges that file into the current vault's own `hotkeys.json`.

The rules are:

- Commands that exist only in the vault remain vault-specific.
- Commands present in shared `hotkeys.json` are managed by the shared layer and override the vault value.
- When a command first becomes shared, Config Layer remembers the vault value that was underneath it, including the case where no vault value existed.
- If a previously shared command is removed and the vault still contains the last shared value, Config Layer restores the remembered vault value, or removes the command if it originally did not exist.
- If the vault value was changed independently while the shared layer was active, Config Layer preserves that changed value when the command leaves the shared layer.

Obsidian does not expose a documented public API for reloading `hotkeys.json` into the running application. Config Layer therefore writes the merged file using documented/file-system behavior and asks you to reload Obsidian when hotkeys changed. It intentionally does not depend on undocumented internal hotkey APIs.

## Example setup

A dotfiles repository can contain only the shared configuration:

```text
~/dotfiles/obsidian/
├── hotkeys.json
└── css/
    ├── common.css
    └── editor.css
```

Then configure every vault with the same paths:

```text
CSS folder:      ~/dotfiles/obsidian/css
Hotkeys folder:  ~/dotfiles/obsidian
```

Each vault keeps its own plugin settings, including which shared CSS files are enabled.

## Path rules

Configured folders may be:

- absolute paths;
- paths beginning with `~/`;
- relative paths, which are resolved from the vault root.

Because Config Layer reads files outside a vault through Node.js file-system APIs, it is desktop-only.

## Development

Use a dedicated test vault while developing Obsidian plugins. Do not test unfinished file-writing behavior against an important vault.

```bash
npm install
npm test
npm run build
```

For development mode:

```bash
npm run dev
```

Copy or link the repository into the test vault's plugin directory using the manifest ID as the folder name:

```text
<TestVault>/.obsidian/plugins/config-layer/
```

The plugin directory needs at least:

```text
manifest.json
main.js
```

## Current scope

The first version intentionally focuses on:

- shared CSS discovery and per-vault ON/OFF state;
- live CSS reload from external files;
- shared `hotkeys.json` merge with vault-specific hotkeys;
- restoration of vault-specific hotkeys when a shared override is removed;
- preservation of independent vault edits;
- external file watching;
- desktop Obsidian.

Not currently in scope:

- mobile support;
- syncing files over a network;
- Git operations inside the plugin;
- undocumented Obsidian APIs for forcing hotkey reloads.
