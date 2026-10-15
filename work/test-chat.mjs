import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173/api/chat';
async function call(body,auth=true,query=''){const r=await fetch(base+query,{method:body?'POST':'GET',headers:{...(auth?{Cookie:'__sites_local_auth=1'}:{}),...(body?{'Content-Type':'application/json',Origin:'http://127.0.0.1:5173'}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}
assert.equal((await call(undefined,false)).status,401);
let r=await call({action:'create',language:'auto',mode:'ai',label:'Integration test'});assert.equal(r.status,200);const id=r.data.conversation.id;
r=await call({action:'send',id,text:'Hola! Can I switch languages?'});assert.equal(r.status,200);assert(r.data.messages.some(m=>m.body.includes('not configured')));
r=await call({action:'language',id,language:'en'});assert.equal(r.data.conversation.language,'en');assert(r.data.messages.some(m=>m.body.includes('Can I switch')));
r=await call({action:'send',id,text:'Can I talk to a person?'});assert.equal(r.data.conversation.status,'waiting');
const claims=await Promise.all([call({action:'claim',id,agent:'asmartinez'}),call({action:'claim',id,agent:'mch'})]);assert.deepEqual(claims.map(x=>x.status).sort(),[200,409]);
r=await call({action:'reply',id,text:'Hola, aquí estoy. Happy to help.'});assert.equal(r.status,200);assert(r.data.messages.some(m=>m.role==='human'));
r=await call({action:'transfer',id,agent:'mmena'});assert.equal(r.data.conversation.agent,'mmena');
r=await call(undefined,true,'?id='+id);assert(r.data.messages.some(m=>m.body.includes('Happy to help')));
r=await call({action:'transfer',id,agent:'unknown'});assert.equal(r.status,400);
r=await call({action:'close',id});assert.equal(r.data.conversation.status,'closed');assert.equal((await call({action:'send',id,text:'test'})).status,409);
r=await call({action:'import',rows:[{question:'Test question',answer:'Test approved answer'}]});assert.equal(r.status,200);assert.equal((await call()).data.knowledgeCount,1);
console.log('Passed: auth, persistence, language switching, human request, concurrent claim, reply, transfer, invalid recipient, closed-chat guard and answer import.');
