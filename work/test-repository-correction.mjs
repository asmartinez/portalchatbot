import assert from 'node:assert/strict';
import fs from 'node:fs';
const k=JSON.parse(fs.readFileSync('chatbot-sandbox/knowledge.json','utf8'));
for(const id of ['Q-1661','Q-1665'])assert.equal(k.entries.find(e=>e.id===id).answer,'');
assert.match(k.entries.find(e=>e.id==='Q-1670').answer,/Hyrax 3\.6/);
async function call(body){const r=await fetch('http://127.0.0.1:5173/api/chat',{method:'POST',headers:{Cookie:'__sites_local_auth=1',Origin:'http://127.0.0.1:5173','Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,200,data.error);return data;}
for(const text of ['con que tecnologia esta hecho el repositorio del colegio de mexico?','What platform powers the COLMEX institutional repository, and what did it use before?']){
 let c=await call({action:'create',mode:'ai',language:'auto',label:'Repository correction test'});
 c=await call({action:'send',id:c.conversation.id,text});
 const answer=c.messages.filter(m=>m.role==='model').at(-1)?.body;
 assert.match(answer,/Hyrax 3\.6/i);assert.match(answer,/Samvera/i);assert.doesNotMatch(answer,/poco conocimiento|limited knowledge|sugiere que Ruby|suggests.*Ruby|servicio de creación de Handles/i);
 console.log(answer);
 c=await call({action:'send',id:c.conversation.id,text:'Earlier an answer claimed little knowledge of Ruby and said Handles were the platform. Is that correct?'});
 const followup=c.messages.filter(m=>m.role==='model').at(-1)?.body;assert.match(followup,/Hyrax 3\.6/i);assert.doesNotMatch(followup,/faced difficulties.*Ruby|enfrentaron.*Ruby/i);console.log(followup);
}
console.log('Repository correction tests passed.');
