(() => {
  const vscode = acquireVsCodeApi();
  const byId = id => document.getElementById(id);
  const editing = new Set();
  document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => {
    vscode.postMessage({type:'action', action:button.dataset.action});
  }));
  document.querySelectorAll('[data-setting]').forEach(input => {
    input.addEventListener('input', () => {
      editing.add(input.id);
      if (input.type === 'range') byId(input.id + 'Value').textContent = input.value + '%';
    });
    input.addEventListener('change', () => {
      if (!input.checkValidity() || input.value === '') { input.reportValidity(); return; }
      editing.delete(input.id);
      const value = input.tagName === 'SELECT' ? input.value : Number(input.value) / (input.type === 'range' ? 100 : 1);
      vscode.postMessage({type:'setting', key:input.dataset.setting, value});
    });
  });
  window.addEventListener('message', ({data}) => {
    if (data.type !== 'state') return;
    byId('status').textContent = data.busy ? '處理中…' : data.error ? '背景發生問題' : data.running ? '背景已啟用' : '背景已停用';
    byId('toggle').textContent = data.running ? '禁用背景' : '啟用背景';
    byId('folderSection').hidden = data.mode !== 'folder';
    byId('engineSection').hidden = data.mode === 'folder';
    for (const key of ['folderPath','executable','currentFile']) byId(key).textContent = data[key] || (key === 'executable' ? '自動尋找' : '尚未選擇');
    byId('error').textContent = data.error || '';
    document.querySelectorAll('[data-setting]').forEach(input => {
      // 正在輸入時先不要蓋掉，免得輪播更新把使用者打到一半的數字洗掉。
      if (!editing.has(input.id)) input.value = input.type === 'range' ? Math.round(data[input.dataset.setting] * 100) : data[input.dataset.setting];
      if (input.type === 'range') byId(input.id + 'Value').textContent = input.value + '%';
    });
    document.querySelectorAll('button,input,select').forEach(input => { input.disabled = data.busy; });
  });
  vscode.postMessage({type:'ready'});
})();
