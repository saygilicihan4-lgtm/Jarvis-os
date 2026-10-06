'use strict';
// Fixed allowlist: isolated regression fixtures only, no shell or target input.
const {spawnSync}=require('node:child_process');
const path=require('node:path');
if(process.argv.length>2){console.error('External targets and additional arguments are not supported.');process.exit(2)}
const checks=['session-lifecycle-selftest.js','session-lifecycle-http-selftest.js','session-bootstrap-selftest.js','approval-gate-selftest.js','final-target-verification-selftest.js','mobile-session-security-v195-selftest.js'];
let failed=0;
for(const file of checks){
  const result=spawnSync(process.execPath,[path.join(__dirname,'..',file)],{cwd:path.join(__dirname,'..'),encoding:'utf8',timeout:60000,maxBuffer:1024*1024,shell:false});
  const passed=result.status===0&&!result.error;
  if(!passed)failed++;
  // Do not print raw test logs, environment variables or credentials.
  console.log(JSON.stringify({check:file,result:passed?'passed':'failed',exitCode:result.status,timeout:result.error?.code==='ETIMEDOUT'}));
}
console.log(JSON.stringify({scope:'isolated-repository-regression',checks:checks.length,failed,externalScanning:false,darkWebAccess:false,securityCertification:false}));
process.exitCode=failed?1:0;
