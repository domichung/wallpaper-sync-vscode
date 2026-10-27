'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {resolveLanguage, createTranslator} = require('../src/i18n');
const {validSetting} = require('../src/sidebar');

test('language follows VS Code until overridden, with English fallback', () => {
  assert.equal(resolveLanguage('auto', 'zh-tw'), 'zh-tw');
  assert.equal(resolveLanguage('auto', 'zh-Hant'), 'zh-tw');
  assert.equal(resolveLanguage('auto', 'ja'), 'en');
  assert.equal(resolveLanguage('en', 'zh-tw'), 'en');
  assert.equal(resolveLanguage('zh-tw', 'en'), 'zh-tw');
  let preference = 'auto';
  const translator = createTranslator(() => preference, 'en');
  assert.equal(translator.t('背景來源'), 'Background source');
  preference = 'zh-tw';
  assert.equal(translator.t('背景來源'), '背景來源');
  const filename = 'C:\\照片\\桌布.jpg';
  assert.ok(translator.error('Wallpaper path does not exist: ' + filename).endsWith(filename));
  assert.equal(translator.error('EACCES: system error'), 'EACCES: system error');
  assert.equal(validSetting('language', 'zh-tw'), true);
  assert.equal(validSetting('language', 'unsupported'), false);
});

test('manifest tokens and sidebar labels have translations in both languages', () => {
  const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const manifest = read('package.json');
  const sidebar = read('src/sidebar.js');
  for (const suffix of ['', '.zh-tw']) {
    const translations = JSON.parse(read(`package.nls${suffix}.json`));
    for (const [, key] of manifest.matchAll(/"%([^%]+)%"/g)) assert.ok(translations[key], key);
  }
  const en = JSON.parse(read('locales/en.json'));
  const zh = JSON.parse(read('locales/zh-tw.json'));
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
  for (const [, key] of sidebar.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)) {
    assert.ok(en[key], key);
    assert.ok(zh[key], key);
  }
  for (const key of Object.keys(en)) {
    assert.deepEqual(en[key].match(/\{\d+\}/g), zh[key].match(/\{\d+\}/g), key);
  }
});
