from pathlib import Path
from pypdf import PdfReader
from PIL import Image,ImageDraw
from html.parser import HTMLParser
import subprocess,re,json
root=Path.cwd();work=root/'tmp/humanizer-review';out=work/'rendered'
pop=Path('C:/Users/OmerCohen/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin')
results=[]
for item in json.loads((work/'render-report.json').read_text(encoding='utf-8')):
 if item['kind']!='pdf':continue
 src=root/item['file'];pdf=out/item['output'];r=PdfReader(pdf)
 if 'technician-card' in src.name:
  target=root/'reference/technician-card-a6.pdf';expected=2;size=(297.638,419.528)
 else:
  match=re.match(r'(\d\d)_(net|radio)_',src.name)
  num,branch=(match[1], 'networks' if match[2]=='net' else 'radio') if match else ('06','radio')
  target=next((root/branch).glob(num+'*/*-guide.pdf'))
  expected=len(re.findall(r'class="pg(?:\s|")',src.read_text(encoding='utf-8')))
  size=(595.276,841.890)
 assert len(r.pages)==expected,(src.name,len(r.pages),expected)
 for page in r.pages:
  assert abs(float(page.mediabox.width)-size[0])<1 and abs(float(page.mediabox.height)-size[1])<1
  assert len(re.findall('[\u0590-\u05ff]',page.extract_text()))>15,(src.name,'missing Hebrew')
  assert '\ufffd' not in page.extract_text(),(src.name,'replacement glyph')
 text='\n\f\n'.join(page.extract_text() for page in r.pages)
 assert not re.search('[\U0001f000-\U0001faff\u26a0\u26d4\ufe0f]',text),(src.name,'emoji')
 assert not re.search('עדכון אחרון|עריכה אחרונה|נערך לאחרונה',text)
 (out/(pdf.stem+'.txt')).write_text(text,encoding='utf-8')
 pagesdir=out/(pdf.stem+'-pages');pagesdir.mkdir(exist_ok=True)
 existing=list(pagesdir.glob('*.png'))
 if len(existing)!=expected or any(p.stat().st_mtime<pdf.stat().st_mtime for p in existing):
  subprocess.run([str(pop/'pdftoppm.exe'),'-scale-to','1000','-png',str(pdf),str(pagesdir/'page')],capture_output=True,check=True)
 images=sorted(pagesdir.glob('*.png'))
 sheet=Image.new('RGB',(1000,374*((len(images)+3)//4)),'#dddddd')
 for i,p in enumerate(images):
  im=Image.open(p).convert('RGB');im.thumbnail((242,344));x=(i%4)*250;y=(i//4)*374
  sheet.paste(im,(x,y+25));ImageDraw.Draw(sheet).text((x+5,y+5),str(i+1),fill='black')
 sheet.save(out/(pdf.stem+'-contact.jpg'))
 results.append({'source':item['file'],'staged':str(pdf.relative_to(root)),'target':str(target.relative_to(root)),'pages':len(r.pages),'old_pages':len(PdfReader(target).pages)})
 print('PASS',src.name,len(r.pages),'pages',flush=True)
for d in sorted(p for p in out.iterdir() if p.is_dir() and p.name.endswith('-deck')):
 files=sorted(d.glob('*.png'));sheet=Image.new('RGB',(1280,202*((len(files)+3)//4)),'#dddddd')
 for i,p in enumerate(files):
  im=Image.open(p).convert('RGB');im.thumbnail((320,180));x=i%4*320;y=i//4*202
  sheet.paste(im,(x,y+22));ImageDraw.Draw(sheet).text((x+4,y+3),p.stem,fill='black')
 sheet.save(out/(d.name+'-contact.jpg'))
(work/'pdf-validation.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
print('VALIDATED',len(results),'PDFs,',sum(r['pages'] for r in results),'pages',flush=True)
