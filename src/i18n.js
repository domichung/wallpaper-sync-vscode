'use strict';
const en = require('../locales/en.json');
const zh = require('../locales/zh-tw.json');

function resolveLanguage(preferred, vscodeLanguage) {
  if (preferred === 'en' || preferred === 'zh-tw') return preferred;
  const language = String(vscodeLanguage || '').toLowerCase();
  return /^(zh-tw|zh-hk|zh-mo|zh-hant)(-|$)/.test(language) ? 'zh-tw' : 'en';
}
function createTranslator(preference, vscodeLanguage) {
  const language = () => resolveLanguage(preference(), vscodeLanguage);
  const strings = () => ({...en, ...(language() === 'zh-tw' ? zh : {})});
  function t(key, ...args) {
    const value = strings()[key] || en[key] || key;
    return value.replace(/\{(\d+)\}/g, (match, index) => args[index] === undefined ? match : String(args[index]));
  }
  function error(message) {
    if (en[message]) return t(message);
    // 系統錯誤保留原文；我們自己加的說明才翻譯，檔案路徑不要動。
    for (const key of Object.keys(en)) {
      if (!key.endsWith('{0}')) continue;
      const prefix = key.slice(0, -3);
      if (message.startsWith(prefix)) return t(key, message.slice(prefix.length));
    }
    return message;
  }
  return {t, error, language, strings};
}
module.exports = {resolveLanguage, createTranslator};
