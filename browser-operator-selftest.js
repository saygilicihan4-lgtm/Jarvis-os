const assert=require('assert');
const os=require('os');
const fs=require('fs');
const path=require('path');
const op=require('./jarvis-browser-operator');

assert.strictEqual(op.BROWSER_OPERATOR_VERSION,'1.1');
assert.deepStrictEqual(op.allowedHosts(),['*']);
assert.ok(op.hostAllowed('studio.youtube.com'));
assert.ok(op.hostAllowed('admin.shopify.com'));
assert.ok(op.hostAllowed('example.com'));
assert.ok(op.hostAllowed('accounts.example.org'));
assert.ok(op.safeUrl('https://studio.youtube.com/').startsWith('https://studio.youtube.com/'));
assert.ok(op.safeUrl('https://example.com/signup?source=jarvis').startsWith('https://example.com/signup'));
assert.ok(op.safeUrl('http://localhost:3000/').startsWith('http://localhost:3000/'));
assert.throws(()=>op.safeUrl('file:///C:/Windows/System32/'),/http\/https/);
assert.throws(()=>op.safeUrl('javascript:alert(1)'),/http\/https/);

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-browser-op-'));
const profile=op.profileDir(tmp);
assert.ok(fs.existsSync(profile));
console.log('BROWSER OPERATOR SELFTEST PASS');
