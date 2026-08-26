# AGENTS.md

## Project purpose

Config Layer lets multiple Obsidian vaults consume a shared configuration layer while preserving vault-specific settings.

The primary use case is a Git-managed shared configuration directory, such as `~/dotfiles/obsidian`, that can be edited by humans or coding agents independently of individual vaults.

The plugin is the reader/applicator. It is not the source of truth for shared CSS, hotkeys, or the required community-plugin list.

## Core contract

### CSS

- The user configures a CSS folder.
- The folder may be inside or outside the current vault.
- Discover top-level `.css` files in that folder.
- Each vault stores its own enabled/disabled state for each shared CSS file.
- Enabled CSS is injected into the running Obsidian application.
- When watching is enabled, source changes should update the injected CSS without requiring a restart.
- Do not copy shared CSS into `.obsidian/snippets/` unless the product design is explicitly changed.

### Hotkeys

- The user configures a folder containing `hotkeys.json`.
- The folder may be inside or outside the current vault.
- The shared file is authoritative only for command IDs it currently contains.
- Vault-only command IDs remain untouched.
- When the same command ID exists in both places, the shared value wins while that command remains shared.
- When a command first enters shared management, record the vault value that existed underneath it, including explicit absence.
- Keep that original backup unchanged while the shared command remains managed, even if the shared value changes.
- When a command ID leaves the shared file and the current vault value still equals the last shared value, restore the recorded vault value. If the command did not originally exist, remove it.
- If the user changed the vault value independently while the shared layer was active, preserve the user's value instead of restoring the backup.
- For installations upgraded from a version that did not record backups, never guess the previous vault value. Preserve the current value when restoration cannot be proven safe.
- Do not use undocumented Obsidian internal hotkey APIs. Live activation currently comes from Obsidian observing changes to the vault `hotkeys.json`, verified in desktop runtime testing.

### Required community plugins

- The user may configure a folder containing `plugins.json`.
- If the plugins folder is empty, use the hotkeys folder so an existing `~/dotfiles/obsidian` setup needs no additional per-vault path.
- `plugins.json` is a JSON array of community plugin IDs.
- Treat that array as a minimum required set, not as a complete synchronized plugin inventory.
- Validate the entire file before installing or enabling anything.
- Missing required plugins may be installed only when they are present in the official Obsidian community plugin registry.
- Installed but disabled required plugins may be enabled.
- Already installed and enabled required plugins remain untouched.
- Plugins not present in the shared list remain vault-specific and must not be disabled, removed, or modified.
- Removing an ID from `plugins.json` must not disable or uninstall the plugin.
- Do not automatically upgrade an already installed plugin.
- Do not synchronize plugin settings unless that feature is explicitly designed later.
- Ignore `config-layer` if it appears in the list; the plugin cannot bootstrap itself.

Obsidian's public Plugin API types do not expose community-plugin installation and enablement. Required-plugin installation is therefore an explicit exception to the general preference for documented APIs. Keep all access to the internal `app.plugins` interface narrowly typed and isolated in `src/plugins-manager.ts`. If the internal interface is unavailable, fail safely and do not fall back to destructive file manipulation or shell commands.

## Safety rules

This plugin reads and writes configuration files and can install executable third-party plugin code, so conservative behavior matters more than convenience.

- Do not write to a vault during discovery or validation.
- Parse and validate shared `hotkeys.json` before modifying the vault file.
- If shared hotkey JSON is invalid, fail without changing the vault file or managed-hotkey state.
- Parse and validate all of `plugins.json` before installing or enabling plugins.
- Do not install an ID that is absent from the official Obsidian community plugin registry.
- Never uninstall, disable, or auto-upgrade plugins as a consequence of the shared required-plugin list.
- Avoid changing unrelated keys or reformatting unrelated files unnecessarily.
- Never discard a vault-specific hotkey merely because a shared command disappears. Restore or remove only when the plugin can prove the current value is still the value it last managed.
- Prefer documented Obsidian APIs. If an API or behavior is uncertain, verify it against current official Obsidian developer documentation or source/types before changing implementation.
- Do not add further dependence on undocumented internal APIs without an explicit design decision and documented reason.
- Do not hardcode `.obsidian`; use `app.vault.configDir`.
- Keep `FileSystemAdapter` use guarded by `instanceof`, even though the manifest is desktop-only.
- Treat paths supplied by users as paths, not shell fragments. Do not invoke a shell to read or apply configuration.

## Platform decision

Config Layer is desktop-only because arbitrary paths outside the vault require Node.js file-system APIs.

`manifest.json` must therefore keep:

```json
"isDesktopOnly": true
```

If mobile support is proposed later, it must not silently weaken the outside-vault requirement. Design the capability explicitly.

## Path semantics

Configured paths support:

1. absolute paths;
2. `~/...`, expanded to the current user's home directory;
3. relative paths, resolved from the current vault root.

Keep path resolution in one module so CSS, hotkeys, and plugins cannot drift into different semantics.

## Architecture

Keep responsibilities separated:

```text
src/main.ts
  plugin lifecycle and orchestration

src/settings.ts
  Obsidian settings UI only

src/paths.ts
  external/vault-relative path resolution

src/css-manager.ts
  CSS discovery, injection, refresh, watching

src/hotkeys-manager.ts
  JSON I/O, application, watching

src/merge-hotkeys.ts
  pure hotkey merge and restoration semantics

src/plugin-list.ts
  pure plugins.json validation and normalization

src/plugins-manager.ts
  required-plugin discovery, installation, enablement, watching
  isolated access to Obsidian's internal plugin-management interface

src/types.ts
  persistent settings and shared types
```

Prefer keeping merge and validation policy pure and independent from Obsidian and filesystem APIs so it can be tested in isolation.

## Persistent plugin data

Per-vault plugin data contains local behavior only, such as:

- configured source paths;
- enabled CSS file names;
- whether external files are watched;
- the last shared hotkey values applied by Config Layer;
- the original vault values shadowed by currently managed shared hotkeys.

Do not store shared CSS contents, hotkey contents, or the shared plugin list in plugin `data.json` as a source of truth.

## External watching

Watchers are a convenience, not the correctness mechanism.

- The plugin must work when watching is disabled.
- Watch callbacks should be debounced.
- Watch errors must not crash the plugin.
- Always close watchers on plugin unload and before replacing them.
- Hotkey source changes may update the vault JSON automatically.
- `plugins.json` source changes may install missing required plugins and enable disabled required plugins automatically.
- In verified desktop runtime behavior, Obsidian notices the vault `hotkeys.json` change and activates the new shortcut immediately without reload.
- Treat hotkey live activation as observed Obsidian behavior, not as an undocumented API contract.

## Development workflow

Before implementing behavior that depends on Obsidian details:

1. inspect the current repository state;
2. check the current official Obsidian developer documentation or API types when the behavior may have changed;
3. distinguish documented API from internal implementation;
4. make the smallest change that satisfies the contract;
5. run `npm test` and `npm run build` before committing or merging.

For bugs that depend on the user's environment, prefer observation over guessing. Ask for a short read-only diagnostic or console output when local state is required to distinguish hypotheses.

Required-plugin behavior must additionally be tested in a disposable Obsidian vault before being treated as runtime-verified, because successful TypeScript compilation cannot prove the current internal `app.plugins` behavior.

## Scope discipline

Do not turn Config Layer into a general sync system.

Out of scope unless explicitly requested:

- Git pull/push;
- cloud synchronization;
- theme synchronization;
- arbitrary `.obsidian` file mirroring;
- mobile file-provider integration;
- plugin settings synchronization;
- automatic plugin upgrades;
- disabling or uninstalling plugins because they disappeared from `plugins.json`.

The plugin should remain a small adapter between a shared local configuration directory and Obsidian vaults.

## Naming and manifest

Repository name: `obsidian-config-layer`.

Plugin display name: `Config Layer`.

Manifest ID: `config-layer`.

The manifest ID intentionally does not contain `obsidian`, because current Obsidian manifest rules prohibit that word in plugin IDs.
