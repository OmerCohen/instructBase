#!/usr/bin/env python3
"""Assemble networks/08-cryptography/08-cryptography-deck.html on the device.

Takes the house head (CSS, crest data URI) and nav tail from the existing net-07 deck,
so the new deck is byte-identical to the house shell, then injects net-08 CSS, slides and scripts.
Run from the project root:  python3 .agents/build/net08/assemble_on_device.py
"""
import os, re, sys, hashlib

ROOT = os.getcwd()
B = os.path.join(ROOT, '.agents', 'build', 'net08')
SRC = os.path.join(ROOT, 'networks', '07-physical-layer-cabling', '07-physical-layer-cabling-deck.html')
OUT_DIR = os.path.join(ROOT, 'networks', '08-cryptography')
OUT = os.path.join(OUT_DIR, '08-cryptography-deck.html')
TOTAL = 30

def rd(p):
    with open(p, encoding='utf-8') as f:
        return f.read()

ref = rd(SRC)
i0 = ref.index('<section class="slide')
i1 = ref.index('<div class="nav">')
head, tail = ref[:i0], ref[i1:]

# --- house CSS sanity: compare the reference head CSS with the local reconstruction (report only) ---
m = re.search(r'<style>(.*?)</style>', head, re.S)
css_ref = m.group(1)
crest = re.search(r'url\((data:image/[^)]+)\)', css_ref)
local = rd(os.path.join(B, 'house_core.css'))
if crest:
    local = local.replace('__CREST__', crest.group(1))
norm = lambda s: re.sub(r'\s+', '', s)
print('house CSS identical to local reconstruction:', norm(local) == norm(css_ref))

# --- eyebrow / footer conventions taken from net-07 ---
nums = re.findall(r'class="num">([^<]+)<', ref)
pad = bool(nums) and all(len(n) >= 2 and n.isdigit() for n in nums[:3]) and nums[0].startswith('0')
foot = re.findall(r'<span class="ltr">(\d+) / (\d+)</span>', ref)
fpad = bool(foot) and len(foot[0][0]) == 2
print('eyebrow sample', nums[:4], '-> zero-pad' if pad else '-> plain', '| footer sample', foot[:2])

# --- title / aria / deck id ---
head = re.sub(r'<title>.*?</title>', '<title>שיעור 8 · הצפנה וזהות</title>', head, count=1, flags=re.S)
head = re.sub(r'(class="deck-root"[^>]*?)id="[^"]*"', r'\1id="deck-net08"', head, count=1)
head = re.sub(r'(class="deck-root"[^>]*?aria-label=")[^"]*"', r'\1מצגת: הצפנה וזהות"', head, count=1)
head = head.replace('</style>', rd(os.path.join(B, 'net08.css')) + '\n</style>', 1)

# --- slides ---
slides = rd(os.path.join(B, 'slides_all.html'))
parts = [p for p in re.split(r'(?=<section class="slide)', slides) if p.strip()]
assert len(parts) == TOTAL, len(parts)
out = []
for k, p in enumerate(parts):
    p = p.replace('__E__', ('%02d' % k) if pad else str(k))
    p = p.replace('__F__', ('%02d' % (k + 1) if fpad else str(k + 1)) + ' / %d' % TOTAL)
    p = p.replace('__FOOTB__', 'שיעור 8 · הצפנה וזהות · חלק ב׳ · רקע תיאורטי').replace('__FOOT__', 'שיעור 8 · הצפנה וזהות · חלק א׳')
    assert '__' not in re.sub(r'<script.*?</script>', '', p, flags=re.S), k
    out.append(p)

scripts = '<script>\n' + rd(os.path.join(B, 'engines.js')) + '\n</script><script>\n' + rd(os.path.join(B, 'demos.js')) + '\n</script>'
tail = tail.replace('</body>', scripts + '</body>', 1) if '</body>' in tail else tail + scripts
doc = head + '\n'.join(out) + tail
assert doc.count('—') == 0, 'em dash found'
os.makedirs(OUT_DIR, exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(doc)
print('wrote', OUT, len(doc.encode()), 'bytes, sha256', hashlib.sha256(doc.encode()).hexdigest()[:16])
