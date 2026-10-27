(() => {
  const vscode = acquireVsCodeApi();
  const byId = id => document.getElementById(id);
  const editing = new Set();
  const inputs = [...document.querySelectorAll('[data-setting]')];
  document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => {
    vscode.postMessage({type:'action', action:button.dataset.action});
  }));
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      editing.add(input.dataset.setting);
      if (input.dataset.percent && input.value !== '' && input.checkValidity()) {
        for (const other of inputs) {
          if (other !== input && other.dataset.setting === input.dataset.setting) other.value = input.value;
        }
      }
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && input.type === 'number' && input.value !== '' && input.checkValidity()) input.blur();
    });
    input.addEventListener('change', () => {
      if (!input.checkValidity() || input.value === '') { input.reportValidity(); return; }
      editing.delete(input.dataset.setting);
      const value = input.tagName === 'SELECT' ? input.value : Number(input.value) / (input.dataset.percent ? 100 : 1);
      vscode.postMessage({type:'setting', key:input.dataset.setting, value});
    });
  });
  window.addEventListener('message', ({data}) => {
    if (data.type !== 'state') return;
    const t = key => data.strings?.[key] || key;
    document.documentElement.lang = data.resolvedLanguage === 'zh-tw' ? 'zh-Hant' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach(element => { element.setAttribute('aria-label', t(element.dataset.i18nAria)); });
    byId('status').textContent = data.busy ? t('處理中…') : data.error ? t('背景發生問題') : data.running ? t('背景已啟用') : t('背景已停用');
    byId('toggle').textContent = data.running ? t('禁用背景') : t('啟用背景');
    byId('folderSection').hidden = data.mode !== 'folder';
    byId('engineSection').hidden = data.mode === 'folder';
    for (const key of ['folderPath','currentFile']) byId(key).textContent = data[key] || t('尚未選擇');
    byId('error').textContent = data.error || '';
    inputs.forEach(input => {
      // 正在輸入時先不要蓋掉，免得輪播更新把使用者打到一半的數字洗掉。
      if (!editing.has(input.dataset.setting)) input.value = input.dataset.percent ? Math.round(data[input.dataset.setting] * 100) : data[input.dataset.setting];
    });
    document.querySelectorAll('button,input,select').forEach(input => { input.disabled = data.busy; });
  });
  vscode.postMessage({type:'ready'});
})();
