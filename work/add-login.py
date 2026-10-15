from pathlib import Path
import re
p=Path('/Users/asmartinez/Documents/Codex/2026-10-07/this-x20/outputs/Chatbot_Google_Drive/Index.html')
s=p.read_text()
s=s.replace('</style>', '.login{width:min(100%,480px);margin:12vh auto;padding:20px}.login h1{font-size:1.5rem}.login-error{color:var(--red);min-height:24px}.login input{text-transform:lowercase}.login button{margin-top:16px}</style>')
s=s.replace('<body><div class="app">', '''<body><main class="login" id="loginScreen"><section class="card"><h1>Revisión del chatbot</h1><p>Ingresa tu ID COLMEX para continuar.</p><form id="loginForm"><label for="colmexId">ID COLMEX</label><input id="colmexId" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="ID COLMEX" required><p id="loginError" class="login-error" role="alert" aria-live="polite"></p><button class="primary" id="loginSubmit" type="submit">Continuar</button></form></section></main><div class="app hidden" id="reviewApp">''')
s=s.replace('<label for="reviewer">Nombre o iniciales</label><input id="reviewer" type="text" placeholder="Ej. AMS">', '<label for="reviewer">ID COLMEX</label><input id="reviewer" type="text" readonly aria-readonly="true">')
s=s.replace('Usa el mismo nombre o iniciales para recuperar tus evaluaciones en otro dispositivo.', 'Tus evaluaciones se guardan con tu ID COLMEX.')
s=s.replace("const REVIEWER_KEY='bdcv_chatbot_qa_reviewer_server_v1';", "const REGISTERED_IDS=['mch','fmejia','macontreras','mmena','jvortiz','asmartinez','rcuellar','ecisneros','argonzalez','guvega','cescobar','lvergara','mdiosda','nangeles','eruvalcaba','jescobar','mquiroa','cyasmina','tbocanegra','bcastro','cpalacios','cromero','vjcid'];\nlet currentReviewer='';")
s=s.replace("(localStorage.getItem(REVIEWER_KEY)||'').trim().toLowerCase()", 'currentReviewer')
s=s.replace('let state=loadState(); let current=firstPendingIndex();', 'let state={}; let current=0;')
s=s.replace("if(cloudBusy)return;selectedRating=r;", "if(cloudBusy||!currentReviewer)return;selectedRating=r;")
s=s.replace("  if(method==='saveReview')runner.saveReview(argument);", "  if(method==='validateReviewer')runner.validateReviewer(argument);\n  else if(method==='saveReview')runner.saveReview(argument);")
s=s.replace('const reviewer=els.reviewer.value.trim();', 'const reviewer=currentReviewer;')
s=s.replace("if(!reviewer){toast('Escribe tu nombre o iniciales en Opciones y respaldo.');document.querySelector('details.tools').open=true;els.reviewer.focus();return;}", "if(!reviewer){toast('Ingresa tu ID COLMEX para continuar.');return;}")
s=s.replace("if(!reviewer){toast('Escribe tu nombre o iniciales.');els.reviewer.focus();return;}", "if(!reviewer){toast('Ingresa tu ID COLMEX para continuar.');return;}")
s=s.replace('No hay evaluaciones pendientes para este nombre o iniciales.', 'No hay evaluaciones pendientes para este ID COLMEX.')
old="fillIntentSelect();els.reviewer.value=localStorage.getItem(REVIEWER_KEY)||'';els.reviewer.addEventListener('change',()=>{localStorage.setItem(REVIEWER_KEY,els.reviewer.value.trim());state=loadState();current=firstPendingIndex();render();cloudStatus('Usa Cargar mis evaluaciones para recuperar tu progreso de Google Sheets.');});"
assert old in s
s=s.replace(old,"fillIntentSelect();$('loginForm').addEventListener('submit',enterReviewer);")
s=s.replace(";render();\n</script>", ";$('colmexId').focus();\n</script>")
start=s.index('function importJsonFile(')
end=s.index('function download(',start)
s=s[:start]+'''function importJsonFile(file){const rd=new FileReader();rd.onload=()=>{try{const o=JSON.parse(rd.result);if(!o||!o.state||typeof o.state!=='object'||Array.isArray(o.state))throw Error('Respaldo no válido.');const imported={};for(const q of QUESTIONS){const r=o.state[q.id];if(!r?.rating)continue;if(r.reviewer&&r.reviewer.trim().toLowerCase()!==currentReviewer)throw Error('El respaldo contiene evaluaciones de otro usuario.');imported[q.id]={...r,reviewer:currentReviewer};}state=imported;saveState();current=firstPendingIndex();render();toast('Respaldo cargado')}catch(e){toast(e.message||'No se pudo cargar el respaldo.')}};rd.readAsText(file)}''' + s[end:]
s=s.replace('function setBusy(b){', '''async function enterReviewer(event){
  event.preventDefault();
  const id=$('colmexId').value.trim().toLowerCase();
  $('loginError').textContent='';
  if(!REGISTERED_IDS.includes(id)){$('loginError').textContent='Usuario no registrado.';return;}
  $('loginSubmit').disabled=true;$('colmexId').disabled=true;
  try{
    const result=await rpc('validateReviewer',id);
    if(!result?.ok||result.id!==id)throw new Error('Usuario no registrado.');
    currentReviewer=id;els.reviewer.value=id;state=loadState();current=firstPendingIndex();
    $('loginScreen').classList.add('hidden');$('reviewApp').classList.remove('hidden');render();
    await loadCloud();
  }catch(e){$('loginError').textContent=e.message;}
  finally{$('loginSubmit').disabled=false;$('colmexId').disabled=false;}
}
function setBusy(b){''')
assert 'REVIEWER_KEY' not in s
assert 'Nombre o iniciales' not in s
p.write_text(s)
print('Added per-visit COLMEX ID gate, automatic progress restore and fixed reviewer identity.')
