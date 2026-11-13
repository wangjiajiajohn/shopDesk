import test from 'node:test';
import assert from 'node:assert/strict';
import { authMe, request } from '../src/api.js';

test('temporary auth failures keep token and distinguish invalid login', async () => {
 const original={fetch:globalThis.fetch,localStorage:globalThis.localStorage};
 let value='existing-session';
 globalThis.localStorage={getItem:()=>value,setItem:(_,v)=>{value=v;},removeItem:()=>{value=null;}};
 try {
  globalThis.fetch=async()=>({ok:false,status:503});
  await assert.rejects(authMe(),e=>e.status===503);
  assert.equal(value,'existing-session');
  globalThis.fetch=async()=>{throw new TypeError('network failure');};
  await assert.rejects(authMe(),TypeError);assert.equal(value,'existing-session');
  globalThis.fetch=async()=>({ok:false,status:401});
  await assert.rejects(authMe(),e=>e.status===401);
 } finally {Object.assign(globalThis,original);}
});

test('a stale unauthorized request cannot clear a newer login', async()=>{
 const original={fetch:globalThis.fetch,localStorage:globalThis.localStorage,window:globalThis.window};
 let value='old-session',reloads=0;
 globalThis.localStorage={getItem:()=>value,setItem:(_,v)=>{value=v;},removeItem:()=>{value=null;}};
 globalThis.window={location:{reload:()=>reloads++}};
 globalThis.fetch=async()=>{value='new-session';return {status:401,ok:false,json:async()=>({detail:'Unauthorized'})};};
 try {await assert.rejects(request('/test'));assert.equal(value,'new-session');assert.equal(reloads,0);}
 finally {Object.assign(globalThis,original);}
});
