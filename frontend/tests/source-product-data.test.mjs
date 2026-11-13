import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceCategories,sourceCategorySummary} from '../src/sourceProductData.js';
test('a product present in new arrivals and socks appears once in each category and once in total',()=>{
 const sock={supplier_id:'a',category_name:'最近上新',source_data:{category_memberships:['最近上新','袜子','袜子'],category_order:['最近上新','女士睡衣','袜子']}};
 assert.deepEqual(sourceCategories(sock),['最近上新','袜子']);
 const result=sourceCategorySummary([sock,{supplier_id:'a',category_name:'女士睡衣'}]);
 assert.equal(result.total,2);assert.deepEqual(result.categories,['最近上新','女士睡衣','袜子']);assert.deepEqual(result.counts,{'最近上新':1,'袜子':1,'女士睡衣':1});
});
test('supplier filtering changes category counts without hiding the original navigation',()=>{
 const result=sourceCategorySummary([{supplier_id:'a',category_name:'袜子'},{supplier_id:'b',category_name:'女士睡衣'}],'a');
 assert.equal(result.total,1);assert.equal(result.counts['袜子'],1);assert.equal(result.counts['女士睡衣'],undefined);assert.equal(result.categories.length,2);
});

 test('issue filters deduplicate source errors and retain image-only charts', async () => {
 const { sourceIssueTypes } = await import('../src/sourceProductData.js');
 assert.deepEqual(sourceIssueTypes({}), []);
 const types = sourceIssueTypes({source_data:{issues:[{field:'source_skc'},{field:'source_layout'},{field:'composition'}],assets:[{role:'size_diagram'}],extractions:[{kind:'ocr_text',status:'unreviewed'}],raw_photo_links:['example']}});
 assert.deepEqual(types,['source_records','composition','ocr_review','photo_links']);
 assert.deepEqual(sourceIssueTypes({source_data:{},size_chart:{rows:[['F','40']]}}),[]);
 assert.deepEqual(sourceIssueTypes({source_data:{}}),['missing_chart']);
});
