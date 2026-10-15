import assert from 'node:assert/strict';
import {humanSupportOpen} from '../chatbot-sandbox/app/support.ts';
for(const [iso,expected] of [['2026-10-05T14:59:00Z',false],['2026-10-05T15:00:00Z',true],['2026-10-05T22:59:00Z',true],['2026-10-05T23:00:00Z',false],['2026-10-10T18:00:00Z',false]])assert.equal(humanSupportOpen(new Date(iso)),expected,iso);
const base='http://127.0.0.1:5173/api/chat';
async function call(body,query=''){const r=await fetch(base+query,{method:body?'POST':'GET',headers:{Cookie:'__sites_local_auth=1',...(body?{'Content-Type':'application/json',Origin:'http://127.0.0.1:5173'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
let r=await call();assert.equal(r.status,200);assert.equal(r.data.gemini,true);assert.equal(r.data.knowledgeCount,43);assert.equal(r.data.reviewedCount,20);assert.equal(r.data.support.recipient,'asmartinez@colmex.mx');assert.equal((await call(undefined,'?inbox=1')).status,410);
r=await call({action:'create',mode:'ai',language:'auto',label:'Gemini multilingual integration test'});const id=r.data.conversation.id;
for(const text of ['¿Cómo puedo obtener una membresía de la biblioteca?','And how long is it valid? Puedes responder en English.']){r=await call({action:'send',id,text});if(r.status!==200){console.log(JSON.stringify({status:r.status,error:r.data.error,modelUnavailable:true}));process.exit(2);}const answer=r.data.messages.filter(m=>m.role==='model').at(-1)?.body;assert(answer);console.log(JSON.stringify({question:text,answer}));if(text.startsWith('¿'))assert(answer.includes('300')&&answer.includes('2,000')||answer.includes('300')&&answer.includes('2000'));else assert(/year|annually/i.test(answer));}
r=await call({action:'language',id,language:'en'});assert.equal(r.data.conversation.language,'en');assert(r.data.messages.some(m=>m.body.startsWith('¿Cómo')));
r=await call({action:'handoff',id});assert([409,503].includes(r.status));assert(r.data.error.includes('asmartinez')||r.data.error.includes('fuera de horario'));
assert.equal((await call({action:'transfer',id,agent:'mmena'})).status,410);
console.log('Passed: corrected knowledge, real Gemini Spanish/English with context, explicit language selection, office-hours boundaries, Teams-only destination and disabled inbox/transfers.');
