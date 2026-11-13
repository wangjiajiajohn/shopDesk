import test from 'node:test';
import assert from 'node:assert/strict';
import {normaliseCreationConfig,newImageScheme,updateImageScheme} from '../src/creationSchemes.js';
test('existing single reference configuration migrates without losing defaults or its reference',()=>{
 const old={stock:37,weight:200,referenceMode:'manual',reference:{id:'42',materialNumber:42}};
 const result=normaliseCreationConfig(old);
 assert.equal(result.stock,37);assert.equal(result.depth,10);assert.equal(result.schemes.length,1);
 assert.equal(result.schemes[0].reference.materialNumber,42);assert.equal(result.schemes[0].referenceMode,'manual');
 assert.equal(old.referenceMode,'manual');
});
test('separate schemes retain independent references, scope, jobs and results',()=>{
 const original=normaliseCreationConfig({schemes:[newImageScheme('a','方案1',['main']),newImageScheme('b','方案2',['main','sku'])]});
 let result=updateImageScheme(original,'a',{reference:{materialNumber:42},jobs:[{id:'a-job'}]});
 result=updateImageScheme(result,'b',{reference:{materialNumber:43},results:[{id:'b-image'}]});
 assert.equal(result.schemes[0].reference.materialNumber,42);assert.equal(result.schemes[1].reference.materialNumber,43);
 assert.deepEqual(result.schemes[0].results,[]);assert.deepEqual(result.schemes[1].jobs,[]);
 assert.equal(original.schemes[0].reference,null);
 assert.deepEqual(normaliseCreationConfig(result).schemes,result.schemes);
});
