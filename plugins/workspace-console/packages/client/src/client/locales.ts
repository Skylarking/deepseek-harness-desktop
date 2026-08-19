/** Workspace console dictionaries. */
export const zh = {
  'action.open': '命令行控制台', 'action.close': '关闭命令行控制台', 'action.new': '新建终端', 'action.closeTab': '关闭终端', 'title': '命令行控制台',
  'workspace': '工作空间', 'error': '终端连接失败', 'truncated': '较早的终端输出已截断',
  'noWorkspace': '还没有可执行命令的工作空间',
} satisfies Record<string, string>
/** Workspace console dictionary keys. */
export type WorkspaceConsoleKey = keyof typeof zh
/** English dictionary, checked against Chinese keys. */
export const en = {
  'action.open': 'Command console', 'action.close': 'Close command console', 'action.new': 'New terminal', 'action.closeTab': 'Close terminal', 'title': 'Command console',
  'workspace': 'Workspace', 'error': 'Terminal connection failed', 'truncated': 'Earlier terminal output was truncated',
  'noWorkspace': 'No workspace is available for commands',
} satisfies Record<WorkspaceConsoleKey, string>
