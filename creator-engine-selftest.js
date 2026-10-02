const assert=require('assert');
const os=require('os');
const fs=require('fs');
const path=require('path');
const engine=require('./jarvis-creator-engine');

assert.strictEqual(engine.ENGINE_VERSION,'1.0');
assert.strictEqual(engine.safeName('Benim Shorts / Test'),'Benim-Shorts-Test');

const srt=engine.buildSrt('Birinci cümle burada. İkinci cümle burada ve devam ediyor.',15);
assert.ok(srt.includes('1'));
assert.ok(srt.includes('-->'));
assert.ok(srt.includes('Birinci'));

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-creator-test-'));
const status=engine.ffmpegStatus(tmp);
assert.strictEqual(typeof status.ok,'boolean');
assert.ok(status.assetDir.includes('creator-assets'));
assert.ok(fs.existsSync(status.assetDir));

console.log('CREATOR ENGINE SELFTEST PASS');
