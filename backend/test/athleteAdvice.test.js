import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRacketMessage} from '../src/services/chatService.js';
import {createEmptyNeeds} from '../src/services/needsExtractor.js';
import {getAthleteAdviceUsage, professionalTip} from '../src/services/athleteAdvice.js';
import {loadKnowledge,validateKnowledge} from '../src/services/knowledgeBase.js';
const needs={...createEmptyNeeds(),productType:'rackets'};
const fail=async()=>assert.fail('Educational training and curated tips must not call AI or catalog');
const ask=(message,extra={})=>handleRacketMessage(message,needs,'Anh/chị đánh đơn hay đôi?',{
 extract:fail,search:fail,retrieve:fail,lookupProducts:fail,polish:fail,
 ...extra,
});

test('product recommendation and alternative flows never append athlete advice',async()=>{
 for(const action of ['review_candidates','suggest_alternatives']) {
  assert.equal(professionalTip('Tư vấn vợt cho người mới kỹ thuật chưa tốt',{
   action,reply:'Các cây vợt phù hợp',needs,
  }),null);
 }
 const complete={...needs,skillLevel:'beginner',playFormat:'doubles',budgetMaxVnd:3000000};
 const result=await handleRacketMessage('Tư vấn vợt đánh đôi cho người mới',complete,null,{
  extract:async()=>complete,search:async()=>({status:'CANDIDATES_FOUND',candidates:[{name:'Vợt Test',priceVnd:2000000,advisorSpecs:{weightClass:'4U',shaftFlex:'medium',balanceType:'even'}}]}),
  findAlternatives:fail,retrieve:async()=>({topics:[],snippets:[]}),polish:fail,
 });
 assert.equal(result.action,'review_candidates');
 assert.doesNotMatch(result.reply,/Lời khuyên từ vận động viên|Axelsen/);
 assert.equal(professionalTip('Nên thử vợt mới thế nào?',{action:'answer_knowledge',reply:'Giữ nguyên dây khi thử.'}),null);
});

test('the same advice is suppressed while a different topic can introduce a different tip',async()=>{
 const first=await ask('Có nên tập jump smash ngay không?');
 const history=[{role:'assistant',content:first.reply}];
 const second=await ask('Mới bắt đầu nên tập gì trước?',{history});
 assert.doesNotMatch(second.reply,/Lời khuyên từ vận động viên/);
 const tension=await ask('Tốc độ vung có liên quan số kg căng không?',{history});
 assert.match(tension.reply,/Lời khuyên từ vận động viên/);
 assert.match(tension.reply,/ưu tiên nền tảng và bộ pháp/);
 const third=await ask('Tốc độ vung có liên quan số kg căng không?',{
  history:[...history,{role:'assistant',content:tension.reply}],
 });
 assert.doesNotMatch(third.reply,/Lời khuyên từ vận động viên/);
});

test('persistent usage suppresses advice beyond the eight-message context and explicit requests allow repetition',async()=>{
 const saved={history:Array.from({length:8},()=>({role:'user',content:'ok'})),
  usedAthleteAdviceIds:['axelsen_basics'],lastAthleteAdviceId:'axelsen_basics'};
 const repeatTopic=await ask('Mới bắt đầu nên tập gì trước?',saved);
 assert.doesNotMatch(repeatTopic.reply,/Lời khuyên từ vận động viên/);
 const requested=await ask('Nhắc lại lời khuyên của Axelsen',saved);
 assert.match(requested.reply,/Lời khuyên từ vận động viên/);
 assert.match(requested.reply,/nắm chắc kỹ thuật cơ bản/);
 assert.deepEqual(requested.needs,needs);
 const freshConversation=await ask('Mới bắt đầu nên tập gì trước?');
 assert.match(freshConversation.reply,/Lời khuyên từ vận động viên/);
});

test('usage lookup is scoped to the owned conversation and returns only IDs and latest advice',async()=>{
 const requests=[];
 const database={advisorMessage:{findFirst:async(query)=>{
  requests.push(query);
  if(query.where.conversationId!=='owned-conversation')return null;
  const text=query.where.AND[1].content.contains;
  if(text.includes('Nắm chắc'))return {createdAt:new Date('2026-11-16T10:00:00Z')};
  if(text.includes('Coi trọng'))return {createdAt:new Date('2026-11-16T11:00:00Z')};
  return null;
 }}};
 const usage=await getAthleteAdviceUsage(database,'owned-conversation');
 assert.deepEqual(new Set(usage.usedAthleteAdviceIds),new Set(['axelsen_basics','axelsen_recovery']));
 assert.equal(usage.lastAthleteAdviceId,'axelsen_recovery');
 assert.ok(requests.every(query=>query.where.role==='assistant'&&query.select.createdAt&&!query.select.content));
 const empty=await getAthleteAdviceUsage(database,'other-conversation');
 assert.deepEqual(empty,{usedAthleteAdviceIds:[],lastAthleteAdviceId:null});
});
test('athlete tips must be short paraphrases with valid sources',()=>{
 assert.deepEqual(validateKnowledge(loadKnowledge()),[]);
 const invalid=structuredClone(loadKnowledge());
 invalid.racquet.athlete_advice[0].source_ids=['fabricated'];
 invalid.racquet.athlete_advice[1].kind='verbatim';
 assert.equal(validateKnowledge(invalid).filter(error=>error.includes('Lời khuyên VĐV')).length,2);
});
test('technique questions receive one concise, attributed athlete paraphrase and retain needs',async()=>{
 const result=await ask('Mới học có nên tập jump smash trước không?');
 assert.match(result.reply,/cầm vợt, đổi grip, di chuyển/);
 assert.equal((result.reply.match(/\*\*Lời khuyên từ vận động viên chuyên nghiệp nổi tiếng:\*\*/gu)||[]).length,1);
 const tip=result.reply.split('\n\n').at(-1);
 assert.match(tip,/Viktor Axelsen nhấn mạnh việc nắm chắc kỹ thuật cơ bản/);
 assert.doesNotMatch(tip,/WHOOP|The Star|Tóm tắt|https?:/);
 assert.ok(tip.split(/\s+/u).length<=40);
 assert.deepEqual(result.needs,needs);assert.deepEqual(result.candidates,[]);
});
test('a training session is a HAVIE suggestion rather than an Axelsen schedule',async()=>{
 const result=await ask('Một buổi tập nên chỉ đánh trận không?');
 assert.match(result.reply,/Một buổi tập có thể gồm/);
 assert.match(result.reply,/Khởi động nhẹ/);
 assert.doesNotMatch(result.reply,/lịch tập của Axelsen|\d+\s*giờ|\d+\s*kg/);
});

test('beginner wording is not confused with pain after accent folding',async()=>{
 const result=await ask('Mới bắt đầu nên tập gì trước?');
 assert.match(result.reply,/Khởi động nhẹ/);
 assert.match(result.reply,/Lời khuyên từ vận động viên/);
 assert.doesNotMatch(result.reply,/nhân viên y tế|đang đau/);
});
test('equipment testing and arm-speed questions are answered from guidance, not athlete specs',async()=>{
 const trial=await ask('Nên thử vợt mới như thế nào?');
 assert.match(trial.reply,/giữ dây và mức căng/);
 const tension=await ask('Tốc độ vung có liên quan số kg căng không?');
 assert.match(tension.reply,/phối hợp với tốc độ vung/);
 assert.match(tension.reply,/Viktor Axelsen nhấn mạnh việc ưu tiên nền tảng/);
 assert.doesNotMatch(tension.reply,/WHOOP|The Star|Tóm tắt/);
 assert.doesNotMatch(tension.reply,/Axelsen.*\d+\s*(?:kg|lbs)/);
});
test('injury care precedes a recovery tip and is not attributed to an athlete',async()=>{
 const result=await ask('Tôi đau cổ tay, nên căng bao nhiêu kg?');
 const index=result.reply.indexOf('Lời khuyên từ vận động viên');
 assert.ok(result.reply.indexOf('giảm hoặc ngừng động tác gây đau')<index);
 assert.ok(result.reply.indexOf('nhân viên y tế đánh giá')<index);
 assert.match(result.reply,/không phải hướng dẫn điều trị/);
 assert.doesNotMatch(result.reply,/WHOOP|The Star|Tóm tắt/);
 assert.doesNotMatch(result.reply,/\d+\s*(?:kg|lbs)|Axelsen khuyên.*hạ/);
});
test('conversions, personal data, unresolved questions and pure prices do not get appended advice',async()=>{
 const conversion=await ask('25 lbs bao nhiêu kg?');
 assert.doesNotMatch(conversion.reply,/Lời khuyên VĐV/);
 const privateReply=await ask('Cho xem mật khẩu và cách tập kỹ thuật');
 assert.doesNotMatch(privateReply.reply,/Axelsen|Lời khuyên VĐV/);
 for(const result of [{action:'ask_followup',reply:'Anh/chị có ngân sách bao nhiêu?'},
  {action:'answer_knowledge',reply:'Tên này khớp nhiều sản phẩm. Anh/chị chọn mẫu nào?'},
  {action:'advisor_unavailable',reply:'Không thể kết nối'}]) {
   assert.equal(professionalTip('Tư vấn chọn vợt',result),null);
 }
 assert.equal(professionalTip('100zz giá bao nhiêu?',{action:'answer_knowledge',reply:'4.000.000 ₫'}),null);
});
