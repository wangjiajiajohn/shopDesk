import test from 'node:test';
import assert from 'node:assert/strict';
import { selectSkillWorkflows,skillDependencies } from '../src/workbenchSkills.js';
test('APIMart is a dependency of WJJ and not a duplicate top-level workflow',()=>{
 const skills=selectSkillWorkflows();
 assert.deepEqual(skills.map(s=>s.id),['product-function-learning','tiktok-product-creation','wjj-reference-product-images']);
 assert.deepEqual(skillDependencies(skills.find(s=>s.id==='wjj-reference-product-images')).map(s=>s.id),['apimart-images']);
 assert.deepEqual(selectSkillWorkflows('APIMart').map(s=>s.id),['wjj-reference-product-images']);
});

test('product information and product images have separate workflow boundaries',()=>{
 const skills=selectSkillWorkflows().filter(s=>s.id!=='product-function-learning');
 assert.equal(skills[0].state,'local');
 assert.equal(skills[0].executionScope,'product-information-only');
 assert.deepEqual(skillDependencies(skills[0]),[]);
 assert.equal(skills[1].state,'local');
});
