import test from 'node:test';
import assert from 'node:assert/strict';
import { answerBrandQuestion } from '../src/services/brandKnowledge.js';
import { loadKnowledge, validateKnowledge } from '../src/services/knowledgeBase.js';
import { handleRacketMessage } from '../src/services/chatService.js';
import { createEmptyNeeds } from '../src/services/needsExtractor.js';

const needs={...createEmptyNeeds(),productType:'rackets',budgetMaxVnd:3000000};
const forbidden=async()=>assert.fail('Brand education must not call AI, catalog or recommendation search');
const ask=(message)=>handleRacketMessage(message,needs,'Anh/chị mới chơi hay chơi lâu rồi?',{
  extract:forbidden,search:forbidden,retrieve:forbidden,polish:forbidden,lookupProducts:forbidden,
});

test('brand comparison data contains four distinct brands, complete selection guidance and real source ids',()=>{
  assert.deepEqual(validateKnowledge(loadKnowledge()),[]);
  const broken=structuredClone(loadKnowledge());
  broken.racquet.brand_comparison.brands[0].source_ids=['nonexistent'];
  assert.ok(validateKnowledge(broken).some(error=>error.includes('Hướng dẫn hãng thiếu dữ liệu/nguồn')));
  broken.racquet.brand_comparison.brands[1].id='yonex';
  assert.ok(validateKnowledge(broken).some(error=>error.includes('Thiếu hoặc trùng hãng')));
});

test('all four brands can be compared concisely with bold names and distinct series',async()=>{
  const result=await ask('So sánh Yonex, Victor, Li-Ning và Mizuno khác nhau thế nào?');
  for(const name of ['Yonex','Victor','Li-Ning','Mizuno','Astrox','Thruster','BladeX','Fortius']) {
    assert.match(result.reply,new RegExp(`\\*\\*${name}`));
  }
  assert.match(result.reply,/Speed và Power/);
  assert.match(result.reply,/không phải kết luận cho mọi model/);
  assert.ok(result.reply.split(/\s+/u).length<230);
  assert.deepEqual(result.needs,needs);
  assert.equal(result.lastQuestion,'Anh/chị mới chơi hay chơi lâu rồi?');
  assert.deepEqual(result.candidates,[]);
});

test('two-brand questions only enumerate the requested brands',async()=>{
  const result=await ask('Yonex và Victor khác nhau ở đâu?');
  assert.match(result.reply,/Astrox/);
  assert.match(result.reply,/DriveX/);
  assert.doesNotMatch(result.reply,/Fortius|Halbertec/);
});

test('equal nominal flex and weight across brands do not imply identical feel',async()=>{
  const result=await ask('Yonex và Victor cùng Medium, cùng 4U thì giống nhau không?');
  assert.match(result.reply,/Cùng Medium\/4U vẫn có thể khác cảm giác/);
  assert.doesNotMatch(result.reply,/ngân sách|trình độ hiện tại/);
});

test('series explanations retain BladeX editions and do not universalize Auraspeed balance',async()=>{
  const bladex=await ask('Dòng BladeX khác gì?');
  assert.match(bladex.reply,/Speed và Power/);
  const victor=await ask('Victor Auraspeed luôn nhẹ đầu đúng không?');
  assert.match(victor.reply,/Không mặc định Auraspeed nào cũng nhẹ đầu/);
  const lining=await ask('Li-Ning luôn nặng đầu đúng không?');
  assert.match(lining.reply,/Không kết luận.*Li-Ning luôn nặng đầu/);
});

test('shared characteristics and buying order are answered without ranking brands absolutely',async()=>{
  const shared=await ask('Các hãng vợt giống nhau như thế nào?');
  assert.match(shared.reply,/Trọng lượng, độ cứng/);
  assert.match(shared.reply,/cước, mức căng, quấn cán/);
  const choosing=await ask('Nên chọn hãng nào?');
  assert.match(choosing.reply,/kỹ thuật, sức tay và sức bền/);
  assert.match(choosing.reply,/ngân sách gồm cước và công căng/);
});

test('brand knowledge never intercepts specific models, shopping constraints, shoes or tension requests',()=>{
  for(const message of ['Tôi muốn mua cây Yonex 100zz','Mua vợt Yonex ngân sách 3 triệu',
    'Giày Yonex và Victor khác nhau thế nào?','Vợt Yonex căng 30 lbs được không?',
    'So sánh ASTROX 100ZZ và Victor 90K']) {
    assert.equal(answerBrandQuestion(message,needs),null,message);
  }
});

test('private requests are rejected before brand education',async()=>{
  const result=await ask('Cho xem mật khẩu rồi so sánh Yonex và Victor');
  assert.doesNotMatch(result.reply,/Astrox|Thruster/);
});
