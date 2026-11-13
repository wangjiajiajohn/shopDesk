import test from 'node:test';
import assert from 'node:assert/strict';
import { PAGE_PATHS, tabFromPath, pathFromTab } from '../src/appRoutes.js';
test('each workspace page has a unique URL that reconstructs the same page on refresh', () => {
 assert.equal(new Set(Object.values(PAGE_PATHS)).size,Object.keys(PAGE_PATHS).length);
 for (const [tab,path] of Object.entries(PAGE_PATHS)) {
  assert.equal(tabFromPath(path),tab);
  assert.equal(pathFromTab(tab),path);
  assert.equal(tabFromPath(path+'/'),tab);
 }
 assert.equal(tabFromPath('/sourcing'),'sourcing');
});
test('unknown or prototype-derived routes safely fall back to home', () => {
 for (const tab of ['missing','toString','__proto__',null]) assert.equal(pathFromTab(tab),'/');
 assert.equal(tabFromPath('/not-a-page'),'home');assert.equal(tabFromPath(''),'home');
});

test('old reference links open the shared product materials library',()=>{
 assert.equal(tabFromPath('/references'),'product-materials');
 assert.equal(pathFromTab('references'),'/product-materials');
});

test('old AI media links lead to the product creation queue',()=>{
 assert.equal(tabFromPath('/ai-media'),'product-creation-queue');
 assert.equal(pathFromTab('ai-media'),'/product-creation-queue');
});
