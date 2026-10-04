const {spawn,spawnSync}=require('child_process');
const http=require('http');
const p=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3199'}});
function finish(ok){
  try{p.kill()}catch(_){}
  if(!ok){console.log('SELFTEST FAIL');process.exit(1)}
  for(const file of ['mobile-explicit-locale-selftest.js','mobile-runtime-locale-selftest.js','mobile-runtime-catalog-selftest.js','mobile-stt-capture-evidence-selftest.js','mobile-speech-evidence-status-selftest.js']){
    const result=spawnSync(process.execPath,[file],{stdio:'inherit'});
    if(result.status!==0){console.log('SELFTEST FAIL · '+file);process.exit(1)}
  }
  console.log('SELFTEST PASS');process.exit(0);
}
setTimeout(()=>http.get('http://127.0.0.1:3199/api/health',r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{const x=JSON.parse(b);finish(x.ok===true)}catch(_){finish(false)}})}).on('error',()=>finish(false)),500);
