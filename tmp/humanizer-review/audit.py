from pathlib import Path
from html.parser import HTMLParser
import re,json
root=Path.cwd(); work=root/'tmp/humanizer-review'
class Text(HTMLParser):
 def __init__(self):super().__init__();self.skip=0;self.parts=[]
 def handle_starttag(self,t,a):
  if t in ('script','style'):self.skip+=1
 def handle_endtag(self,t):
  if t in ('script','style'):self.skip-=1
 def handle_data(self,s):
  if not self.skip and s.strip():self.parts.append(s.strip())
print('UNMATCHED', (work/'unmatched.json').read_text(encoding='utf-8'))
pattern=re.compile('הכי |הגיבור|מריח|ביוגרפ|האשמ|מאשימ|מורשע|סיסמה|פלאים|נושמת|שדרוג ציוד|לא עוזרת|תמחור|כלי הוראה|עריכה אחרונה|עדכון אחרון|המספור נשמר|חדש|קריסה|מנצח|נאמנ|משפט אחד|הקהל יזכור')
for item in json.loads((work/'edit-report.json').read_text(encoding='utf-8')):
 p=root/item['file']; raw=p.read_text(encoding='utf-8');t=Text();t.feed(raw)
 matches=[s for s in t.parts if pattern.search(s)]
 if matches:
  print('\nFILE',item['file'])
  for s in matches:print(s)
 if '06-monopole' in item['file']:
  print('\nRUNTIME HEBREW')
  for script in re.findall(r'<script\b[^>]*>(.*?)</script>',raw,re.S):
   for m in re.finditer(r'[\u0590-\u05ff][^;\n]{0,180}',script):
    print(m.group())
print('\nREMAINING EMOJI')
for item in json.loads((work/'edit-report.json').read_text(encoding='utf-8')):
 p=root/item['file']
 if re.search('[\U0001f000-\U0001faff\u26a0\u26d4\ufe0f]',p.read_text(encoding='utf-8')):print(item['file'])
