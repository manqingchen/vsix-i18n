const vscode = require('vscode');
const { getConfig } = require('./config');
const { getTranslations } = require('./translation');
const { cleanupValue, truncate } = require('./text');

const TOKEN_REGEX = /[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+/g;
const MAX_LINE_COUNT = 6000;
const UPDATE_DEBOUNCE_MS = 200;

let decorationType;
let updateTimer;

function initDecorations() {
  createDecorationType();
}

function disposeDecorations() {
  if (decorationType) {
    decorationType.dispose();
  }
}

function recreateDecorationType() {
  if (decorationType) {
    decorationType.dispose();
  }
  createDecorationType();
}

function createDecorationType() {
  const color = getConfig().get('inline.color', '#9b8d7e');
  decorationType = vscode.window.createTextEditorDecorationType({
    after: {
      margin: '0 0 0 1em',
      color
    }
  });
}

function scheduleUpdate(editor) {
  if (!editor) {
    return;
  }
  clearTimeout(updateTimer);
  updateTimer = setTimeout(() => updateDecorations(editor), UPDATE_DEBOUNCE_MS);
}

function refreshAllEditors() {
  vscode.window.visibleTextEditors.forEach((editor) => {
    updateDecorations(editor);
  });
}

function updateDecorations(editor) {
  const config = getConfig();
  const enabled = config.get('inline.enabled', true);
  const translations = getTranslations();

  if (!enabled || !translations.size) {
    editor.setDecorations(decorationType, []);
    return;
  }

  if (editor.document.lineCount > MAX_LINE_COUNT) {
    editor.setDecorations(decorationType, []);
    return;
  }

  const maxLength = config.get('inline.maxLength', 80);
  const decorations = [];
  const tokenRegex = new RegExp(TOKEN_REGEX);

  for (let i = 0; i < editor.document.lineCount; i += 1) {
    const line = editor.document.lineAt(i);
    const text = line.text;
    let match;

    tokenRegex.lastIndex = 0;
    while ((match = tokenRegex.exec(text)) !== null) {
      const key = match[0];
      const value = translations.get(key);
      if (!value) {
        continue;
      }
      const cleaned = cleanupValue(value);
      if (!cleaned) {
        continue;
      }
      const display = truncate(cleaned, maxLength);
      const start = match.index;
      const end = match.index + key.length;

      decorations.push({
        range: new vscode.Range(i, start, i, end),
        renderOptions: {
          after: {
            contentText: ` ${display}`
          }
        }
      });
    }
  }

  editor.setDecorations(decorationType, decorations);
}

module.exports = {
  initDecorations,
  disposeDecorations,
  recreateDecorationType,
  refreshAllEditors,
  scheduleUpdate
};
