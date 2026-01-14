const { execFile, spawn } = require('child_process');
const path = require('path');
const vscode = require('vscode');

let rgAvailablePromise = null;

function isRipgrepAvailable() {
  if (!rgAvailablePromise) {
    rgAvailablePromise = new Promise((resolve) => {
      execFile('rg', ['--version'], { timeout: 1500 }, (error) => {
        resolve(!error);
      });
    });
  }
  return rgAvailablePromise;
}

async function searchWithRipgrep(patterns, includePattern, excludePattern, maxResults) {
  const folders = vscode.workspace.workspaceFolders || [];
  if (!folders.length) {
    return [];
  }

  const results = [];
  for (const folder of folders) {
    if (results.length >= maxResults) {
      break;
    }
    await runRipgrepInFolder(
      folder.uri.fsPath,
      patterns,
      includePattern,
      excludePattern,
      maxResults,
      results
    );
  }

  return results;
}

function runRipgrepInFolder(folderPath, patterns, includePattern, excludePattern, maxResults, results) {
  return new Promise((resolve) => {
    const args = buildRipgrepArgs(patterns, includePattern, excludePattern);
    const child = spawn('rg', args, {
      cwd: folderPath,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let buffer = '';
    let stopped = false;

    const stopProcess = () => {
      if (stopped) {
        return;
      }
      stopped = true;
      child.kill();
    };

    child.stdout.on('data', (chunk) => {
      if (stopped) {
        return;
      }
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }
        const match = parseRipgrepMatch(line, folderPath);
        if (!match) {
          continue;
        }
        results.push(match);
        if (results.length >= maxResults) {
          stopProcess();
          break;
        }
      }
    });

    child.on('error', () => resolve());
    child.on('close', () => resolve());
  });
}

function buildRipgrepArgs(patterns, includePattern, excludePattern) {
  const args = ['--json', '--fixed-strings'];
  for (const pattern of patterns) {
    args.push('-e', pattern);
  }
  if (includePattern) {
    args.push('--glob', includePattern);
  }
  if (excludePattern) {
    args.push('--glob', `!${excludePattern}`);
  }
  return args;
}

function parseRipgrepMatch(line, folderPath) {
  let payload;
  try {
    payload = JSON.parse(line);
  } catch (error) {
    return null;
  }
  if (!payload || payload.type !== 'match') {
    return null;
  }

  const data = payload.data;
  const filePath = resolveMatchPath(folderPath, data.path && data.path.text);
  if (!filePath) {
    return null;
  }
  const lineText = (data.lines && data.lines.text ? data.lines.text : '').replace(/\r?\n$/, '');
  const lineNumber = Math.max((data.line_number || 1) - 1, 0);
  const submatch = Array.isArray(data.submatches) && data.submatches.length ? data.submatches[0] : null;
  if (!submatch) {
    return null;
  }
  const startCol = toCharIndex(lineText, submatch.start || 0);
  const endCol = toCharIndex(lineText, submatch.end || 0);
  const uri = vscode.Uri.file(filePath);
  const range = new vscode.Range(lineNumber, startCol, lineNumber, endCol);
  const relativePath = vscode.workspace.asRelativePath(uri);

  return {
    uri,
    relativePath,
    line: lineNumber,
    range,
    preview: lineText
  };
}

function resolveMatchPath(folderPath, matchPath) {
  if (!matchPath) {
    return '';
  }
  if (path.isAbsolute(matchPath)) {
    return matchPath;
  }
  return path.join(folderPath, matchPath);
}

function toCharIndex(text, byteIndex) {
  if (!text) {
    return 0;
  }
  const safeIndex = Math.min(byteIndex, Buffer.byteLength(text));
  return Buffer.from(text).slice(0, safeIndex).toString('utf8').length;
}

module.exports = {
  isRipgrepAvailable,
  searchWithRipgrep
};
