import { Notice, requestUrl, type App, type PluginManifest } from 'obsidian';
import { promises as fs, watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { parseRequiredPluginIds, planRequiredPlugins } from './manage-plugins';
import { getVaultBasePath, resolveConfiguredPath } from './paths';
import type { ConfigLayerSettings } from './types';

const PLUGIN_REGISTRY_URL = 'https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json';

interface PluginRegistryEntry {
  id: string;
  repo: string;
}

interface InternalPluginsApi {
  manifests?: Record<string, PluginManifest>;
  installPlugin?: (repo: string, version: string, manifest: PluginManifest) => Promise<void>;
  loadManifests?: () => Promise<void>;
  loadAvailablePlugins?: () => Promise<void>;
  enablePluginAndSave?: (pluginId: string) => Promise<void>;
  enablePlugin?: (pluginId: string) => Promise<void>;
  saveEnabledPlugins?: () => Promise<void>;
  saveConfig?: () => Promise<void>;
}

export interface ApplyRequiredPluginsResult {
  applied: boolean;
  installed: number;
  enabled: number;
  failed: string[];
}

async function readJson(filePath: string, missingValue: unknown): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return missingValue;
    }
    throw error;
  }
}

export class PluginsManager {
  private watcher: FSWatcher | null = null;
  private applyTimer: ReturnType<typeof setTimeout> | null = null;
  private registryCache: PluginRegistryEntry[] | null = null;

  constructor(
    private readonly app: App,
    private readonly getSettings: () => ConfigLayerSettings,
  ) {}

  async apply(showUnchangedNotice = false): Promise<ApplyRequiredPluginsResult> {
    const folder = resolveConfiguredPath(this.app, this.getSettings().pluginsFolder);
    if (folder === null) {
      return { applied: false, installed: 0, enabled: 0, failed: [] };
    }

    const sharedPath = path.join(folder, 'plugins.json');
    const requiredPluginIds = parseRequiredPluginIds(await readJson(sharedPath, []));
    const installedPluginIds = await this.getInstalledPluginIds();
    const enabledPluginIds = await this.getEnabledPluginIds();
    const plan = planRequiredPlugins(requiredPluginIds, installedPluginIds, enabledPluginIds);

    let installed = 0;
    let enabled = 0;
    const failed: string[] = [];

    for (const pluginId of plan.install) {
      try {
        await this.installPlugin(pluginId);
        installed++;
        await this.enablePlugin(pluginId);
        enabled++;
      } catch (error) {
        failed.push(pluginId);
        console.error(`Config Layer: failed to install required plugin ${pluginId}`, error);
      }
    }

    for (const pluginId of plan.enable) {
      try {
        await this.enablePlugin(pluginId);
        enabled++;
      } catch (error) {
        failed.push(pluginId);
        console.error(`Config Layer: failed to enable required plugin ${pluginId}`, error);
      }
    }

    if (installed > 0 || enabled > 0) {
      const parts: string[] = [];
      if (installed > 0) {
        parts.push(`installed ${installed}`);
      }
      if (enabled > 0) {
        parts.push(`enabled ${enabled}`);
      }
      new Notice(`Config Layer: ${parts.join(', ')} required plugin${installed + enabled === 1 ? '' : 's'}.`);
    }

    if (failed.length > 0) {
      new Notice(`Config Layer could not apply required plugins: ${failed.join(', ')}. Check the developer console.`);
    } else if (showUnchangedNotice && installed === 0 && enabled === 0) {
      new Notice('Config Layer: required plugins are already satisfied.');
    }

    return { applied: true, installed, enabled, failed };
  }

  restartWatcher(): void {
    this.stopWatcher();

    if (!this.getSettings().watchExternalFiles) {
      return;
    }

    const folder = resolveConfiguredPath(this.app, this.getSettings().pluginsFolder);
    if (folder === null) {
      return;
    }

    try {
      this.watcher = watch(folder, (_eventType, filename) => {
        if (filename === null || filename.toString() === 'plugins.json') {
          this.scheduleApply();
        }
      });
      this.watcher.on('error', (error) => {
        console.error('Config Layer: plugins watcher error', error);
        this.stopWatcher();
      });
    } catch (error) {
      console.error('Config Layer: failed to watch plugins folder', error);
    }
  }

  stop(): void {
    this.stopWatcher();
    if (this.applyTimer !== null) {
      clearTimeout(this.applyTimer);
      this.applyTimer = null;
    }
  }

  private getPluginsApi(): InternalPluginsApi | undefined {
    return (this.app as App & { plugins?: InternalPluginsApi }).plugins;
  }

  private getPluginsDirectory(): string {
    return path.join(getVaultBasePath(this.app), this.app.vault.configDir, 'plugins');
  }

  private getEnabledPluginsPath(): string {
    return path.join(getVaultBasePath(this.app), this.app.vault.configDir, 'community-plugins.json');
  }

  private async getInstalledPluginIds(): Promise<Set<string>> {
    const ids = new Set<string>();

    let entries;
    try {
      entries = await fs.readdir(this.getPluginsDirectory(), { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return ids;
      }
      throw error;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const manifestPath = path.join(this.getPluginsDirectory(), entry.name, 'manifest.json');
      const mainPath = path.join(this.getPluginsDirectory(), entry.name, 'main.js');
      try {
        await fs.access(mainPath);
        const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as { id?: unknown };
        ids.add(entry.name);
        if (typeof manifest.id === 'string' && manifest.id.length > 0) {
          ids.add(manifest.id);
        }
      } catch {
        // Ignore incomplete plugin directories. They are not considered installed.
      }
    }

    return ids;
  }

  private async getEnabledPluginIds(): Promise<Set<string>> {
    const parsed = await readJson(this.getEnabledPluginsPath(), []);
    if (!Array.isArray(parsed)) {
      throw new Error(`${this.getEnabledPluginsPath()} must contain a JSON array.`);
    }
    return new Set(parsed.filter((value): value is string => typeof value === 'string'));
  }

  private async getPluginRegistry(): Promise<PluginRegistryEntry[]> {
    if (this.registryCache !== null) {
      return this.registryCache;
    }

    const response = await requestUrl(PLUGIN_REGISTRY_URL);
    const parsed = response.json as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error('Obsidian community plugin registry returned an invalid response.');
    }

    this.registryCache = parsed.filter((entry): entry is PluginRegistryEntry => {
      if (typeof entry !== 'object' || entry === null) {
        return false;
      }
      const candidate = entry as { id?: unknown; repo?: unknown };
      return typeof candidate.id === 'string' && typeof candidate.repo === 'string';
    });
    return this.registryCache;
  }

  private async installPlugin(pluginId: string): Promise<void> {
    const pluginsApi = this.getPluginsApi();
    if (pluginsApi?.installPlugin === undefined) {
      throw new Error('This Obsidian version does not expose the plugin installation API required by Config Layer.');
    }

    const registry = await this.getPluginRegistry();
    const entry = registry.find((candidate) => candidate.id === pluginId);
    if (entry === undefined) {
      throw new Error(`Plugin ${pluginId} was not found in the Obsidian community plugin registry.`);
    }

    const manifestResponse = await requestUrl(`https://raw.githubusercontent.com/${entry.repo}/HEAD/manifest.json`);
    const manifest = manifestResponse.json as PluginManifest;
    if (manifest.id !== pluginId || typeof manifest.version !== 'string' || manifest.version.length === 0) {
      throw new Error(`Plugin ${pluginId} returned an invalid manifest.`);
    }

    try {
      await pluginsApi.installPlugin(entry.repo, manifest.version, manifest);
    } catch (error) {
      const alternateVersion = manifest.version.startsWith('v')
        ? manifest.version.slice(1)
        : `v${manifest.version}`;
      try {
        await pluginsApi.installPlugin(entry.repo, alternateVersion, manifest);
      } catch {
        throw error;
      }
    }

    await this.reloadPluginManifests();
  }

  private async reloadPluginManifests(): Promise<void> {
    const pluginsApi = this.getPluginsApi();
    if (pluginsApi?.loadManifests !== undefined) {
      await pluginsApi.loadManifests();
    }
    if (pluginsApi?.loadAvailablePlugins !== undefined) {
      await pluginsApi.loadAvailablePlugins();
    }
  }

  private async enablePlugin(pluginId: string): Promise<void> {
    const pluginsApi = this.getPluginsApi();
    if (pluginsApi?.enablePluginAndSave !== undefined) {
      await pluginsApi.enablePluginAndSave(pluginId);
      return;
    }

    if (pluginsApi?.enablePlugin === undefined) {
      throw new Error('This Obsidian version does not expose the plugin enable API required by Config Layer.');
    }

    await pluginsApi.enablePlugin(pluginId);
    await this.persistEnabledPlugin(pluginId);

    if (pluginsApi.saveEnabledPlugins !== undefined) {
      await pluginsApi.saveEnabledPlugins();
    } else if (pluginsApi.saveConfig !== undefined) {
      await pluginsApi.saveConfig();
    }
  }

  private async persistEnabledPlugin(pluginId: string): Promise<void> {
    const current = await this.getEnabledPluginIds();
    if (current.has(pluginId)) {
      return;
    }
    current.add(pluginId);
    await fs.writeFile(this.getEnabledPluginsPath(), `${JSON.stringify([...current], null, 2)}\n`, 'utf8');
  }

  private scheduleApply(): void {
    if (this.applyTimer !== null) {
      clearTimeout(this.applyTimer);
    }
    this.applyTimer = setTimeout(() => {
      this.applyTimer = null;
      void this.apply().catch((error) => {
        console.error('Config Layer: failed to apply required plugins', error);
        new Notice('Config Layer could not apply required plugins. Check the developer console.');
      });
    }, 250);
  }

  private stopWatcher(): void {
    this.watcher?.close();
    this.watcher = null;
  }
}
