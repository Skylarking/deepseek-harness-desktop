/** Localized copy shared by the native plugin dialogs and manager renderer. */
export interface PluginLocale {
  language: 'en' | 'zh-CN'
  windowTitle: string
  title: string
  loading: string
  openProfile: string
  restart: string
  installLocal: string
  plugins: string
  skillPackages: string
  otherPackages: string
  emptyTitle: string
  emptyDescription: string
  enabled: string
  disabled: string
  skill: string
  package: string
  openSource: string
  enable: string
  disable: string
  remove: string
  cancel: string
  restarting: string
  restarted: string
  summary: (plugins: number, skills: number, packages: number) => string
  installTitle: string
  installCanceled: string
  installed: (path: string) => string
  conflictTitle: string
  conflictMessage: (plugin: string) => string
  conflictDetail: (plugins: string) => string
  conflictCanceled: string
  removeTitle: string
  removeMessage: (name: string) => string
  removeDetail: string
  removalCanceled: string
  removed: (name: string) => string
  toggleTitle: (enabled: boolean) => string
  toggleMessage: (name: string, enabled: boolean) => string
  toggleDetail: (enabled: boolean) => string
  toggleCanceled: (enabled: boolean) => string
  toggleComplete: (name: string, enabled: boolean) => string
  alreadyToggled: (name: string, enabled: boolean) => string
}

const ENGLISH: PluginLocale = {
  language: 'en',
  windowTitle: 'DSH Plugins',
  title: 'Plugins',
  loading: 'Loading profile...',
  openProfile: 'Open profile folder',
  restart: 'Restart DSH',
  installLocal: 'Install Local',
  plugins: 'Plugins',
  skillPackages: 'Skill packages',
  otherPackages: 'Other packages',
  emptyTitle: 'No custom plugins installed',
  emptyDescription: 'Install a local package to add it to the Web profile.',
  enabled: 'Enabled',
  disabled: 'Disabled',
  skill: 'Skill',
  package: 'Package',
  openSource: 'Open Source',
  enable: 'Enable',
  disable: 'Disable',
  remove: 'Remove',
  cancel: 'Cancel',
  restarting: 'Restarting DSH...',
  restarted: 'DSH restarted',
  summary: (plugins, skills, packages) => `${plugins} plugins · ${skills} skill packages · ${packages} other packages`,
  installTitle: 'Install Local DSH Package',
  installCanceled: 'Installation canceled',
  installed: path => `Installed ${path}`,
  conflictTitle: 'Replace Conflicting Plugins',
  conflictMessage: plugin => `${plugin} replaces enabled conflicting plugins. Continue?`,
  conflictDetail: plugins => `The following enabled plugins will be disabled and restored when the replacement is removed or disabled:\n${plugins}`,
  conflictCanceled: 'Installation canceled',
  removeTitle: 'Remove Plugin',
  removeMessage: name => `Remove ${name} from the Web profile?`,
  removeDetail: 'The plugin source directory will not be deleted. Plugin-owned settings will be removed.',
  removalCanceled: 'Removal canceled',
  removed: name => `Removed ${name}`,
  toggleTitle: enabled => `${enabled ? 'Enable' : 'Disable'} Plugin`,
  toggleMessage: (name, enabled) => `${enabled ? 'Enable' : 'Disable'} ${name}?`,
  toggleDetail: enabled => enabled
    ? 'The local runtime will restart and the plugin will regain its previous settings.'
    : 'The local runtime will restart. The plugin remains installed and its settings are preserved.',
  toggleCanceled: enabled => `${enabled ? 'Enable' : 'Disable'} canceled`,
  toggleComplete: (name, enabled) => `${enabled ? 'Enabled' : 'Disabled'} ${name}`,
  alreadyToggled: (name, enabled) => `${name} is already ${enabled ? 'enabled' : 'disabled'}`,
}

const CHINESE: PluginLocale = {
  language: 'zh-CN',
  windowTitle: 'DSH 插件',
  title: '插件',
  loading: '正在加载 profile...',
  openProfile: '打开 profile 文件夹',
  restart: '重启 DSH',
  installLocal: '安装本地包',
  plugins: '插件',
  skillPackages: 'Skill 包',
  otherPackages: '其他包',
  emptyTitle: '尚未安装自定义插件',
  emptyDescription: '选择本地包目录，将其添加到 Web profile。',
  enabled: '已启用',
  disabled: '已停用',
  skill: 'Skill',
  package: '包',
  openSource: '打开源码',
  enable: '启用',
  disable: '停用',
  remove: '卸载',
  cancel: '取消',
  restarting: '正在重启 DSH...',
  restarted: 'DSH 已重启',
  summary: (plugins, skills, packages) => `${plugins} 个插件 · ${skills} 个 skill 包 · ${packages} 个其他包`,
  installTitle: '安装本地 DSH 包',
  installCanceled: '已取消安装',
  installed: path => `已安装 ${path}`,
  conflictTitle: '替换冲突插件',
  conflictMessage: plugin => `${plugin} 会替换已启用的冲突插件。是否继续？`,
  conflictDetail: plugins => `以下已启用插件会被停用，并在替换插件卸载或停用时恢复：\n${plugins}`,
  conflictCanceled: '已取消安装',
  removeTitle: '卸载插件',
  removeMessage: name => `从 Web profile 卸载 ${name}？`,
  removeDetail: '不会删除插件源码目录，但会移除插件拥有的设置。',
  removalCanceled: '已取消卸载',
  removed: name => `已卸载 ${name}`,
  toggleTitle: enabled => `${enabled ? '启用' : '停用'}插件`,
  toggleMessage: (name, enabled) => `${enabled ? '启用' : '停用'} ${name}？`,
  toggleDetail: enabled => enabled
    ? '本地 runtime 将重新启动，插件会恢复之前的设置。'
    : '本地 runtime 将重新启动。插件仍保持安装，其设置也会保留。',
  toggleCanceled: enabled => `已取消${enabled ? '启用' : '停用'}`,
  toggleComplete: (name, enabled) => `已${enabled ? '启用' : '停用'} ${name}`,
  alreadyToggled: (name, enabled) => `${name} 已经${enabled ? '启用' : '停用'}`,
}

/** Resolve supported plugin-manager copy from a BCP 47 language tag. */
export function pluginLocale(language: string): PluginLocale {
  return language.toLocaleLowerCase().startsWith('zh') ? CHINESE : ENGLISH
}
