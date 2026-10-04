'use strict';
const fs=require('fs');
const assert=require('assert');
const src=fs.readFileSync('public/mobile-session-security-v195.js','utf8');

assert(src.includes("const VERSION='1.0'"),'v195 session security version missing');
assert(src.includes("const STAGE_ID='jarvisNativeMobileV190'"),'v195 must attach to native v190 mobile stage');
assert(src.includes("/api/sessions/status"),'owner session status endpoint missing');
assert(src.includes("/api/sessions'"),'managed session inventory endpoint missing');
assert(src.includes("/api/sessions/revoke-others"),'revoke-others action missing');
assert(src.includes("/api/sessions/legacy/disable"),'legacy cutoff action missing');
assert(src.includes("confirm:'DISABLE_LEGACY_SESSIONS'"),'legacy cutoff must preserve explicit server confirmation contract');
assert(src.includes("confirmCurrent:!!isCurrent"),'current-session revocation must preserve explicit confirmation payload');
assert(src.includes("credentials:'same-origin'"),'session UI requests must remain same-origin credential bound');
assert(src.includes("cache:'no-store'"),'session security responses must not be cached');
assert(src.includes(".jn-btn[data-a=\"settings\"]"),'native Settings control must expose the owner security panel');
assert(src.includes("e.stopImmediatePropagation()"),'security Settings interception must avoid duplicate legacy action');
assert(src.includes("data-jsv=\"general\""),'owner must retain an explicit path to legacy/general settings');
assert(src.includes("shortId(s.id)"),'session inventory must render only shortened hashes');
assert(src.includes("Cookies, passkey material and raw session secrets are never displayed or stored"),'owner-facing privacy boundary copy missing');
assert(!src.includes('localStorage')&&!src.includes('sessionStorage'),'security panel must never persist session material client-side');
assert(!src.includes('document.cookie'),'security panel must not read or write the HttpOnly session cookie');
assert(!src.includes('jarvis_session='),'security panel must not construct raw session cookies');
assert(!src.includes('publicKey')&&!src.includes('credential.publicKey'),'security panel must not handle passkey material');
assert(!src.includes('approve_mission_action')&&!src.includes('shopify_publish')&&!src.includes('youtube_publish'),'security panel must not gain mission/publish authority');
assert(src.includes("migrationRequired"),'legacy-v2 migration state must be owner-visible');
assert(src.includes("legacySessionsAccepted"),'legacy acceptance state must be owner-visible');
assert(src.includes("current.ipChanged"),'mobile IP-change risk indicator must remain visible without binding authorization to IP');

assert(src.includes('async function refreshAfterMutation(){busy=false;await refresh()}'),'post-mutation refresh must clear the busy gate before calling refresh');
assert((src.match(/await refreshAfterMutation\(\)/g)||[]).length===3,'all three successful mutation paths must use the busy-safe refresh helper');
const revokeBlock=src.slice(src.indexOf("if(action==='revoke')"),src.indexOf("if(action==='revoke-others')"));
assert(revokeBlock.includes('await refreshAfterMutation()'),'individual non-current revoke must actually refresh the owner-visible inventory');
assert(!revokeBlock.includes('await refresh()}'),'individual revoke must not call refresh while busy is still true');

console.log('MOBILE SESSION SECURITY v195 SELFTEST PASS · owner-visible hashed inventory + explicit revocation/migration + busy-safe refresh + no secret persistence or authority escalation');
