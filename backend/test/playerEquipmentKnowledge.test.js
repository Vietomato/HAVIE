import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRacketMessage} from '../src/services/chatService.js';
import {createEmptyNeeds} from '../src/services/needsExtractor.js';
import {answerPlayerEquipmentQuestion} from '../src/services/playerEquipmentKnowledge.js';
import {courteousReply} from '../src/utils/replyFormat.js';
const needs={...createEmptyNeeds(),productType:'rackets',skillLevel:'beginner',budgetMaxVnd:3000000};
const fail=async()=>assert.fail('Educational/pain answers must not call providers, products or selling flows');
const ask=message=>handleRacketMessage(message,needs,'Anh/chị đánh đơn hay đôi?',{extract:fail,search:fail,lookupProducts:fail,retrieve:fail,polish:fail});
test('recreational and professional racket choices are distinguished without equating labels with skill',async()=>{
 const result=await ask('Người phong trào và chuyên nghiệp chọn vợt khác nhau thế nào?');
 assert.match(result.reply,/Dạ/);assert.match(result.reply,/phong trào trình cao/);
 assert.match(result.reply,/không phải VĐV nào cũng dùng vợt cứng/);
 assert.deepEqual(result.needs,needs);assert.deepEqual(result.candidates,[]);
});
test('strings and tension are separate choices, without a universal professional setup',async()=>{
 const result=await ask('VĐV chuyên nghiệp chọn cước khác phong trào thế nào?');
 assert.match(result.reply,/dây mảnh hoặc dày/);assert.match(result.reply,/hai quyết định riêng/);
 assert.match(result.reply,/Không có số kg an toàn chung/);
 assert.doesNotMatch(result.reply,/\d+\s*(?:kg|lbs)/);
});
test('copying a professional for sound or power is not recommended',async()=>{
 const result=await ask('Em muốn căng kg cao như VĐV vì tiếng cầu hay hơn, có nên bắt chước không?');
 assert.match(result.reply,/Căng cao không tự làm cú đập mạnh hơn/);
 assert.match(result.reply,/Tiếng cầu hay không chứng minh/);
 assert.doesNotMatch(result.reply,/\d+\s*(?:kg|lbs)/);
});
test('personal pain overrides model lookup and a numeric tension request',async()=>{
 for(const message of ['Tôi đau cổ tay, cây 100zz nên căng 28 lbs không?', 'Em đang đau vai, mua vợt nào để hết đau?']){
  const result=await ask(message);assert.match(result.reply,/giảm hoặc ngừng động tác gây đau/);
  assert.match(result.reply,/nhân viên y tế đánh giá/);assert.doesNotMatch(result.reply,/em gợi ý|20-28|hạ xuống|bị viêm/);
  assert.deepEqual(result.needs,needs);
 }
});
test('general overuse education is qualified and negated pain does not become a diagnosis',async()=>{
 const result=await ask('Vợt quá cứng và căng kg cao có gây chấn thương không?');
 assert.match(result.reply,/không phải cứ|Không phải cứ/);assert.match(result.reply,/tiền sử đau/);
 assert.equal(answerPlayerEquipmentQuestion('Tôi chưa đau cổ tay, 100zz nặng không?'),null);
 assert.equal(answerPlayerEquipmentQuestion('25 lbs bao nhiêu kg?'),null);
});
test('one courteous opening preserves existing greetings, units and structured information',()=>{
 assert.equal(courteousReply('Dạ, em gửi anh/chị ạ.'),'Dạ, em gửi anh/chị ạ.');
 assert.equal(courteousReply('25 lbs khoảng 11.3 kg.'),'Dạ, 25 lbs khoảng 11.3 kg.');
 assert.match(courteousReply('**Thông số**\n- 4U'),/^Dạ,.*anh\/chị.*\n\n\*\*Thông số/);
});
