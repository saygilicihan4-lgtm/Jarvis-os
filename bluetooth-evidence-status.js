const fs=require('fs'),path=require('path'),crypto=require('crypto');
function latestEvidence(root=__dirname){
 const dir=path.join(root,'.jarvis-memory','bluetooth-evidence');if(!fs.existsSync(dir))return{ok:false,reason:'no_bluetooth_evidence'};
 const files=fs.readdirSync(dir).filter(x=>/-(PASS|FAIL)\.json$/.test(x)).sort().reverse();if(!files.length)return{ok:false,reason:'no_bluetooth_evidence'};
 const file=path.join(dir,files[0]),body=fs.readFileSync(file),actual=crypto.createHash('sha256').update(body).digest('hex'),side=file+'.sha256';
 let expected='';if(fs.existsSync(side))expected=fs.readFileSync(side,'utf8').trim().split(/\s+/)[0]||'';
 let report=null;try{report=JSON.parse(body.toString('utf8'))}catch{return{ok:false,reason:'evidence_json_invalid',file,actualSha256:actual}}
 return{ok:!!expected&&expected===actual,reason:!expected?'evidence_digest_missing':expected===actual?'evidence_integrity_verified':'evidence_digest_mismatch',file,expectedSha256:expected||null,actualSha256:actual,report};
}
if(require.main===module)console.log(JSON.stringify(latestEvidence(),null,2));
module.exports={latestEvidence};