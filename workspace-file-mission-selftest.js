const fs=require('fs');
const assert=require('assert');

const worker=fs.readFileSync('./worker.js','utf8');
const engine=fs.readFileSync('./jarvis-workspace-file-engine.js','utf8');

assert.ok(worker.includes("const WORKER_VERSION='2.102.0'"),'Worker 2.102.0 required');
assert.ok(worker.includes("'workspace_file_mission_v1'"),'workspace file mission capability missing');
assert.ok(worker.includes("'workspace_file_hash_guard_v1'"),'workspace file hash guard capability missing');
assert.ok(worker.includes("'workspace_file_no_overwrite_v1'"),'workspace no-overwrite capability missing');
assert.ok(worker.includes("name:'workspace_file_mission'"),'workspace file native mission tool missing');
assert.ok(worker.includes("else if(n==='workspace_file_mission')"),'workspace file mission handler missing');
assert.ok(worker.includes('function createWorkspaceFileMission(args={})'),'workspace file mission factory missing');
assert.ok(worker.includes("type:'workspace_file'"),'workspace_file mission type missing');
assert.ok(worker.includes("name:'workspace_file_'"),'workspace file mission steps missing');
assert.ok(worker.includes("getWorkspaceFileEngine().normalizeOperations(WORKSPACE,args.operations)"),'workspace operation baseline normalization missing');
assert.ok(worker.includes("getWorkspaceFileEngine().recoveryDecision(WORKSPACE,op)"),'workspace restart recovery missing');
assert.ok(worker.includes("getWorkspaceFileEngine().applyOperation(WORKSPACE,op)"),'workspace file execution missing');
assert.ok(worker.includes("uncertain:!!(out&&out.uncertain)"),'uncertain workspace side effects must block blind retry');
assert.ok(worker.includes("workspaceFileMissionReady:CAPS.includes('workspace_file_mission_v1')"),'acceptance readiness missing');
assert.ok(worker.includes("['jarvis-workspace-file-engine.js',\"WORKSPACE_FILE_ENGINE_VERSION='1.0'\"]"),'workspace file runtime/bootstrap sync missing');
assert.ok(worker.includes('bağımsız silme işlemi yapma'),'agent must not expose standalone delete through workspace mission');

assert.ok(engine.includes("COPYFILE_EXCL"),'copy must refuse overwrite atomically');
assert.ok(engine.includes("WORKSPACE_FILE_DEST_EXISTS"),'destination overwrite guard missing');
assert.ok(engine.includes("WORKSPACE_FILE_INTERNAL_PATH"),'internal path guard missing');
assert.ok(engine.includes("WORKSPACE_FILE_SENSITIVE_PATH"),'sensitive path guard missing');
assert.ok(engine.includes("WORKSPACE_FILE_SYMLINK_ESCAPE"),'symlink escape guard missing');
assert.ok(engine.includes("CHUNK_BYTES=1024*1024"),'large-file chunked SHA-256 hashing missing');
assert.ok(engine.includes("if(op.operation==='copy')"),'copy recovery path missing');
assert.ok(engine.includes("if(op.operation==='move')"),'move recovery path missing');
assert.ok(engine.includes("return{decision:'uncertain',state}"),'ambiguous restart state must remain uncertain');
assert.ok(engine.includes("fs.linkSync(state.source,state.destination)"),'move must create an atomic no-overwrite hard link before source removal');
assert.ok(engine.includes("fs.unlinkSync(state.source)"),'move must remove source only after linked destination verification');
assert.ok(!engine.includes("operation==='delete'"),'standalone delete operation must not exist');

console.log('WORKSPACE FILE MISSION SELFTEST PASS');
