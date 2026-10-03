'use strict';
const http=require('http');
const {createHttp}=require('./jarvis-mobile-tts-http');
const bridge=createHttp();
const original=http.createServer;
http.createServer=function(...args){
  if(typeof args[0]==='function')args[0]=bridge.wrap(args[0]);
  return original.apply(this,args);
};
try{require('./server')}finally{http.createServer=original}
