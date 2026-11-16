import test from 'node:test';
import assert from 'node:assert/strict';
import { findCatalogProductsByModel, isNamedCatalogQuestion } from '../src/services/productSearchService.js';
import { handleRacketMessage } from '../src/services/chatService.js';
import { createEmptyNeeds } from '../src/services/needsExtractor.js';

const product = (name, id) => ({
  id, slug:id, name, isActive:true, category:{slug:'rackets'}, brand:{slug:'yonex'},
  variants:[{id:`${id}-4u`,name:'4U / G5',price:4550000,attributes:{}}],
});
const catalog = [product('Yonex ASTROX 100ZZ','100zz'), product('Yonex ASTROX 100 Z','100z'),
  product('Yonex Test 1100ZZ','1100zz'), product('Yonex ASTROX 100 GAME','100game'),
  product('Yonex NANOFLARE 100 GAME','nf100game'), product('Yonex ASTROX 88D TOUR','88d'),
  product('Yonex ASTROX 88S TOUR','88s')];
const database = {product:{findMany:async()=>catalog}};
const forbidden = async()=>assert.fail('Named model lookup must precede the questionnaire and retrieval');
const needs = createEmptyNeeds();
const model = {name:'Yonex ASTROX 100ZZ',productType:'rackets',variants:[{
  name:'4U / G5',priceVnd:4550000,advisorSpecs:{weightClass:'4U',shaftFlex:'extra_stiff',balanceType:'head_heavy',stringingMinLbf:20,stringingMaxLbf:28},
}]};
const ask = (message, overrides={})=>handleRacketMessage(message,needs,'Ngân sách bao nhiêu?',{
  extract:forbidden,search:forbidden,retrieve:forbidden,polish:forbidden,
  lookupProducts:async()=>[model],...overrides,
});

test('bare, spaced and purchase model aliases are recognized without treating units or budgets as models',()=>{
  for(const message of ['100zz','100 ZZ','Tôi muốn mua cây 100zz','100zz nặng không','100 game']) {
    assert.equal(isNamedCatalogQuestion(message),true,message);
  }
  for(const message of ['3tr','Mua vợt 3 triệu','25 lbs','100 kg','100 mm','So sánh 3U và 4U']) {
    assert.equal(isNamedCatalogQuestion(message),false,message);
  }
});

test('catalog aliases preserve the exact model code rather than matching a substring',async()=>{
  for(const message of ['100zz','100 ZZ','Tôi muốn mua cây 100zz']) {
    const rows=await findCatalogProductsByModel(message,{database});
    assert.deepEqual(rows.map(row=>row.productId),['100zz']);
  }
  const rows=await findCatalogProductsByModel('88d tour thông số',{database});
  assert.deepEqual(rows.map(row=>row.productId),['88d']);
});

test('number plus edition returns all real matches for clarification',async()=>{
  const rows=await findCatalogProductsByModel('100 game',{database});
  assert.deepEqual(rows.map(row=>row.productId),['100game','nf100game']);
});

test('named Kurenai/VA qualifiers and standard edition can resolve the catalog ambiguity',async()=>{
  const database={product:{findMany:async()=>[product('Yonex ASTROX 100ZZ','standard'),
    product('Yonex ASTROX 100ZZ Kurenai','kurenai'),product('Yonex VA ASTROX 100ZZ','va')]}};
  for(const [message,id] of [['100zz Kurenai','kurenai'],['100zz VA','va'],['100zz bản thường','standard']]) {
    assert.equal(isNamedCatalogQuestion(message),true);
    const matches=await findCatalogProductsByModel(message,{database});
    assert.deepEqual(matches.map(row=>row.productId),[id]);
  }
});

test('100zz and the exact purchase sentence answer real price and specs instead of asking budget',async()=>{
  for(const message of ['100zz','Tôi muốn mua cây 100zz']) {
    const result=await ask(message);
    assert.match(result.reply,/ASTROX 100ZZ/);
    assert.match(result.reply,/4\.550\.000\s₫/);
    assert.match(result.reply,/thân rất cứng, nặng đầu/);
    assert.match(result.reply,/chưa gồm tiền căng cước/);
    assert.doesNotMatch(result.reply,/ngân sách|chi khoảng|trình độ hiện tại/);
    assert.deepEqual(result.needs,needs);
    assert.deepEqual(result.candidates,[]);
  }
});

test('a technical alias question without previous recommendations uses the live catalog',async()=>{
  const result=await ask('100zz nặng không');
  assert.match(result.reply,/4U/);
  assert.doesNotMatch(result.reply,/chưa thấy danh sách|ngân sách/);
});

test('ambiguous catalog aliases ask which product and missing aliases never invent facts',async()=>{
  const ambiguous=await ask('100 game',{lookupProducts:async()=>[model,{...model,name:'Other 100 GAME'}]});
  assert.match(ambiguous.reply,/khớp nhiều sản phẩm/);
  assert.doesNotMatch(ambiguous.reply,/4\.550\.000/);
  const missing=await ask('999zz',{lookupProducts:async()=>[]});
  assert.match(missing.reply,/chưa xác định được model/);
  assert.doesNotMatch(missing.reply,/nặng đầu|4\.550\.000/);
});
