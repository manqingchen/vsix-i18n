const vscode = require('vscode');

async function searchWithWorkspace(patterns, includePattern, excludePattern, maxResults) {
  const results = [];
  if (!patterns.length) {
    return results;
  }

  const regex = buildRegex(patterns);
  const tokenSource = new vscode.CancellationTokenSource();

  await vscode.workspace.findTextInFiles(
    { pattern: regex, isRegExp: true },
    { include: includePattern, exclude: excludePattern },
    (result) => {
      const ranges = Array.isArray(result.ranges) ? result.ranges : [result.ranges];
      const previewText = result.preview && result.preview.text ? result.preview.text : '';
      for (const range of ranges) {
        results.push({
          uri: result.uri,
          relativePath: vscode.workspace.asRelativePath(result.uri),
          line: range.start.line,
          range,
          preview: previewText
        });
        if (results.length >= maxResults) {
          tokenSource.cancel();
          break;
        }
      }
    },
    tokenSource.token
  );

  return results;
}

function buildRegex(patterns) {
  const escaped = patterns.map((pattern) => escapeRegExp(pattern));
  return escaped.join('|');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  searchWithWorkspace
};
