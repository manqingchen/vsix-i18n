const vscode = require('vscode');
const { loadTranslations } = require('./translation');
const { getConfig } = require('./config');
const {
  resolveSourceInfo,
  getSourceHint,
  setManualSourceUrl,
  clearManualSourceUrl,
  DEFAULT_SOURCE_URL
} = require('./sourceConfig');
const {
  initDecorations,
  disposeDecorations,
  recreateDecorationType,
  refreshAllEditors,
  scheduleUpdate
} = require('./decoration');
const { initResultsView } = require('./resultsView');
const { searchByKeyword } = require('./search');

async function handleSwitchSource(context) {
  const config = getConfig();
  const rules = config.get('source.rules', []);
  const defaultUrl = config.get('source.url', DEFAULT_SOURCE_URL);
  const currentInfo = resolveSourceInfo(context);
  const items = [];

  if (currentInfo.source === 'manual') {
    items.push({
      label: '当前手动地址',
      description: currentInfo.url,
      type: 'manualCurrent',
      url: currentInfo.url,
      picked: true
    });
  }

  if (Array.isArray(rules)) {
    for (const rule of rules) {
      if (!rule || !rule.match || !rule.url) {
        continue;
      }
      items.push({
        label: `规则: ${rule.match}`,
        description: rule.url,
        type: 'rule',
        url: rule.url,
        picked: currentInfo.source === 'rule' && String(currentInfo.match) === String(rule.match)
      });
    }
  }

  items.push({
    label: '默认配置',
    description: defaultUrl,
    type: 'default',
    url: defaultUrl,
    picked: currentInfo.source === 'default'
  });

  items.push({
    label: '手动输入',
    description: '输入自定义接口地址',
    type: 'input'
  });

  items.push({
    label: '清除手动切换',
    description: '恢复规则/默认配置',
    type: 'clear'
  });

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: '选择多语言接口地址'
  });
  if (!picked) {
    return;
  }

  if (picked.type === 'clear') {
    await clearManualSourceUrl(context);
  } else if (picked.type === 'input') {
    const input = await vscode.window.showInputBox({
      prompt: '请输入多语言接口地址',
      value: currentInfo.url,
      ignoreFocusOut: true
    });
    if (!input || !input.trim()) {
      return;
    }
    await setManualSourceUrl(context, input.trim());
  } else if (picked.url) {
    await setManualSourceUrl(context, picked.url);
  }

  const sourceInfo = resolveSourceInfo(context);
  vscode.window.showInformationMessage(
    `已切换多语言接口：${sourceInfo.url}（${getSourceHint(sourceInfo)}）`
  );
  await loadTranslations(context, true);
  refreshAllEditors();
}

function showCurrentSource(context) {
  const sourceInfo = resolveSourceInfo(context);
  vscode.window.showInformationMessage(
    `当前多语言接口：${sourceInfo.url}（${getSourceHint(sourceInfo)}）`
  );
}

function activate(context) {
  initDecorations();
  const resultsView = initResultsView(context);

  const loadPromise = loadTranslations(context, false);

  context.subscriptions.push(
    vscode.commands.registerCommand('multilingual.refresh', async () => {
      await loadTranslations(context, true);
      refreshAllEditors();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('multilingual.search', async () => {
      await loadPromise;
      await searchByKeyword(context, resultsView);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('multilingual.switchSource', async () => {
      await handleSwitchSource(context);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('multilingual.showSource', async () => {
      showCurrentSource(context);
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      scheduleUpdate(editor);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || event.document !== editor.document) {
        return;
      }
      scheduleUpdate(editor);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('multilingual')) {
        return;
      }
      recreateDecorationType();
      refreshAllEditors();
    })
  );

  loadPromise.then(() => refreshAllEditors());
}

function deactivate() {
  disposeDecorations();
}

module.exports = {
  activate,
  deactivate
};
