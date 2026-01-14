function cleanupValue(value) {
  if (!value) {
    return '';
  }
  return String(value).replace(/<[^>]*>/g, '').trim();
}

function truncate(value, maxLength) {
  if (!value) {
    return '';
  }
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
}

module.exports = {
  cleanupValue,
  truncate
};
