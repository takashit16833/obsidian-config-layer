# AGENTS.md

## Project purpose

Config Layer lets multiple Obsidian vaults consume a shared configuration layer while preserving vault-specific settings.

The primary use case is a Git-managed shared configuration directory, such as `~/dotfiles/obsidian`, that can be edited by humans or coding agents independently of individual vaults.

The plugin is the reader/applicator. It is not the source of truth for shared CSS or hotkeys.

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
- When the same command ID exists in both places, the shared value wins.
- Track the last shared values applied by the plugin.
- When a command ID is removed from the shared file, remove it from the vault only if the current vault value still equals the last value applied by Config Layer.
- If the user changed that vault value independently, preserve it.
- Never use undocumented Obsidian internal hotkey APIs merely to avoid an application reload.

## Safety rules

This plugin reads and writes configuration files, so conservative behavior matters more than convenience.

- Do not write to a vault during discovery or validation.
- Parse and validate shared `hotkeys.json` before modifying the vault file.
- If shared JSON is invalid, fail without changing the vault file or managed-hotkey state.
- Avoid changing unrelated keys or reformatting unrelated files unnecessarily.
- Do not delete a vault hotkey solely because it disappeared from the shared file; first prove it still matches the last managed value.
- Prefer documented Obsidian APIs. If an API or behavior is uncertain, verify it against current official Obsidian developer documentation or source/types before changing implementation.
- Do not add dependence on undocumented internal APIs without an explicit design decision and documented reason.
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

Keep path resolution in one module so CSS and hotkeys cannot drift into different semantics.

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
  pure hotkey merge semantics

src/types.ts
  persistent settings and shared types
```

Prefer keeping merge policy pure and independent from Obsidian and filesystem APIs so it can be tested in isolation.

## Persistent plugin data

Per-vault plugin data contains local behavior only, such as:

- configured source paths;
- enabled CSS file names;
- whether external files are watched;
- the last shared hotkey values applied by Config Layer.

Do not store the shared CSS contents or treat plugin `data.json` as the shared source of truth.

## External watching

Watchers are a convenience, not the correctness mechanism.

- The plugin must work when watching is disabled.
- Watch callbacks should be debounced.
- Watch errors must not crash the plugin.
- Always close watchers on plugin unload and before replacing them.
- Hotkey source changes may update the vault JSON automatically, but the UI must communicate that Obsidian reload is required for activation when applicable.

## Development workflow

Before implementing behavior that depends on Obsidian details:

1. inspect the current repository state;
2. check the current official Obsidian developer documentation or API types when the behavior may have changed;
3. distinguish documented API from internal implementation;
4. make the smallest change that satisfies the contract;
5. run `npm run build` before committing.

For bugs that depend on the user's environment, prefer observation over guessing. Ask for a short read-only diagnostic or console output when local state is required to distinguish hypotheses.

## Scope discipline

Do not turn Config Layer into a general sync system.

Out of scope unless explicitly requested:

- Git pull/push;
- cloud synchronization;
- plugin installation synchronization;
- theme synchronization;
- arbitrary `.obsidian` file mirroring;
- mobile file-provider integration.

The plugin should remain a small adapter between a shared local configuration directory and Obsidian vaults.

## Naming and manifest

Repository name: `obsidian-config-layer`.

Plugin display name: `Config Layer`.

Manifest ID: `config-layer`.

The manifest ID intentionally does not contain `obsidian`, because current Obsidian manifest rules prohibit that word in plugin IDs.
