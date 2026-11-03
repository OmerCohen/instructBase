from pathlib import Path
import json, re, shutil, subprocess

ROOT = Path(__file__).resolve().parents[2]
WORK = Path(__file__).resolve().parent
NODE = r'C:/Users/OmerCohen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
pairs = json.loads((WORK / 'edits.json').read_text(encoding='utf-8'))
files = (sorted(ROOT.glob('radio/**/*-deck.html')) + sorted(ROOT.glob('networks/**/*-deck.html'))
         + sorted(ROOT.glob('.agents/guide-sources/*.html'))
         + [ROOT / 'reference/technician-card-a6-source.html', ROOT / 'index.html'])
protected = re.compile(r'(<script\b[^>]*>.*?</script\s*>|<style\b[^>]*>.*?</style\s*>)', re.S | re.I)
emoji = re.compile('[\U0001f000-\U0001faff\u26a0\u26d4\ufe0f]')
report = []; hits = [0] * len(pairs)
for p in files:
    relative = p.relative_to(ROOT)
    backup = WORK / 'before' / relative
    backup.parent.mkdir(parents=True, exist_ok=True)
    if not backup.exists():
        shutil.copy2(p, backup)
    original = backup.read_bytes().decode('utf-8')
    parts = protected.split(original)
    changes = []
    for k, part in enumerate(parts):
        is_style = bool(re.match(r'<style\b', part, re.I))
        is_script = bool(re.match(r'<script\b', part, re.I))
        if not is_style:
            for i, (old, new) in enumerate(pairs):
                count = part.count(old)
                if count:
                    part = part.replace(old, new)
                    hits[i] += count
                    changes.append({'old': old, 'new': new, 'count': count, 'script': is_script})
            # Preserve numeric ranges, commands, and placeholder dashes.
            if not is_script:
                part = re.sub(r'(?<=\S) — (?=\S)', ', ', part)
                part = part.replace('–', '-')
        count = len(emoji.findall(part))
        if count:
            part = emoji.sub('', part)
            changes.append({'kind': 'emoji', 'count': count})
        if is_style:
            part = part.replace('✓', '•').replace('✔', '•')
        else:
            part = part.replace('✓', '').replace('✗', '').replace('✕', 'חסום:')
        parts[k] = part
    updated = ''.join(parts)
    if p.name == 'index.html':
        updated = updated.replace('<span class="badge-new">חדש</span>', '')
        updated = updated.replace('class="lesson new"', 'class="lesson"')
        updated = re.sub(r'\.badge-new\{[^}]*\}', '', updated)
        updated = re.sub(r'\.lesson\.new[^{}]*\{[^}]*\}', '', updated)
        updated = re.sub(r'<p[^>]*>המספור נשמר.*?</p>', '', updated, flags=re.S)
        updated = re.sub(r'<footer>.*?</footer>', '<footer>המצגות נפתחות בדפדפן ופועלות גם ללא חיבור לרשת. דפי ההנחיה מיועדים להדפסה בגודל A4; דפית הטכנאי בגודל A6.</footer>', updated, flags=re.S)
    # Any script edits are text only. Check every block before writing.
    for script in re.findall(r'<script\b[^>]*>(.*?)</script\s*>', updated, re.S | re.I):
        checked = subprocess.run([NODE, '--check'], input=script.encode('utf-8'), capture_output=True)
        if checked.returncode:
            raise RuntimeError(str(relative) + ': ' + checked.stderr.decode('utf-8', 'replace'))
    if p.read_bytes().decode('utf-8') not in (original, updated):
        raise RuntimeError('Source changed during editing: ' + str(relative))
    if p.read_bytes().decode('utf-8') != updated:
        p.write_bytes(updated.encode('utf-8'))
    report.append({'file': relative.as_posix(), 'changed': original != updated, 'edits': changes})
(WORK / 'edit-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
(WORK / 'unmatched.json').write_text(json.dumps([pairs[i] for i,c in enumerate(hits) if not c], ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'reviewed':len(files), 'changed':sum(r['changed'] for r in report), 'matched_edits':sum(hits), 'unmatched':sum(not c for c in hits)}, ensure_ascii=False))
for r in report:
    print(r['file'], sum(x.get('count', 0) for x in r['edits']))
