const assert=require('assert');
const fs=require('fs');
const os=require('os');
const path=require('path');
const e=require('./jarvis-workspace-file-engine');

assert.strictEqual(e.WORKSPACE_FILE_ENGINE_VERSION,'1.0');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-files-'));
fs.mkdirSync(path.join(root,'in'),{recursive:true});
fs.mkdirSync(path.join(root,'out'),{recursive:true});
fs.writeFileSync(path.join(root,'in','a.txt'),'alpha');
fs.writeFileSync(path.join(root,'in','b.txt'),'beta');

const copy=e.normalizeOperations(root,[{operation:'copy',source:'in/a.txt',destination:'out/a.txt'}])[0];
assert.strictEqual(copy.operation,'copy');
assert.strictEqual(e.recoveryDecision(root,copy).decision,'retry');
let r=e.applyOperation(root,copy);
assert.strictEqual(r.ok,true);
assert.strictEqual(fs.readFileSync(path.join(root,'in','a.txt'),'utf8'),'alpha');
assert.strictEqual(fs.readFileSync(path.join(root,'out','a.txt'),'utf8'),'alpha');
assert.strictEqual(e.recoveryDecision(root,copy).decision,'completed');

assert.throws(()=>e.normalizeOperations(root,[{operation:'copy',source:'in/a.txt',destination:'out/a.txt'}]),/DEST_EXISTS/);
assert.throws(()=>e.normalizeOperations(root,[{operation:'copy',source:'in/a.txt',destination:'\.jarvis-memory/a.txt'}]),/INTERNAL_PATH/);
assert.throws(()=>e.normalizeOperations(root,[{operation:'copy',source:'in/a.txt',destination:'/outside.txt'}]),/BAD_PATH/);
assert.throws(()=>e.normalizeOperations(root,[{operation:'copy',source:'in/a.txt',destination:'C:\\outside.txt'}]),/BAD_PATH/);
assert.throws(()=>e.normalizeOperations(root,[{operation:'copy',source:'in/a.txt',destination:'out/secret.json'}]),/SENSITIVE_PATH/);

const move=e.normalizeOperations(root,[{operation:'move',source:'in/b.txt',destination:'out/b.txt'}])[0];
assert.strictEqual(e.recoveryDecision(root,move).decision,'retry');
r=e.applyOperation(root,move);
assert.strictEqual(r.ok,true);
assert.strictEqual(fs.existsSync(path.join(root,'in','b.txt')),false);
assert.strictEqual(fs.readFileSync(path.join(root,'out','b.txt'),'utf8'),'beta');
assert.strictEqual(e.recoveryDecision(root,move).decision,'completed');

fs.writeFileSync(path.join(root,'in','c.txt'),'gamma');
const uncertain=e.normalizeOperations(root,[{operation:'move',source:'in/c.txt',destination:'out/c.txt'}])[0];
fs.copyFileSync(path.join(root,'in','c.txt'),path.join(root,'out','c.txt'),fs.constants.COPYFILE_EXCL);
assert.strictEqual(e.recoveryDecision(root,uncertain).decision,'uncertain','duplicate move state must never auto-delete source');

if(process.platform!=='win32'){
  const outside=fs.mkdtempSync(path.join(os.tmpdir(),'jarvis-files-outside-'));
  try{
    fs.symlinkSync(outside,path.join(root,'out','link'),'dir');
    assert.throws(()=>e.normalizeOperations(root,[{operation:'copy',source:'in/a.txt',destination:'out/link/x.txt'}]),/SYMLINK_ESCAPE/);
  }catch(err){
    if(err&&['EPERM','EACCES'].includes(err.code)){} else if(!/SYMLINK_ESCAPE/.test(String(err.message||err)))throw err;
  }
}

console.log('WORKSPACE FILE ENGINE SELFTEST PASS');
