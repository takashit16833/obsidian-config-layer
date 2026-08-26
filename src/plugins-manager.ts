import { Notice, requestUrl, type App, type PluginManifest } from 'obsidian';
import { promises as fs, watch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { getVaultPluginsPath, resolveConfiguredPath } from './paths';
import { parseRequiredPluginIds } from './plugin-list';
import type { ConfigLayerSettings } from './types';

const COMMUNITY_PLUGIN_REGISTRY_URL =
  'https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json';
const SELF_PLUGIN_ID = 'config-layer';

interface CommunityPluginEntry {
  id: string;
  repo: string;
}

interface PluginsApi {
  manifests?: Record<string, PluginManifest>;
  enabledPlugins?: Set<string> | string[];
  plugins?: Record<string, unknown>;
  installPlugin?: (repo: string, version: string, manifest: PluginManifest) => Promise<void>;
  loadManifests?: () => Promise<void>;
  enablePluginAndSave?: (pluginId: string) => Promise<void>;
  enablePlugin?: (pluginId: string) => Promise<void>;
  saveEnabledPlugins?: () => Promise<void>;
}

interface InstallPlan {
  id: string;
  repo: string;
  manifest: PluginManifest;
}

export interface ApplyPluginsResult {
  applied: boolean;
  installed: number;
  enabled: number;
}

function isCommunityPluginEntry(value: unknown): value is CommunityPluginEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string' && typeof candidate.repo === 'string';
}

function isPluginManifest(value: unknown): value is PluginManifest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.version === 'string'
    && typeof candidate.minAppVersion === 'string';
}

export class PluginsManager {
  private watcher: FSWatcher | null = null;
  private applyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly app: App,
    private readonly getSettings: () => ConfigLayerSettings,
  ) {}

  async apply(): Promise<ApplyPluginsResult> {
    const folder = this.resolvePluginsFolder();
    if (folder === null) {
      return { applied: false, installed: 0, enabled: 0 };
    }

    const requiredIds = await this.readRequiredPluginIds(path.join(folder, 'plugins.json'));
    const pluginIds = requiredIds.filter((id) => id !== SELF_PLUGIN_ID);
    if (pluginIds.length === 0) {
      return { applied: true, installed: 0, enabled: 0 };
    }

    const pluginsApi = this.getPluginsApi();
    const missingIds: string[] = [];
    const disabledIds: string[] = [];

    for (const id of pluginIds) {
      if (await this.isFullyInstalled(id)) {
        if (!this.isEnabled(pluginsApi, id)) {
          disabledIds.push(id);
        }
      } else {
        missingIds.push(id);
      }
    }

    if (missingIds.length > 0 && typeof pluginsApi?.installPlugin !== 'function') {
      throw new Error('This Obsidian version does not expose the plugin installation API used by Config Layer.');
    }

    if ((missingIds.length > 0 || disabledIds.length > 0) && !this.canEnablePlugins(pluginsApi)) {
      throw new Error('This Obsidian version does not expose a supported plugin enable API used by Config Layer.');
    }

    const plans = missingIds.length > 0
      ? await this.prepareInstallPlans(missingIds)
      : [];

    let installed = 0;
    let enabled = 0;

    for (const plan of plans) {
      await this.installPlugin(pluginsApi!, plan);
      installed += 1;
      if (await this.enablePlugin(pluginsApi!, plan.id)) {
        enabled += 1;
      }
    }

    for (const id of disabledIds) {
      if (await this.enablePlugin(pluginsApi!, id)) {
        enabled += 1;
      }
    }

    return { applied: true, installed, enabled };
  }

  restartWatcher(): void {
    this.stopWatcher();

    if (!this.getSettings().watchExternalFiles) {
      return;
    }

    const folder = this.resolvePluginsFolder();
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

  private resolvePluginsFolder(): string | null {
    const settings = this.getSettings();
    const configured = settings.pluginsFolder.trim().length > 0
      ? settings.pluginsFolder
      : settings.hotkeysFolder;
    return resolveConfiguredPath(this.app, configured);
  }

  private getPluginsApi(): PluginsApi | undefined {
    return (this.app as App & { plugins?: PluginsApi }).plugins;
  }

  private async readRequiredPluginIds(filePath: string): Promise<string[]> {
    try {
      const text = await fs.readFile(filePath, 'utf8');
      return parseRequiredPluginIds(JSON.parse(text) as unknown);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  private async isFullyInstalled(pluginId: string): Promise<boolean> {
    const folder = getVaultPluginsPath(this.app);
    try {
      await Promise.all([
        fs.access(path.join(folder, pluginId, 'manifest.json')),
        fs.access(path.join(folder, pluginId, 'main.js')),
      ]);
      return true;
    } catch {
      return false;
    }
  }

  private isEnabled(pluginsApi: PluginsApi | undefined, pluginId: string): boolean {
    if (pluginsApi?.enabledPlugins instanceof Set) {
      return pluginsApi.enabledPlugins.has(pluginId);
    }
    if (Array.isArray(pluginsApi?.enabledPlugins)) {
      return pluginsApi.enabledPlugins.includes(pluginId);
    }
    return Object.prototype.hasOwnProperty.call(pluginsApi?.plugins ?? {}, pluginId);
  }

  private canEnablePlugins(pluginsApi: PluginsApi | undefined): boolean {
    return typeof pluginsApi?.enablePluginAndSave === 'function'
      || (typeof pluginsApi?.enablePlugin === 'function'
        && typeof pluginsApi?.saveEnabledPlugins === 'function');
  }

  private async prepareInstallPlans(pluginIds: string[]): Promise<InstallPlan[]> {
    const response = await requestUrl({ url: COMMUNITY_PLUGIN_REGISTRY_URL });
    const registryValue = response.json as unknown;
    if (!Array.isArray(registryValue)) {
      throw new Error('Obsidian community plugin registry returned an unexpected response.');
    }

    const registry = registryValue.filter(isCommunityPluginEntry);
    const plans: InstallPlan[] = [];

    for (const id of pluginIds) {
      const entry = registry.find((candidate) => candidate.id === id);
      if (!entry) {
        throw new Error(`Required plugin "${id}" was not found in the Obsidian community plugin registry.`);
      }
      if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(entry.repo)) {
        throw new Error(`Required plugin "${id}" has an invalid repository entry.`);
      }

      const manifest = await this.fetchManifest(entry.repo, id);
      plans.push({ id, repo: entry.repo, manifest });
    }

    return plans;
  }

  private async fetchManifest(repo: string, pluginId: string): Promise<PluginManifest> {
    const urls = [
      `https://raw.githubusercontent.com/${repo}/HEAD/manifest.json`,
      `https://raw.githubusercontent.com/${repo}/main/manifest.json`,
      `https://raw.githubusercontent.com/${repo}/master/manifest.json`,
    ];

    for (const url of urls) {
      try {
        const response = await requestUrl({ url });
        const manifestValue = response.json as unknown;
        if (isPluginManifest(manifestValue) && manifestValue.id === pluginId) {
          return manifestValue;
        }
      } catch {
        // Try the next conventional repository ref.
      }
    }

    throw new Error(`Could not resolve a valid manifest for required plugin "${pluginId}".`);
  }

  private async installPlugin(pluginsApi: PluginsApi, plan: InstallPlan): Promise<void> {
    const installPlugin = pluginsApi.installPlugin;
    if (typeof installPlugin !== 'function') {
      throw new Error('Plugin installation API became unavailable.');
    }

    const version = plan.manifest.version;
    try {
      await installPlugin.call(pluginsApi, plan.repo, version, plan.manifest);
    } catch (firstError) {
      const alternateVersion = version.startsWith('v') ? version.slice(1) : `v${version}`;
      try {
        await installPlugin.call(pluginsApi, plan.repo, alternateVersion, plan.manifest);
      } catch {
        throw firstError;
      }
    }

    if (typeof pluginsApi.loadManifests === 'function') {
      await pluginsApi.loadManifests();
    }

    if (!(await this.isFullyInstalled(plan.id))) {
      throw new Error(`Required plugin "${plan.id}" did not appear in the vault after installation.`);
    }
  }

  private async enablePlugin(pluginsApi: PluginsApi, pluginId: string): Promise<boolean> {
    if (this.isEnabled(pluginsApi, pluginId)) {
      return false;
    }

    if (typeof pluginsApi.enablePluginAndSave === 'function') {
      await pluginsApi.enablePluginAndSave(pluginId);
      return true;
    }

    if (typeof pluginsApi.enablePlugin === 'function'
      && typeof pluginsApi.saveEnabledPlugins === 'function') {
      await pluginsApi.enablePlugin(pluginId);
      await pluginsApi.saveEnabledPlugins();
      return true;
    }

    throw new Error(`Required plugin "${pluginId}" could not be enabled.`);
  }

  private scheduleApply(): void {
    if (this.applyTimer !== null) {
      clearTimeout(this.applyTimer);
    }

    this.applyTimer = setTimeout(() => {
      this.applyTimer = null;
      void this.apply()
        .then((result) => {
          if (result.installed > 0 || result.enabled > 0) {
            new Notice(`Config Layer applied required plugins: ${result.installed} installed, ${result.enabled} enabled.`);
          }
        })
        .catch((error) => {
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
