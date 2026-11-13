import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRates,ratePoints } from '../src/components/exchange-rate/rates.js';
test('rates isolate selected currency and reject invalid quotes',()=>{
 const row=(date,rate,quote='MXN')=>({date,rate,quote,base:'CNY'});
 const rows=normalizeRates([row('2026-11-12',2.8),row('2026-11-11',2.7),row('2026-11-12',2.9),row('2026-11-10',99,'USD'),row('2026-11-09',-1)],'MXN');
 assert.deepEqual(rows,[{date:'2026-11-11',rate:2.7},{date:'2026-11-12',rate:2.9}]);
 assert.throws(()=>normalizeRates([], 'MXN'));assert.throws(()=>normalizeRates({},'MXN'));
});
test('constant or single-day rates plot without division by zero',()=>{
 for(const rows of [[{date:'a',rate:2.8}],[{date:'a',rate:2.8},{date:'b',rate:2.8}]]){
  assert.ok(ratePoints(rows,96,30).every(p=>Number.isFinite(p.x)&&p.y===15));
 }
});
