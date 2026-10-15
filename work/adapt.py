from pathlib import Path
import re
root = Path('/Users/asmartinez/Documents/Codex/2026-10-07/this-x20')
s = Path('/Users/asmartinez/Downloads/Biblioteca_Chatbot_Server_Package/index.html').read_text()
s = s.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<base target="_top">')
s = s.replace('Cada evaluación se guarda en este navegador y también se envía al servidor.', 'Cada evaluación se guarda en este navegador y se envía a Google Sheets. Usa el mismo nombre o iniciales para recuperar tus evaluaciones en otro dispositivo.')
s = s.replace('<button class="secondary" id="nextPending"', '<button class="secondary" id="uploadPending" type="button">Enviar mis evaluaciones pendientes a Google Sheets</button><button class="secondary" id="loadCloud" type="button">Cargar mis evaluaciones de Google Sheets</button><p id="cloudStatus" class="meta" role="status" aria-live="polite">Google Sheets: listo para guardar.</p><button class="secondary" id="nextPending"')
start = s.index('async function saveToServer(')
end = s.index('function goPrev()', start)
replacement = r'''
let cloudBusy=false;
function cloudStatus(message){$('cloudStatus').textContent=message;}
function rpc(method, argument){return new Promise((resolve,reject)=>{
  if(typeof google==='undefined'||!google.script?.run){reject(new Error('Abre la URL de la aplicación publicada en Google Apps Script.'));return;}
  const runner=google.script.run.withSuccessHandler(resolve).withFailureHandler(e=>reject(new Error(e.message||String(e))));
  if(method==='saveReview')runner.saveReview(argument);
  else if(method==='saveReviews')runner.saveReviews(argument);
  else if(method==='getReviews')runner.getReviews(argument);
  else reject(new Error('Operación no válida.'));
});}
function setBusy(b){cloudBusy=b;['saveNext','prev','skip','btnGreen','btnYellow','btnRed','uploadPending','loadCloud','importJsonBtn','clearProgress','nextPending','reviewer'].forEach(id=>$(id).disabled=b);}
function makeRecord(q,r){return {question_id:q.id,question:q.question,source:q.source||'',proposed_intent_id:q.intent_id||'',proposed_intent:q.intent_name||'',proposed_answer:q.proposed_answer||'',answer_source:q.answer_source||'',...r};}
async function saveDetailed(){
  if(cloudBusy||!selectedRating)return;
  const reviewer=els.reviewer.value.trim();
  if(!reviewer){toast('Escribe tu nombre o iniciales en Opciones y respaldo.');document.querySelector('details.tools').open=true;els.reviewer.focus();return;}
  const q=QUESTIONS[current],iid=selectedRating==='red'?els.correctedIntent.value:'';
  if(selectedRating!=='red'&&!els.correctAnswer.value.trim()){toast('Escribe la respuesta correcta antes de continuar.');return;}
  if(selectedRating==='red'&&!iid){toast('Selecciona la intención correcta o propone una nueva.');return;}
  if(iid==='__NEW__'&&!els.newIntent.value.trim()){toast('Escribe el nombre de la nueva intención.');return;}
  const found=INTENTS.find(i=>i.id===iid);
  const review={rating:selectedRating,corrected_intent_id:iid,corrected_intent_name:found?found.name:'',new_intent:iid==='__NEW__'?els.newIntent.value.trim():'',correct_answer:selectedRating!=='red'?els.correctAnswer.value.trim():'',comment:els.comment.value.trim(),reviewer,reviewed_at:new Date().toISOString()};
  state[q.id]=review;
  try{saveState();}catch(e){cloudStatus('No se pudo guardar el respaldo en este navegador. Se intentará guardar en Google Sheets.');}
  setBusy(true);cloudStatus('Guardando en Google Sheets…');
  let saved=false;
  try{
    const result=await rpc('saveReview',makeRecord(q,review));
    if(!result?.ok)throw new Error('Google Sheets no confirmó el guardado.');
    review.cloud_saved_at=review.reviewed_at;
    try{saveState();}catch(e){console.error(e);}
    saved=true;cloudStatus('Guardado en Google Sheets.');toast('Guardado en Google Sheets');
  }catch(e){
    cloudStatus('No se pudo guardar en Google Sheets: '+e.message+'. Usa Enviar mis evaluaciones pendientes para reintentar.');
    toast('No se pudo confirmar el guardado en Google Sheets.');
    document.querySelector('details.tools').open=true;
  }finally{setBusy(false);}
  if(!saved)return;
  const n=nextPendingIndex(current);
  if(n===-1){updateStats();return;}
  current=n;render();
}
async function uploadPending(){
  if(cloudBusy)return;
  const reviewer=els.reviewer.value.trim();
  if(!reviewer){toast('Escribe tu nombre o iniciales.');els.reviewer.focus();return;}
  const pending=QUESTIONS.filter(q=>{const r=state[q.id];return r?.rating&&(!r.reviewer||r.reviewer.trim().toLowerCase()===reviewer.toLowerCase())&&r.cloud_saved_at!==r.reviewed_at;});
  if(!pending.length){cloudStatus('No hay evaluaciones pendientes para este nombre o iniciales.');return;}
  setBusy(true);
  try{
    for(let i=0;i<pending.length;i+=50){
      const batch=pending.slice(i,i+50);
      cloudStatus('Enviando '+Math.min(i+50,pending.length)+' de '+pending.length+' evaluaciones…');
      const records=batch.map(q=>makeRecord(q,{...state[q.id],reviewer}));
      const result=await rpc('saveReviews',records);
      if(!result?.ok)throw new Error('Google Sheets no confirmó el guardado.');
      batch.forEach(q=>{state[q.id].reviewer=reviewer;state[q.id].cloud_saved_at=state[q.id].reviewed_at;});
      try{saveState();}catch(e){console.error(e);}
    }
    cloudStatus('Evaluaciones enviadas a Google Sheets: '+pending.length);toast('Evaluaciones guardadas en Google Sheets');
  }catch(e){cloudStatus('No se completó el envío: '+e.message+'. Las evaluaciones no confirmadas siguen pendientes.');}
  finally{setBusy(false);}
}
async function loadCloud(){
  if(cloudBusy)return;
  const reviewer=els.reviewer.value.trim();
  if(!reviewer){toast('Escribe tu nombre o iniciales.');els.reviewer.focus();return;}
  setBusy(true);cloudStatus('Cargando tus evaluaciones…');
  try{
    const remote=await rpc('getReviews',reviewer);
    for(const q of QUESTIONS){
      const r=remote[q.id],local=state[q.id];
      if(r&&(!local||Date.parse(r.reviewed_at)>=Date.parse(local.reviewed_at))){
        state[q.id]={rating:r.rating,corrected_intent_id:r.corrected_intent_id,corrected_intent_name:r.corrected_intent_name,new_intent:r.new_intent,correct_answer:r.correct_answer,comment:r.comment,reviewer:r.reviewer,reviewed_at:r.reviewed_at,cloud_saved_at:r.reviewed_at};
      }
    }
    saveState();current=firstPendingIndex();render();cloudStatus('Evaluaciones de Google Sheets cargadas: '+Object.keys(remote).length);
  }catch(e){cloudStatus('No se pudieron cargar las evaluaciones: '+e.message);}
  finally{setBusy(false);}
}
'''
s=s[:start]+replacement+s[end:]
s=s.replace('els.saveNext.onclick=saveDetailed;', "els.saveNext.onclick=saveDetailed;$('uploadPending').onclick=uploadPending;$('loadCloud').onclick=loadCloud;")
s=s.replace('tt=setTimeout(()=>els.toast.classList.remove(\'show\'),1500)', 'tt=setTimeout(()=>els.toast.classList.remove(\'show\'),5000)')
# The web app keeps browser progress separate for each reviewer.
s=s.replace("const STORAGE_KEY='bdcv_chatbot_qa_review_server_v1'; const REVIEWER_KEY='bdcv_chatbot_qa_reviewer_server_v1';", "const REVIEWER_KEY='bdcv_chatbot_qa_reviewer_server_v1';\nfunction reviewStorageKey(){return 'bdcv_chatbot_qa_google_v1_'+(localStorage.getItem(REVIEWER_KEY)||'').trim().toLowerCase();}")
s=s.replace('localStorage.getItem(STORAGE_KEY)', 'localStorage.getItem(reviewStorageKey())').replace('localStorage.setItem(STORAGE_KEY,', 'localStorage.setItem(reviewStorageKey(),').replace('localStorage.removeItem(STORAGE_KEY)', 'localStorage.removeItem(reviewStorageKey())')
s=s.replace("els.reviewer.addEventListener('input',()=>localStorage.setItem(REVIEWER_KEY,els.reviewer.value));", "els.reviewer.addEventListener('change',()=>{localStorage.setItem(REVIEWER_KEY,els.reviewer.value.trim());state=loadState();current=firstPendingIndex();render();cloudStatus('Usa Cargar mis evaluaciones para recuperar tu progreso de Google Sheets.');});")
(root/'outputs/Chatbot_Google_Drive/Index.html').write_text(s)
# A small explanatory page can replace the old private-server index after deployment.
(root/'outputs/Chatbot_Google_Drive/private-server-index.html').write_text('''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Revisión del chatbot</title><style>body{font:18px system-ui;max-width:650px;margin:80px auto;padding:24px}a{display:inline-block;padding:16px;background:#1f4d6d;color:white;border-radius:10px}</style><h1>Revisión de preguntas y respuestas</h1><p>Las evaluaciones se guardan en Google Sheets.</p><a href="REPLACE_WITH_GOOGLE_WEB_APP_EXEC_URL">Abrir revisión</a></html>''')
print('Prepared Google Apps Script frontend and optional private-server launcher.')
