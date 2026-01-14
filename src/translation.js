const https = require('https');
const { URL } = require('url');
const vscode = require('vscode');
const { getConfig } = require('./config');
const { resolveSourceInfo, getSourceHint } = require('./sourceConfig');

let translationMap = new Map();
let loadingPromise = null;
const CACHE_KEY = 'multilingual.cache';
let lastSourceHint = '';

function getTranslations() {
  return translationMap;
}

async function loadTranslations(context, force) {
  if (loadingPromise) {
    if (force) {
      return loadingPromise.then(() => loadTranslations(context, true));
    }
    return loadingPromise;
  }

  loadingPromise = loadTranslationsInternal(context, force).finally(() => {
    loadingPromise = null;
  });

  return loadingPromise;
}

async function loadTranslationsInternal(context, force) {
  const config = getConfig();
  const sourceInfo = resolveSourceInfo(context);
  const url = sourceInfo.url;
  const ttlMinutes = config.get('cache.ttlMinutes', 360);
  const now = Date.now();
  const cached = getCacheEntry(context, url);
  showSourceHint(sourceInfo);

  if (!force && cached && cached.timestamp && now - cached.timestamp < ttlMinutes * 60 * 1000) {
    translationMap = new Map(Object.entries(cached.data || {}));
    return;
  }

  try {
    const data = await fetchJson(url);
    if (data && typeof data === 'object') {
      translationMap = new Map(Object.entries(data));
      await setCacheEntry(context, url, { timestamp: now, data });
      vscode.window.setStatusBarMessage('多语言英文映射已刷新', 2000);
    }
  } catch (error) {
    if (cached && cached.data) {
      translationMap = new Map(Object.entries(cached.data || {}));
      vscode.window.showWarningMessage('多语言接口请求失败，使用缓存数据');
      return;
    }
    vscode.window.showWarningMessage('多语言接口请求失败');
  }
}

function showSourceHint(info) {
  const hint = getSourceHint(info);
  if (hint && hint !== lastSourceHint) {
    lastSourceHint = hint;
    vscode.window.setStatusBarMessage(`多语言接口: ${hint}`, 2000);
  }
}

function getCacheEntry(context, url) {
  const cached = context.globalState.get(CACHE_KEY, null);
  if (!cached) {
    return null;
  }
  if (cached.byUrl && cached.byUrl[url]) {
    return cached.byUrl[url];
  }
  if (cached.timestamp && cached.data) {
    return cached;
  }
  return null;
}

async function setCacheEntry(context, url, entry) {
  const cached = context.globalState.get(CACHE_KEY, null);
  const byUrl = cached && cached.byUrl ? cached.byUrl : {};
  byUrl[url] = entry;
  await context.globalState.update(CACHE_KEY, { byUrl });
}

function fetchJson(urlString) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        protocol: url.protocol,
        method: 'GET'
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (err) {
            reject(err);
          }
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}

module.exports = {
  getTranslations,
  loadTranslations
};
