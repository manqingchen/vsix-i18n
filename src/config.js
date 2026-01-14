const vscode = require('vscode');

function getConfig() {
  return vscode.workspace.getConfiguration('multilingual');
}

module.exports = {
  getConfig
};
