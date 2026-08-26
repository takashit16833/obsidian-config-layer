import { FileSystemAdapter, type App } from 'obsidian';
import { homedir } from 'node:os';
import path from 'node:path';

export function getVaultBasePath(app: App): string {
  const adapter = app.vault.adapter;
  if (!(adapter instanceof FileSystemAdapter)) {
    throw new Error('Config Layer requires Obsidian desktop with a file-system-backed vault.');
  }
  return adapter.getBasePath();
}

export function resolveConfiguredPath(app: App, configuredPath: string): string | null {
  const trimmed = configuredPath.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const expanded = trimmed === '~'
    ? homedir()
    : trimmed.startsWith('~/') || trimmed.startsWith('~\\')
      ? path.join(homedir(), trimmed.slice(2))
      : trimmed;

  if (path.isAbsolute(expanded)) {
    return path.normalize(expanded);
  }

  return path.resolve(getVaultBasePath(app), expanded);
}

export function getVaultHotkeysPath(app: App): string {
  return path.join(getVaultBasePath(app), app.vault.configDir, 'hotkeys.json');
}

export function getVaultPluginsPath(app: App): string {
  return path.join(getVaultBasePath(app), app.vault.configDir, 'plugins');
}
