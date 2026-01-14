const vscode = require('vscode');
const { getConfig } = require('../config');
const { loadTranslations, getTranslations } = require('../translation');
const { cleanupValue } = require('../text');
const { findKeysInWorkspace } = require('./findKeys');

const MAX_KEY_CANDIDATES = 500;

async function searchByKeyword(context, resultsView) {
  if (!vscode.workspace.workspaceFolders || !vscode.workspace.workspaceFolders.length) {
    vscode.window.showWarningMessage('未检测到工作区，无法搜索');
    return;
  }

  const query = await vscode.window.showInputBox({
    prompt: '输入中文或多语言 key',
    placeHolder: '例如: 订单.按钮.提交 或 立即购买',
    ignoreFocusOut: true
  });

  if (!query || !query.trim()) {
    vscode.window.showInformationMessage('请输入中文或 key 后再搜索');
    return;
  }

  if (!getTranslations().size) {
    await loadTranslations(context, false);
  }
  const normalizedQuery = query.trim();
  const keyCandidates = findKeysByQuery(normalizedQuery, MAX_KEY_CANDIDATES);

  if (!keyCandidates.length) {
    vscode.window.showInformationMessage('未找到匹配的多语言 key');
    if (resultsView) {
      resultsView.clear();
    }
    return;
  }

  const config = getConfig();
  const includePattern = config.get('search.includePattern', '**/*.{ts,tsx,js,jsx,vue,svelte,html,md,json}');
  const excludePattern = config.get('search.excludePattern', '**/{node_modules,.next}/**');
  const maxResults = config.get('search.maxResults', 200);

  const { results, engine } = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: '多语言搜索中'
    },
    async () => findKeysInWorkspace(keyCandidates, includePattern, excludePattern, maxResults)
  );

  if (!results.length) {
    vscode.window.showInformationMessage('未在项目中找到对应使用位置');
    if (resultsView) {
      resultsView.clear();
    }
    return;
  }

  if (resultsView) {
    resultsView.setResults(results);
    resultsView.show();
  }

  if (engine) {
    vscode.window.setStatusBarMessage(`已使用 ${engine} 搜索，找到 ${results.length} 处`, 2000);
  }
}

function findKeysByQuery(query, limit) {
  const normalized = query.toLowerCase();
  const keys = new Set();
  const translations = getTranslations();

  for (const [key, value] of translations.entries()) {
    if (keys.size >= limit) {
      break;
    }
    if (key.toLowerCase().includes(normalized)) {
      keys.add(key);
    }
    const cleaned = cleanupValue(value).toLowerCase();
    if (cleaned.includes(normalized)) {
      keys.add(key);
    }
  }

  if (!keys.size) {
    keys.add(query);
  }

  return Array.from(keys);
}

module.exports = {
  searchByKeyword
};
