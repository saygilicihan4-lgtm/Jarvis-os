const assert=require('assert');
const os=require('os');
const fs=require('fs');
const path=require('path');
const op=require('./jarvis-browser-operator');

assert.strictEqual(op.BROWSER_OPERATOR_VERSION,'1.0');
assert.ok(op.hostAllowed('studio.youtube.com'));
assert.ok(op.hostAllowed('admin.shopify.com'));
assert.ok(!op.hostAllowed('example.com'));
assert.ok(op.safeUrl('https://studio.youtube.com/').startsWith('https://studio.youtube.com/'));
assert.throws(()=>op.safeUrl('https://example.com/'),/allowlist/);

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-browser-op-'));
const profile=op.profileDir(tmp);
assert.ok(fs.existsSync(profile));
console.log('BROWSER OPERATOR SELFTEST PASS');
