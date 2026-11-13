import test from 'node:test';
import assert from 'node:assert/strict';
import { populatedCategoryTree } from '../src/referenceCategoryMap.js';
test('empty branches disappear while ancestors and populated leaves remain without mutating source',()=>{
 const tree=[{category_id:'parent',children:[{category_id:'empty'},{category_id:'full'}]},{category_id:'other',children:[{category_id:'empty2'}]}];
 const result=populatedCategoryTree(tree,n=>n.category_id==='full'?2:0);
 assert.deepEqual(result,[{category_id:'parent',children:[{category_id:'full'}]}]);
 assert.equal(tree[0].children.length,2);
 assert.deepEqual(populatedCategoryTree(tree,()=>0),[]);
});
