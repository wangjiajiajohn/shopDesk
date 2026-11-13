import test from 'node:test';
import assert from 'node:assert/strict';
import { inventoryFor } from '../src/home/inventory.js';
const NOW = Date.parse('2026-11-13T12:00:00Z');
const product = (shop,id,stock,status='ACTIVATE') => ({shop_id:shop,tiktok_product_id:id,title:id,status,skus:[{id:'sku',seller_sku:'SKU',inventory:stock}]});
const order = (id, shop, lines, status='COMPLETED',time=NOW/1000-60) => ({tiktok_order_id:id,shop_id:shop,status,paid_time:time,line_items:lines});

test('all active SKUs stay present, including no-sales and unknown stock; shops isolated',()=>{
 const stats=inventoryFor([product('a','p',[{quantity:2},{quantity:1}]),product('b','p',[{quantity:0}]),product('a','off',[{quantity:0}],'SELLER_DEACTIVATED'),{shop_id:'a',tiktok_product_id:'unknown',title:'unknown',status:'ACTIVATE',skus:[{id:'missing'}]}],[order('o','a',[{id:'1',sku_id:'sku',quantity:5},{id:'1',sku_id:'sku',quantity:5}]),order('o','a',[{sku_id:'sku'}])],NOW);
 assert.equal(stats.rows.length,3);assert.equal(stats.productCount,3);assert.equal(stats.alerts.length,1);
 assert.equal(stats.alerts[0].stock,3);assert.equal(stats.alerts[0].sales7d,5);assert.equal(stats.alerts[0].orders7d,1);assert.equal(stats.alerts[0].gap,2);
 assert.equal(stats.rows.find(r=>r.key==='b:sku').sales7d,0);assert.equal(stats.unknownStock,1);
});
test('sales count units separately from unique orders and exclude cancelled/unpaid/old/future',()=>{
 const lines=[{id:'1',sku_id:'sku'},{id:'2',sku_id:'sku'}];
 const orders=[order('one','a',lines),order('two','a',[{sku_id:'sku'}]),order('cancel','a',lines,'CANCELLED'),order('unpaid','a',lines,'UNPAID'),order('old','a',lines,'COMPLETED',NOW/1000-7*86400-1),order('future','a',lines,'COMPLETED',NOW/1000+1)];
 const stats=inventoryFor([product('a','p',[{quantity:1}])],orders,NOW);
 assert.equal(stats.alerts[0].sales7d,3);assert.equal(stats.alerts[0].orders7d,2);assert.equal(stats.alerts[0].gap,2);
});
test('stock equal to sales is not low; null and invalid quantity never become zero',()=>{
 const products=[product('a','equal',[{quantity:2}]),{...product('a','missing',[]),skus:[{id:'m',inventory:[{quantity:null}]}]}];
 const stats=inventoryFor(products,[order('o','a',[{sku_id:'sku',quantity:2}])],NOW);
 assert.equal(stats.alerts.length,0);assert.equal(stats.unknownStock,1);
});
