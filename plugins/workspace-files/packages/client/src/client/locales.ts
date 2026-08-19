/** Workspace file browser dictionaries. */

/** Simplified Chinese dictionary and key source. */
export const zh = {
  'action.open': '项目文件',
  'action.close': '关闭文件预览',
  'action.resizeTree': '调节文件列表宽度',
  'title': '文件',
  'workspace': '工作空间',
  'path': '文件路径',
  'empty.workspaces': '还没有可浏览的工作空间',
  'empty.directory': '此文件夹为空',
  'empty.preview': '选择一个文件以预览',
  'loading': '正在加载…',
  'error.list': '无法读取此文件夹',
  'error.read': '无法预览此文件',
  'ignored': '已忽略大型生成目录',
  'truncated': '条目过多，仅显示前 500 项',
  'unsupported.binary': '这是二进制文件，无法预览',
  'unsupported.too-large': '文件过大，无法预览',
  'unsupported.unreadable': '文件无法读取',
} satisfies Record<string, string>

/** Workspace file browser dictionary keys. */
export type WorkspaceFilesKey = keyof typeof zh

/** English dictionary, checked against Chinese keys. */
export const en = {
  'action.open': 'Project files',
  'action.close': 'Close file preview',
  'action.resizeTree': 'Resize file list',
  'title': 'Files',
  'workspace': 'Workspace',
  'path': 'File path',
  'empty.workspaces': 'No workspace is available to browse',
  'empty.directory': 'This folder is empty',
  'empty.preview': 'Select a file to preview',
  'loading': 'Loading…',
  'error.list': 'Could not read this folder',
  'error.read': 'Could not preview this file',
  'ignored': 'Large generated directory ignored',
  'truncated': 'Too many entries; only the first 500 are shown',
  'unsupported.binary': 'This binary file cannot be previewed',
  'unsupported.too-large': 'This file is too large to preview',
  'unsupported.unreadable': 'This file cannot be read',
} satisfies Record<WorkspaceFilesKey, string>
