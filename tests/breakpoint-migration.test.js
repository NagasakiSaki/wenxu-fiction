import test from 'node:test';
import assert from 'node:assert/strict';
import {migrateBreakpoints as migrate} from '../src/breakpoint-migration.js';

test('inserting and removing text shifts only subsequent breakpoints',()=>{
 assert.deepEqual(migrate('甲乙丙丁戊己','新甲乙丙丁戊己',[2,4]).points,[3,5]);
 assert.deepEqual(migrate('甲乙丙丁戊己','甲乙新增丙丁戊己',[2,4],{start:2,end:2,inputType:'insertText'}).points,[4,6]);
 assert.deepEqual(migrate('甲乙丙丁戊己','甲乙丙丁戊',[2,4]).points,[2,4]);
 assert.deepEqual(migrate('甲乙丙丁戊己','甲丁戊己',[1,2,3,4]).points,[1,2]);
});
test('replacement removes interior anchors but keeps confirmed boundaries',()=>{
 const result=migrate('甲乙丙丁戊己庚','甲新增戊己庚',[1,2,3,4,6],{start:1,end:4,inputType:'insertFromPaste'});
 assert.deepEqual(result.points,[1,3,5]);assert.equal(result.removed,2);
 assert.equal(result.method,'input-range');
});
test('beforeinput ranges disambiguate repeated characters and backward or forward deletion',()=>{
 assert.deepEqual(migrate('aaaa','aaaaa',[1,2,3],{start:2,end:2,inputType:'insertText'}).points,[1,3,4]);
 assert.deepEqual(migrate('aaaa','aaa',[1,2,3],{start:2,end:2,inputType:'deleteContentBackward'}).points,[1,2]);
 assert.deepEqual(migrate('aaaa','aaa',[1,2,3],{start:2,end:2,inputType:'deleteContentForward'}).points,[1,2]);
 const uncertain=migrate('aaaa','aaaaa',[1,2,3]);assert.deepEqual(uncertain.points,[]);assert.equal(uncertain.method,'ambiguous-diff');
});
test('invalid hints fall back safely and emoji cannot have interior markers',()=>{
 const result=migrate('甲😀乙丙丁','甲😀新乙丙丁',[1,2,3,5],{start:99,end:99,inputType:'insertText'});
 assert.deepEqual(result.points,[1,4,6]);
 assert.deepEqual(migrate('甲😀乙丙','甲😃乙丙',[1,2,3,4]).points,[1,3,4]);
 assert.deepEqual(migrate('甲乙丙','',[1,2]).points,[]);
});
test('sequential composition updates and reverse edits preserve unaffected anchors',()=>{
 let result=migrate('甲乙丙丁','甲x乙丙丁',[2],{start:1,end:1,inputType:'insertCompositionText'});
 result=migrate('甲x乙丙丁','甲新字乙丙丁',result.points,{start:1,end:2,inputType:'insertCompositionText'});
 assert.deepEqual(result.points,[4]);
 result=migrate('甲新字乙丙丁','甲乙丙丁',result.points);
 assert.deepEqual(result.points,[2]);
});
test('long text is processed without changing source or growing marker count',()=>{
 const body='甲'.repeat(1_000_000)+'乙丙丁',points=[3,500000,1000001];
 const result=migrate(body,'新'+body,points,{start:0,end:0,inputType:'insertFromPaste'});
 assert.deepEqual(result.points,[4,500001,1000002]);assert.equal(body.length,1000003);assert.deepEqual(points,[3,500000,1000001]);
});
