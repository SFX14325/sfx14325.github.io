import json, re, html, shutil
from pathlib import Path
from urllib.parse import urlsplit, unquote
import mistune, bleach
from bleach.css_sanitizer import CSSSanitizer
root=Path('content'); out=Path('compiled'); shutil.rmtree(out,ignore_errors=True); out.mkdir()
notes=json.loads((root/'index.json').read_text())['notes']; tags=json.loads((root/'tags.json').read_text()); settings=json.loads(Path('settings.json').read_text()); lookup={}; names={}
def clean(s): return re.sub(r'\.md$','',s.replace('\\','/').lstrip('/'),flags=re.I).lower()
def title(s): return re.sub(r'[-_]',' ',Path(s).stem).title()
for n in notes:
 p=n['path']; k=clean(p); t=title(p).lower()
 if k in lookup or t in names: print('WARNING duplicate note identifier:',p)
 lookup.setdefault(k,p); names.setdefault(t,p)
def resolve(s): return lookup.get(clean(s)) or names.get(clean(s).split('/')[-1])
markdown=mistune.create_markdown(escape=False,plugins=['table','strikethrough','task_lists','url'])
allowed=set(bleach.sanitizer.ALLOWED_TAGS)|set('p h1 h2 h3 h4 h5 h6 pre div span hr br img table thead tbody tr th td del input video audio source iframe'.split())
for n in notes:
 p=n['path']; raw=(root/p).read_text(encoding='utf8'); body=re.sub(r'^---\s*\n[\s\S]*?\n---\s*\n?','',raw,count=1)
 if raw.startswith('---\n') and body==raw: print('WARNING malformed frontmatter:',p)
 for t in n['tags']:
  if t not in tags: print('WARNING undefined tag:',p,t)
 def wiki(m):
  target,_,label=m.group(1).partition('|'); label=label or target
  if re.search(r'\.(png|jpe?g|gif|svg|webp|avif)$',target,re.I): return f'<img src="{html.escape(target,quote=True)}" alt="{html.escape(label,quote=True)}">'
  dest=resolve(target.split('#')[0]);
  if not dest: print('WARNING unresolved wiki link:',p,target); return html.escape(label)
  return f'<a class="wikilink" href="#" data-wiki="{html.escape(dest,quote=True)}">{html.escape(label if label!=target else title(dest))}</a>'
 # Avoid rewriting fenced and inline code.
 parts=re.split(r'(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)',body); body=''.join(x if i%2 else re.sub(r'!?\[\[([^\]]+)\]\]',wiki,x) for i,x in enumerate(parts))
 def attrs(tag,key,value):
  if key=='style': return tag=='span' and bool(re.fullmatch(r'color:\s*#[0-9a-fA-F]{6};?',value))
  if key in ('src','poster','href'):
   u=urlsplit(value)
   if tag=='iframe': return key=='src' and u.scheme=='https' and ((u.netloc=='www.youtube-nocookie.com' and u.path.startswith('/embed/')) or (u.netloc=='www.youtube.com' and u.path.startswith('/embed/') and settings.get('media',{}).get('youtube_nocookie_only') is False) or (u.netloc=='player.vimeo.com' and u.path.startswith('/video/')))
   if not u.scheme and not u.netloc and u.path and not (root/Path(p).parent/unquote(u.path)).is_file(): print('WARNING missing local resource:',p,value)
   return True
  if tag=='input': return key in ('checked','disabled') or (key=='type' and value=='checkbox')
  return key in ('class','title','alt','data-wiki','controls','playsinline','muted','loop','preload','type','width','height','allowfullscreen','loading','align')
 result=bleach.clean(markdown(body),tags=allowed,attributes=attrs,css_sanitizer=CSSSanitizer(allowed_css_properties=['color']),protocols=['http','https','mailto','tel'],strip=True)
 dest=out/(p+'.html'); dest.parent.mkdir(parents=True,exist_ok=True); dest.write_text(result,encoding='utf8')
print(f'Compiled {len(notes)} notes.')
