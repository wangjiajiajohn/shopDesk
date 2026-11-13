import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMaterialNumberQuery,materialNumberLabel} from '../src/materialNumbers.js';
test('material numbers support readable forms without confusing long platform ids',()=>{
 for(const input of ['0004','4','编号 0004','#0004','SC-0004','０００４'])assert.equal(parseMaterialNumberQuery(input),4);
 for(const input of ['1737849616386393638','ICESEE',''])assert.equal(parseMaterialNumberQuery(input),null);
 assert.equal(materialNumberLabel(4),'编号 0004');
});
