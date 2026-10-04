'use strict';

const fs=require('fs');
const assert=require('assert');

const css=fs.readFileSync('public/style.css','utf8');

assert(css.includes('v177 TRI-CORE VISUAL SHELL'),'tri-core marker missing');
assert(css.includes('content:"NOVA\\A DANIŞMAN"'),'NOVA advisor core missing');
assert(css.includes('content:"ORION\\A UZMAN"'),'ORION specialist core missing');
assert(css.includes('--amber:#ff9a2f'),'JARVIS amber identity missing');
assert(css.includes('--violet:#c65cff'),'ORION violet identity missing');
assert(css.includes('--cyan:#65e6ff'),'NOVA blue identity missing');
assert(css.includes('@media(prefers-reduced-motion:reduce)'),'reduced-motion fallback missing');
assert(css.includes('pointer-events:none'),'visual-only side cores must not capture input');
assert(css.includes('The side cores are visual-only in v177 and do not grant new authority.'),'authority boundary marker missing');

const before=css.indexOf('.core-stage::before{');
const after=css.indexOf('.core-stage::after{');
const center=css.indexOf('.core{\n');
assert(before>=0&&after>=0&&center>=0,'tri-core structure missing');

console.log('TRI-CORE UI SELFTEST PASS');
