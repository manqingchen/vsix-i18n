const { isRipgrepAvailable, searchWithRipgrep } = require('./ripgrep');
const { searchWithWorkspace } = require('./workspaceSearch');

async function findKeysInWorkspace(keys, includePattern, excludePattern, maxResults) {
  const patterns = Array.isArray(keys) ? keys.filter(Boolean) : [];
  if (!patterns.length) {
    return { results: [], engine: '' };
  }

  const canUseRipgrep = await isRipgrepAvailable();
  if (canUseRipgrep) {
    const results = await searchWithRipgrep(patterns, includePattern, excludePattern, maxResults);
    return { results, engine: 'rg' };
  }

  const results = await searchWithWorkspace(patterns, includePattern, excludePattern, maxResults);
  return { results, engine: '工作区搜索' };
}

module.exports = {
  findKeysInWorkspace
};
