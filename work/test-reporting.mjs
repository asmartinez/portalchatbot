import assert from 'node:assert/strict';
import {answerText,reportQuestionUrl} from '../chatbot-sandbox/app/report-question.ts';
const title='¿Cómo puedo buscar y consultar las tesis de El Colegio de México?';
const link='https://repositorio.colmex.mx/catalog?f%5Bhuman_readable_type_sim%5D%5B%5D=Thesis';
assert.equal(answerText(link+' ('+title+')'),link);
assert.equal(answerText('Consulta este recurso (en línea).'),'Consulta este recurso (en línea).');
assert.equal(answerText(link+' (Referencia: "'+title+'")'),link);
const q='¿Dónde están las tesis? <script>alert(1)</script> & más';
const url=new URL(reportQuestionUrl(q,link+' ('+title+')','en','6df9c299-bdf7-4b5c-8d9d-6675fddd03a5'));
assert.equal(url.searchParams.get('view'),'report');const data=JSON.parse(decodeURIComponent(url.hash.slice(1)));assert.equal(data.question,q);assert.equal(data.ai_answer,link);assert.equal(data.language,'en');
async function call(body){const r=await fetch('http://127.0.0.1:5173/api/chat',{method:'POST',headers:{Cookie:'__sites_local_auth=1','Content-Type':'application/json',Origin:'http://127.0.0.1:5173'},body:JSON.stringify(body)});assert.equal(r.status,200);return r.json();}
let c=await call({action:'create',mode:'ai',language:'es',label:'Report question integration test'});c=await call({action:'send',id:c.conversation.id,text:'¿Dónde puedo consultar las tesis electrónicas de El Colegio de México?'});let answer=c.messages.filter(m=>m.role==='model').at(-1);assert(answer);assert(answer.body.includes('repositorio.colmex.mx'));assert(!answer.body.includes(title));console.log('Passed: exact source citation removed, unrelated parentheses preserved, URL query and Unicode report round trip, and live Gemini answer has useful URL without question-title citation.');
