const vscode = require('vscode');
const { getConfig } = require('./config');

const DEFAULT_SOURCE_URL = 'https://i.guazi-apps.com/api/multilingual/1/en';
const MANUAL_SOURCE_KEY = 'multilingual.manualSourceUrl';

function resolveSourceInfo(context) {
  const config = getConfig();
  const rules = config.get('source.rules', []);
  const defaultUrl = config.get('source.url', DEFAULT_SOURCE_URL);
  const manualUrl = getManualSourceUrl(context);
  if (manualUrl) {
    return {
      url: manualUrl,
      source: 'manual',
      match: ''
    };
  }
  const workspace = getWorkspaceFolder();
  if (!workspace) {
    return {
      url: defaultUrl,
      source: 'default',
      match: ''
    };
  }

  const workspaceName = workspace.name.toLowerCase();
  const workspacePath = workspace.uri.fsPath.toLowerCase();

  if (Array.isArray(rules)) {
    for (const rule of rules) {
      if (!rule || !rule.match || !rule.url) {
        continue;
      }
      const match = String(rule.match).toLowerCase();
      if (workspaceName.includes(match) || workspacePath.includes(match)) {
        return {
          url: rule.url,
          source: 'rule',
          match: rule.match
        };
      }
    }
  }

  return {
    url: defaultUrl,
    source: 'default',
    match: ''
  };
}

function resolveSourceUrl(context) {
  return resolveSourceInfo(context).url;
}

function getManualSourceUrl(context) {
  if (!context) {
    return null;
  }
  return context.workspaceState.get(MANUAL_SOURCE_KEY, null);
}

async function setManualSourceUrl(context, url) {
  if (!context) {
    return;
  }
  await context.workspaceState.update(MANUAL_SOURCE_KEY, url);
}

async function clearManualSourceUrl(context) {
  if (!context) {
    return;
  }
  await context.workspaceState.update(MANUAL_SOURCE_KEY, null);
}

function getSourceHint(info) {
  if (!info) {
    return '默认配置';
  }
  if (info.source === 'manual') {
    return '手动切换';
  }
  if (info.source === 'rule') {
    return `规则(${info.match})`;
  }
  return '默认配置';
}

function getWorkspaceFolder() {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    if (folder) {
      return folder;
    }
  }
  const folders = vscode.workspace.workspaceFolders || [];
  return folders.length ? folders[0] : null;
}

module.exports = {
  resolveSourceInfo,
  resolveSourceUrl,
  getManualSourceUrl,
  setManualSourceUrl,
  clearManualSourceUrl,
  getSourceHint,
  DEFAULT_SOURCE_URL
};
