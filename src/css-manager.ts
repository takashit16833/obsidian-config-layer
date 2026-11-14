import type { App } from 'obsidian';
import { promises as fs, watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { resolveConfiguredPath } from './paths';
import { inlineLocalImageUrls } from './css-local-images';
import type { ConfigLayerSettings } from './types';

export class CssManager {
  private readonly styleElements = new Map<string, HTMLStyleElement>();
  private watcher: FSWatcher | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly app: App,
    private readonly getSettings: () => ConfigLayerSettings,
  ) {}

  async listCssFiles(): Promise<string[]> {
    const folder = resolveConfiguredPath(this.app, this.getSettings().cssFolder);
    if (folder === null) {
      return [];
    }

    try {
      const entries = await fs.readdir(folder, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.css'))
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));
    } catch {
      return [];
    }
  }

  async refresh(): Promise<void> {
    const settings = this.getSettings();
    const folder = resolveConfiguredPath(this.app, settings.cssFolder);
    const files = await this.listCssFiles();
    const activeFiles = new Set(files.filter((file) => settings.enabledCssFiles[file] === true));

    for (const [file, element] of this.styleElements) {
      if (!activeFiles.has(file)) {
        element.remove();
        this.styleElements.delete(file);
      }
    }

    if (folder === null) {
      return;
    }

    for (const file of activeFiles) {
      try {
        const css = await fs.readFile(path.join(folder, file), 'utf8');
        let element = this.styleElements.get(file);
        if (element === undefined) {
          element = document.createElement('style');
          element.dataset.configLayerFile = file;
          document.head.appendChild(element);
          this.styleElements.set(file, element);
        }
        element.textContent = await inlineLocalImageUrls(css);
      } catch (error) {
        console.error(`Config Layer: failed to load CSS file ${file}`, error);
      }
    }
  }

  restartWatcher(): void {
    this.stopWatcher();

    if (!this.getSettings().watchExternalFiles) {
      return;
    }

    const folder = resolveConfiguredPath(this.app, this.getSettings().cssFolder);
    if (folder === null) {
      return;
    }

    try {
      this.watcher = watch(folder, () => this.scheduleRefresh());
      this.watcher.on('error', (error) => {
        console.error('Config Layer: CSS watcher error', error);
        this.stopWatcher();
      });
    } catch (error) {
      console.error('Config Layer: failed to watch CSS folder', error);
    }
  }

  stop(): void {
    this.stopWatcher();
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    for (const element of this.styleElements.values()) {
      element.remove();
    }
    this.styleElements.clear();
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      void this.refresh();
    }, 100);
  }

  private stopWatcher(): void {
    this.watcher?.close();
    this.watcher = null;
  }
}
