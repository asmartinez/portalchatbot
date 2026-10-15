from pathlib import Path
import json,re
index=Path('outputs/Chatbot_Google_Drive/Index.html').read_text()
m=re.search(r'const INTENTS\s*=\s*(\[.*?\]);',index)
print(m.group(1)[:400] if m else 'No intents')
