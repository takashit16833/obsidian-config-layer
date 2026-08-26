# Config Layer

Config Layer is a desktop-only Obsidian plugin for sharing CSS, keyboard shortcuts, and a required community-plugin set across multiple vaults without replacing vault-specific configuration.

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

Point Config Layer at a folder containing `plugins.json`:

```text
~/dotfiles/obsidian/
└── plugins.json
```

The file is a JSON array of Obsidian community-plugin IDs:

```json
[
  "some-plugin",
  "another-plugin"
]
```

Config Layer treats this as a list of requirements, not as a complete synchronized plugin inventory:

- Plugin IDs listed in `plugins.json` are installed when missing.
- Listed plugins are enabled when installed but disabled.
- Plugins not listed in `plugins.json` are vault-specific and are left completely untouched.
- Removing an ID from `plugins.json` does not disable or uninstall that plugin from any vault.
- Existing installed plugins are not automatically updated by Config Layer.

When external file watching is enabled, changes to `plugins.json` are detected automatically. Adding a plugin ID after a `git pull` therefore installs and enables that plugin without requiring an Obsidian reload in the normal supported desktop runtime.

Installing and enabling community plugins currently requires a narrow use of Obsidian's internal plugin-management API because the public Plugin API does not expose installation methods. Config Layer keeps that dependency isolated to the required-plugin manager so it can be replaced if Obsidian exposes an official API later.

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
Plugins folder:  ~/dotfiles/obsidian
```

When upgrading from an older Config Layer version, `Plugins folder` initially inherits the existing `Hotkeys folder`, so vaults already using `~/dotfiles/obsidian` do not need an extra migration step.

Each vault keeps its own plugin settings, including which shared CSS files are enabled and any community plugins that are not listed in the shared `plugins.json`.

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
- required community plugins from `plugins.json`;
- automatic installation and enabling of missing required plugins;
- preservation of all vault-specific plugins;
- external file watching;
- desktop Obsidian.

Not currently in scope:

- mobile support;
- syncing files over a network;
- Git operations inside the plugin;
- automatic community-plugin updates;
- plugin version pinning;
- synchronization of community-plugin settings;
- automatic disabling or uninstalling when an ID leaves `plugins.json`;
- undocumented Obsidian APIs for hotkey manipulation.
