# Config Layer

Config Layer is a desktop-only Obsidian plugin for sharing CSS, keyboard shortcuts, and a required set of community plugins across multiple vaults without replacing vault-specific configuration.

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

With external file watching enabled, changes to shared `hotkeys.json` are applied automatically. In the tested desktop Obsidian environment, Obsidian picks up the resulting vault `hotkeys.json` change immediately, including the active keyboard shortcut, without an application reload.

Config Layer does not call undocumented internal hotkey APIs. It only updates the vault configuration file and relies on Obsidian's own file-change handling.

### Required community plugins

Point Config Layer at a folder containing:

```text
~/dotfiles/obsidian/
└── plugins.json
```

`plugins.json` is a JSON array of Obsidian community plugin IDs:

```json
[
  "another-quick-switcher",
  "tab-shifter"
]
```

Config Layer treats this as a minimum required set for the current vault:

- A required plugin that is missing is installed from the official Obsidian community plugin registry.
- A required plugin that is installed but disabled is enabled.
- Already installed and enabled plugins are left alone.
- Plugins that are not listed remain completely vault-specific.
- Removing an ID from `plugins.json` does not disable or uninstall that plugin.
- Config Layer does not update an already installed plugin just because a newer version exists.
- Plugin settings are not synchronized.

If the Plugins folder setting is empty, Config Layer uses the Hotkeys folder. This makes the common setup below work without an additional per-vault path.

When external file watching is enabled, changes to `plugins.json` are detected automatically. A `git pull` that changes the file can therefore cause newly required plugins to be installed and enabled without reloading the vault.

Obsidian's public plugin API type definitions do not expose community-plugin installation and enablement. This feature therefore uses a narrowly typed portion of Obsidian's internal plugin-management interface. The dependency is intentionally isolated to the required-plugin manager so changes in Obsidian can fail safely without affecting CSS or hotkey behavior.

## Example setup

A dotfiles repository can contain only the shared configuration:

```text
~/dotfiles/obsidian/
├── hotkeys.json
├── plugins.json
└── css/
    ├── common.css
    └── editor.css
```

Then configure every vault with the same paths:

```text
CSS folder:      ~/dotfiles/obsidian/css
Hotkeys folder:  ~/dotfiles/obsidian
Plugins folder:  (empty; falls back to Hotkeys folder)
```

Each vault keeps its own plugin settings, including which shared CSS files are enabled and any additional community plugins installed only for that vault.

## Path rules

Configured folders may be:

- absolute paths;
- paths beginning with `~/`;
- relative paths, which are resolved from the vault root.

Because Config Layer reads files outside a vault through Node.js file-system APIs, it is desktop-only.

## Development

Use a dedicated test vault while developing Obsidian plugins. Do not test unfinished file-writing or plugin-installation behavior against an important vault.

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

The current version focuses on:

- shared CSS discovery and per-vault ON/OFF state;
- live CSS reload from external files;
- shared `hotkeys.json` merge with vault-specific hotkeys;
- restoration of vault-specific hotkeys when a shared override is removed;
- preservation of independent vault edits;
- live hotkey updates through Obsidian's own `hotkeys.json` file-change handling;
- required community-plugin installation and enablement from `plugins.json`;
- automatic detection of shared configuration changes;
- desktop Obsidian.

Not currently in scope:

- mobile support;
- syncing files over a network;
- Git operations inside the plugin;
- plugin settings synchronization;
- automatic plugin upgrades;
- disabling or uninstalling plugins because they left the shared list;
- undocumented Obsidian APIs for hotkey manipulation.
