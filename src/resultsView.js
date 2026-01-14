const vscode = require('vscode');

const MAX_PREVIEW_LENGTH = 160;

class SearchResultsProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    this.results = [];
  }

  setResults(results) {
    this.results = Array.isArray(results) ? results : [];
    this._onDidChangeTreeData.fire();
  }

  clear() {
    this.results = [];
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element) {
    return element;
  }

  getChildren(element) {
    if (!element) {
      return this.buildFileNodes();
    }
    if (element.contextValue === 'file') {
      return element.children;
    }
    return [];
  }

  buildFileNodes() {
    const grouped = new Map();

    for (const item of this.results) {
      const key = item.uri.toString();
      if (!grouped.has(key)) {
        grouped.set(key, { uri: item.uri, relativePath: item.relativePath, items: [] });
      }
      grouped.get(key).items.push(item);
    }

    const fileNodes = [];
    for (const group of grouped.values()) {
      const children = group.items.map((match) => createMatchNode(match));
      const fileNode = createFileNode(group.relativePath, group.uri, children.length, children);
      fileNodes.push(fileNode);
    }

    return fileNodes.sort((a, b) => a.label.localeCompare(b.label));
  }
}

function createFileNode(relativePath, uri, count, children) {
  const item = new vscode.TreeItem(relativePath, vscode.TreeItemCollapsibleState.Expanded);
  item.description = `${count}`;
  item.contextValue = 'file';
  item.resourceUri = uri;
  item.children = children;
  return item;
}

function createMatchNode(match) {
  const label = `L${match.line + 1}`;
  const preview = truncatePreview(match.preview);
  const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
  item.description = preview;
  item.contextValue = 'match';
  item.command = {
    title: '打开',
    command: 'multilingual.openResult',
    arguments: [match]
  };
  return item;
}

function truncatePreview(text) {
  if (!text) {
    return '';
  }
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= MAX_PREVIEW_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_PREVIEW_LENGTH - 3)}...`;
}

function initResultsView(context) {
  const provider = new SearchResultsProvider();
  const treeView = vscode.window.createTreeView('multilingual.searchResults', {
    treeDataProvider: provider,
    showCollapseAll: true
  });

  context.subscriptions.push(treeView);

  context.subscriptions.push(
    vscode.commands.registerCommand('multilingual.openResult', async (match) => {
      if (!match || !match.uri || !match.range) {
        return;
      }
      const doc = await vscode.workspace.openTextDocument(match.uri);
      const editor = await vscode.window.showTextDocument(doc);
      editor.selection = new vscode.Selection(match.range.start, match.range.end);
      editor.revealRange(match.range, vscode.TextEditorRevealType.InCenter);
    })
  );

  return {
    setResults: (results) => provider.setResults(results),
    clear: () => provider.clear(),
    show: () => vscode.commands.executeCommand('workbench.view.extension.multilingualSearch')
  };
}

module.exports = {
  initResultsView
};
