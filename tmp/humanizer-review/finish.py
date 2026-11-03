from pathlib import Path
from html.parser import HTMLParser
import json,re,subprocess,shutil,hashlib,sys

root=Path.cwd(); work=root/'tmp/humanizer-review'
report=json.loads((work/'edit-report.json').read_text(encoding='utf-8'))
node='C:/Users/OmerCohen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
decks=[]
for item in report:
 p=root/item['file']; s=p.read_text(encoding='utf-8')
 assert not re.search('[\U0001f000-\U0001faff\u26a0\u26d4\ufe0f]',s),p
 assert not re.search('עדכון אחרון|עריכה אחרונה|נערך לאחרונה',s),p
 if p.name.endswith('-deck.html'):
  old=(work/'before'/item['file']).read_text(encoding='utf-8')
  count=len(re.findall(r'<section\b[^>]*class="slide(?:\s|")',s))
  assert count==len(re.findall(r'<section\b[^>]*class="slide(?:\s|")',old)),p
  assert len(re.findall(r'<aside\b[^>]*class="speaker-note"',s))==count,p
  for js in re.findall(r'<script\b[^>]*>(.*?)</script>',s,re.S):
   r=subprocess.run([node,'--check'],input=js.encode('utf-8'),capture_output=True)
   assert r.returncode==0,(p,r.stderr)
  decks.append({'file':item['file'],'slides':count})
class Links(HTMLParser):
 def handle_starttag(self,tag,attrs):
  if tag=='a':
   link=dict(attrs).get('href','')
   if link and not link.startswith(('#','http:','https:','mailto:')):
    assert (root/link.split('#')[0]).exists(),link
Links().feed((root/'index.html').read_text(encoding='utf-8'))
assert 'badge-new' not in (root/'index.html').read_text(encoding='utf-8')
pdfs=json.loads((work/'pdf-validation.json').read_text(encoding='utf-8'))
assert len(pdfs)==14
assert len(decks)==13
if '--publish' in sys.argv:
 for item in pdfs:
  src=root/item['staged']; target=root/item['target']; backup=work/'before'/item['target']
  backup.parent.mkdir(parents=True,exist_ok=True)
  if not backup.exists():shutil.copy2(target,backup)
  shutil.copy2(src,target)
  assert hashlib.sha256(src.read_bytes()).digest()==hashlib.sha256(target.read_bytes()).digest()
 print('REPLACED 14 published PDFs with verified exports')
result={'decks':decks,'pdfs':pdfs,'published':'--publish' in sys.argv,'checks':['source emoji and editorial-marker scan','slide and speaker-note preservation','JavaScript syntax','index links','PDF page count, dimensions and Hebrew text']}
(work/'completion-report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print('PASS',len(decks),'decks',sum(d['slides'] for d in decks),'slides;',len(pdfs),'PDFs',sum(p['pages'] for p in pdfs),'pages')
