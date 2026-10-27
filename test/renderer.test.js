'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const vm = require('node:vm');

test('renderer caches media across polling and releases Blobs on disable and page exit', async () => {
  const source = await fs.readFile(require.resolve('../src/background-renderer.js'), 'utf8');
  let state = {enabled:true, file:'media-1111111111111111.mp4', opacity:0.25};
  let poll, exit, reads = 0, serial = 0;
  const revoked = [];
  class TestURL extends URL {
    static createObjectURL() { return `blob:test-${++serial}`; }
    static revokeObjectURL(url) { revoked.push(url); }
  }
  const context = {
    URL:TestURL, AbortController, console,
    document:{
      currentScript:{src:'https://test.invalid/renderer.js'},
      head:{appendChild() {}},
      createElement:() => ({remove() {}}),
      querySelectorAll:() => [],
      addEventListener() {}, removeEventListener() {}
    },
    window:{addEventListener:(_event, callback) => { exit = callback; }},
    setInterval:callback => { poll = callback; return 1; }, clearInterval() {},
    fetch:async url => url.pathname.endsWith('state.json')
      ? {ok:true, json:async () => state}
      : {ok:true, blob:async () => { reads++; return {}; }}
  };
  vm.runInNewContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  await poll();
  await poll();
  assert.equal(reads, 1);
  state = {...state, file:'media-2222222222222222.jpg'};
  await poll();
  assert.equal(reads, 2);
  assert.deepEqual(revoked, ['blob:test-1']);
  state = {enabled:false};
  await poll();
  assert.deepEqual(revoked, ['blob:test-1', 'blob:test-2']);
  state = {enabled:true, file:'media-2222222222222222.webm', opacity:0.25};
  await poll();
  exit();
  await poll();
  assert.equal(reads, 3);
  assert.deepEqual(revoked, ['blob:test-1', 'blob:test-2', 'blob:test-3']);
});
