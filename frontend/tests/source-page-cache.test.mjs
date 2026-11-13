import test from 'node:test';
import assert from 'node:assert/strict';
import { createSourcePageCache } from '../src/sourcePageCache.js';
test('visited pages stay separate by filters and expire', () => {
 let time=100;
 const cache=createSourcePageCache({ttl:1000,now:()=>time});
 cache.put('all:1',{items:['a']},cache.revision);
 cache.put('socks:1',{items:['b']},cache.revision);
 assert.deepEqual(cache.get('all:1').data.items,['a']);
 assert.deepEqual(cache.get('socks:1').data.items,['b']);
 time=1101;assert.equal(cache.get('all:1'),null);
});
test('mutations invalidate pages and reject late responses from older requests',()=>{
 const cache=createSourcePageCache();const revision=cache.revision;
 cache.put('all:1',{},revision);cache.clear();
 assert.equal(cache.get('all:1'),null);
 assert.equal(cache.put('all:2',{},revision),null);
});
test('memory is bounded and revisiting retains the recently viewed page',()=>{
 const cache=createSourcePageCache({maxPages:2});
 cache.put('1',{},0);cache.put('2',{},0);cache.get('1');cache.put('3',{},0);
 assert.equal(cache.get('2'),null);assert.ok(cache.get('1'));assert.ok(cache.get('3'));
});
