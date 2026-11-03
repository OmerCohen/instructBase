from pathlib import Path
p=Path('.agents/guide-sources/06_guide_source.html')
s=p.read_text(encoding='utf-8')
s=s.replace('.brief th,.brief td{padding:4pt 7pt}', '.brief th,.brief td{padding:3pt 7pt}\n.brief{line-height:1.3}\n.brief .note p{line-height:1.35}\n.brief .chips{margin-bottom:10pt}\n.brief .chip{padding:8pt}\n.brief .rule{margin-bottom:10pt}')
p.write_bytes(s.encode('utf-8'))
print('Brief spacing adjusted')
