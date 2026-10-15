import json,re,hashlib
from pathlib import Path
src=Path('outputs/Chatbot_Google_Drive/Index.html');raw=json.loads(re.search(r'const QUESTIONS\s*=\s*(\[.*?\]);',src.read_text()).group(1))
old=json.loads(Path('chatbot-sandbox/knowledge.json').read_text());by_id={e['id']:e for e in old['entries']};reviewed_intents={'BDCV-'+e['id'].split('-')[1]:e for e in old['entries'] if e.get('reviewed')}
entries=[];inherited=0
for r in raw:
 existing=by_id.get(r['id']);correction=reviewed_intents.get(r['intent_id']) if r['answer_source_type']=='Sitio oficial BDCV' else None
 answer=r['proposed_answer'].strip();origin=r['id'];approved=False
 if existing:answer=existing['answer'];approved=bool(existing.get('reviewed'))
 elif correction:answer=correction['answer'];origin=correction['id'];approved=True;inherited+=1
 entries.append({'id':r['id'],'question':r['clean'].strip(),'answer':answer,'source':r['source'],'answerSource':existing.get('source','') if existing else r['answer_source'],'answerStatus':r['answer_status'],'intentId':r['intent_id'],'intentName':r['intent_name'],'intentConfidence':r['intent_confidence'],'canonical':r['canonical'],'reviewed':bool(existing and existing.get('reviewed')),'answerReviewed':approved,'answerOriginId':origin})
result={'reviewedCount':old['reviewedCount'],'questionCount':len(entries),'answeredCount':sum(bool(e['answer']) for e in entries),'unansweredCount':sum(not e['answer'] for e in entries),'source':'Google review app QUESTIONS catalogue','sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),'entries':entries}
corrections=json.loads(Path('chatbot-sandbox/knowledge-corrections.json').read_text())
by_id={e['id']:e for e in entries}
for item in corrections['withdrawn']:
 if item['id'] in by_id:
  by_id[item['id']].update(answer='',answerStatus='Respuesta retirada: '+item['reason'],answerReviewed=False)
for item in corrections['entries']:
 if item['id'] in by_id:by_id[item['id']].update(item)
result['answeredCount']=sum(bool(e['answer']) for e in entries)
result['unansweredCount']=len(entries)-result['answeredCount']
Path('chatbot-sandbox/knowledge.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print({k:v for k,v in result.items() if k!='entries'});print('Historical proposed answers using reviewed canonical correction:',inherited)
