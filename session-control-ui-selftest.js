'use strict';
const fs=require('fs');
const html=fs.readFileSync('public/index.html','utf8');

const required=[
  'id="sessionControlPanel"',
  'id="sessionList"',
  'loadSessionControl',
  "sessionRequest('/api/sessions/status')",
  "sessionRequest('/api/sessions')",
  "sessionRequest('/api/sessions/revoke-others'",
  "/api/sessions/'+id+'/revoke",
  "confirmCurrent:true",
  "confirm:'DISABLE_LEGACY_SESSIONS'",
  'Legacy session detected',
  'Managed v3 session required',
  'sessionEscape',
  'data-session-current'
];
for(const marker of required)if(!html.includes(marker))throw new Error('Missing session-control capability: '+marker);

if(/innerHTML\s*=\s*[^;]*item\.source(?![^;]*sessionEscape)/.test(html))throw new Error('Session source may reach innerHTML without escaping');
if(!html.includes("if(e.status===401){if(panel)panel.hidden=true"))throw new Error('Unauthenticated session panel does not fail closed');
if(!html.includes("if(!/^[a-f0-9]{64}$/.test(String(id||'')))return"))throw new Error('Session revoke ID validation missing');
if(!html.includes("if(isCurrent&&!confirm("))throw new Error('Current-session revoke confirmation missing');
if(!html.includes("if(!confirm('Eski v2 oturum erişimi kalıcı olarak kapatılsın mı? Bu işlem geri alınamaz.'))return"))throw new Error('Irreversible legacy cutoff warning missing');
if(html.includes('jarvis_session=')&&html.includes('sessionControlPanel')) {
  const block=html.slice(html.indexOf('function sessionEscape'),html.indexOf('const LANGUAGE_NAMES'));
  if(block.includes('document.cookie')||block.includes('jarvis_session='))throw new Error('Session Control must never inspect raw session cookies');
}
console.log('SESSION CONTROL UI SELFTEST PASS');
