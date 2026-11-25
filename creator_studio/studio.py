import json, re, shutil, datetime, os, secrets, threading, webbrowser, mimetypes, base64
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlsplit, unquote
import mistune, bleach, yaml
from markdownify import markdownify
from bleach.css_sanitizer import CSSSanitizer
import html
TOKEN=secrets.token_urlsafe(24)
ROOT=None
DATA=None
PREF=Path.home()/'.knowledge_garden_studio.json'
MD=mistune.create_markdown(escape=False,plugins=['table','strikethrough','task_lists','url'])
FOOT=re.compile(r'\n*---\n\n\*Created: .*? \| Updated: .*? \| Version: \d+\*\s*$',re.S)
def safe(root,p):
 q=(root/p).resolve(); q.relative_to(root.resolve()); return q
def split(raw):
 m=re.match(r'^---\s*\n([\s\S]*?)\n---\s*\n?',raw)
 return (yaml.safe_load(m[1]) or {},raw[m.end():]) if m else ({},raw)
def notes(): return sorted(p.relative_to(ROOT).as_posix() for p in ROOT.rglob('*.md') if p.is_file())
def read(p): return safe(ROOT,p).read_text(encoding='utf8')
def atomic(p,s):
 p.parent.mkdir(parents=True,exist_ok=True); t=p.with_name(p.name+'.tmp'); t.write_text(s,encoding='utf8'); t.replace(p)
def stamp(): return datetime.date.today().isoformat()
def serialize_note(meta,body,default_title='Untitled'):
 meta=dict(meta); tags=meta.pop('tags',[]); title=str(meta.pop('title',default_title)).replace('\n',' '); tags=tags if isinstance(tags,list) else [tags]
 return '---\ntitle: '+title+'\ntags: ['+', '.join(map(str,tags))+']\n'+yaml.safe_dump(meta,sort_keys=False,allow_unicode=True).removesuffix('{}\n')+'---\n'+body
def save(p,raw,expected=None):
 q=safe(ROOT,p); old=q.read_text(encoding='utf8') if q.exists() else None
 if old is not None and expected!=old: raise ValueError('File changed externally; reopen before saving.')
 if old==raw:return old
 meta,body=split(raw); prev=split(old)[0] if old else {}; meta['created']=str(prev.get('created',meta.get('created',stamp()))); meta['updated']=stamp(); meta['version']=int(prev.get('version',0))+1
 if old is not None: atomic(safe(DATA,'revisions/'+p+'/'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.md'),old)
 body=FOOT.sub('',body).rstrip(); footer=f"\n\n---\n\n*Created: {meta['created']} | Updated: {meta['updated']} | Version: {meta['version']}*\n"
 result=serialize_note(meta,body+footer,q.stem)
 atomic(q,result); return result
def catalog():
 out=[]
 for p in notes():
  try:
   m,b=split(read(p)); links=re.findall(r'\[\[([^\]|#]+)',b); out.append(dict(path=p,title=str(m.get('title',Path(p).stem)),tags=m.get('tags',[]),created=str(m.get('created','')),updated=str(m.get('updated','')),version=m.get('version',0),words=len(b.split()),links=links,body=b,aliases=m.get('aliases',[])))
  except Exception as e: out.append(dict(path=p,title=p,error=str(e),body='',links=[],tags=[]))
 return out
def render(raw,p):
 m,b=split(raw); b=re.sub(r'\[\[([^\]|]+)(?:\|([^\]]+))?\]\]',lambda x:'<a data-wiki="'+bleach.clean(x[1],tags=[],strip=True).replace('"','&quot;')+'">'+bleach.clean(x[2] or x[1],tags=[],strip=True)+'</a>',b)
 h=bleach.clean(MD(b),tags=set(bleach.sanitizer.ALLOWED_TAGS)|set('p h1 h2 h3 h4 h5 h6 pre div span hr br img table thead tbody tr th td del input video audio source iframe'.split()),attributes={'*':['class','title','alt','data-wiki','controls','playsinline','preload','type','width','height','checked','disabled'],'a':['href','data-wiki'],'img':['src','alt'],'video':['src','controls','preload'],'source':['src','type'],'iframe':[],'span':['style']},css_sanitizer=CSSSanitizer(allowed_css_properties=['color']),strip=True)
 return h
def action(d):
 global ROOT,DATA
 a=d['action']; p=d.get('path','')
 if a=='open':
  r=Path(d['root']).expanduser().resolve(); r=r/'content' if (r/'content').is_dir() else r
  if not (r/'tags.json').is_file():raise ValueError('Select the v9 repository or content directory containing tags.json')
  ROOT=r; DATA=Path.home()/'.knowledge_garden_studio'/__import__('hashlib').sha256(str(r).encode()).hexdigest()[:16]; DATA.mkdir(parents=True,exist_ok=True); atomic(PREF,json.dumps({'root':str(r)})); return str(r)
 if a=='recent':return json.loads(PREF.read_text()) if PREF.exists() else {}
 if ROOT is None:raise ValueError('Open workspace first')
 if a=='list':return dict(notes=catalog(),folders=['']+sorted(x.relative_to(ROOT).as_posix() for x in ROOT.rglob('*') if x.is_dir()),tags=json.loads(read('tags.json')),attachments=sorted(x.relative_to(ROOT).as_posix() for x in ROOT.rglob('*') if x.is_file() and x.suffix.lower()!='.md' and x.relative_to(ROOT).as_posix() not in ('tags.json','index.json','search-index.json')))
 if a=='read_tags':
  tags=split(d['raw'])[0].get('tags',[]);return tags if isinstance(tags,list) else [tags]
 if a=='assign_tags':
  meta,body=split(d['raw']);meta['tags']=d['tags'];return serialize_note(meta,body)
 if a=='media_reference':
  import posixpath
  from urllib.parse import quote
  target=safe(ROOT,d['attachment']);safe(ROOT,p)
  if not target.is_file() or target.suffix.lower()=='.md':raise ValueError('Attachment not found')
  rel=posixpath.relpath(target.relative_to(ROOT).as_posix(),posixpath.dirname(p) or '.')
  typ=mimetypes.guess_type(target.name)[0] or ''
  return dict(url=quote(rel,safe='/'),kind='image' if typ.startswith('image/') else 'video' if typ.startswith('video/') else 'file')
 if a=='read':return read(p)
 if a=='save':return save(p,d['raw'],d.get('expected'))
 if a=='new':
  if not p.endswith('.md') or safe(ROOT,p).exists() or not safe(ROOT,p).parent.is_dir():raise ValueError('Choose an unused .md path')
  template=DATA/'template.md'; raw=template.read_text() if template.exists() else '# {{title}}\n'
  if raw.startswith('---') and not re.match(r'^---\s*\n',raw): raw='# {{title}}\n'
  meta,body=split(raw.replace('{{title}}',d['title'])); meta['title']=d['title']; meta.setdefault('tags',[])
  return save(p,'---\n'+yaml.safe_dump(meta,allow_unicode=True)+'---\n'+body)
 if a=='folder':safe(ROOT,p).mkdir(parents=True,exist_ok=False);return True
 if a=='get_template':
  q=DATA/'template.md'; return q.read_text(encoding='utf8') if q.exists() else '# {{title}}\n'
 if a=='rename_folder':
  import posixpath
  old=safe(ROOT,p); name=d['name'].strip()
  if not p or not old.is_dir() or not name or name in ('.','..') or re.search(r'[\\/:*?"<>|]',name): raise ValueError('Invalid folder name')
  new=old.with_name(name); target=new.relative_to(ROOT).as_posix()
  if new.exists(): raise ValueError('Destination exists')
  for category in ('revisions','drafts'):
   if safe(DATA,category+'/'+target).exists(): raise ValueError('Local history destination exists')
  edits={}
  for note in notes():
   raw=read(note)
   def replace(m):
    link=m[1]; prefix=p+'/'
    if link.lower().startswith(prefix.lower()): return '[['+target+'/'+link[len(prefix):]+m[2]+']]'
    return m[0]
   changed=re.sub(r'\[\[([^|#\]]+)([^\]]*)\]\]',replace,raw)
   # Relative links to moved assets from outside the folder.
   def asset(m):
    from urllib.parse import urlsplit, unquote, quote
    u=urlsplit(m[2]); rel=unquote(u.path)
    if u.scheme or u.netloc or not rel or rel.startswith('/'): return m[0]
    parent=posixpath.dirname(note); dest=posixpath.normpath(posixpath.join(parent,rel))
    if not dest.startswith(p+'/') or note.startswith(p+'/'): return m[0]
    dest=target+dest[len(p):]; value=quote(posixpath.relpath(dest,parent or '.'),safe='/')
    return m[1]+value+('?' + u.query if u.query else '')+('#'+u.fragment if u.fragment else '')+m[3]
   changed=re.sub(r'(\]\(|(?:src|href)=["\'])([^\s)"\']+)([)"\'])',asset,changed)
   if changed!=raw: edits[note]=(raw,changed)
  old.rename(new)
  for category in ('revisions','drafts'):
   src=safe(DATA,category+'/'+p); dst=safe(DATA,category+'/'+target)
   if src.exists(): dst.parent.mkdir(parents=True,exist_ok=True); src.rename(dst)
  for note,(raw,changed) in edits.items():
   dest=target+note[len(p):] if note.startswith(p+'/') else note
   save(dest,changed,raw)
  return target
 if a=='tags':atomic(ROOT/'tags.json',json.dumps(d['tags'],indent=2,ensure_ascii=False));return True
 if a=='render':return render(d['raw'],p)
 if a=='convert':return markdownify(d['html'],heading_style='ATX')
 if a=='media':
  name=Path(d['name']).name; folder=safe(ROOT,str(Path(p).parent/'attachments'));folder.mkdir(exist_ok=True); dest=folder/name;i=1
  while dest.exists():dest=folder/f'{Path(name).stem}_{i}{Path(name).suffix}';i+=1
  dest.write_bytes(base64.b64decode(d['data']));return 'attachments/'+dest.name
 if a=='history':return [x.name for x in sorted(safe(DATA,'revisions/'+p).glob('*.md'),reverse=True)]
 if a=='revision':return safe(DATA,'revisions/'+p+'/'+d['name']).read_text(encoding='utf8')
 if a=='template':atomic(DATA/'template.md',d['raw']);return True
 if a=='delete':
  q=safe(ROOT,p)
  if q.suffix.lower()!='.md' or not q.is_file(): raise ValueError('Select an existing note')
  if read(p)!=d.get('expected'): raise ValueError('Note changed externally; reopen first')
  dest=safe(DATA,'deleted/'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'/'+p); dest.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(q,dest); q.unlink(); return str(dest)
 if a=='archive':
  q=safe(ROOT,p);dest=safe(DATA,'archives/'+p);dest.parent.mkdir(parents=True,exist_ok=True)
  if dest.exists():raise ValueError('Archive already exists')
  shutil.move(q,dest);return True
 if a=='draft':atomic(safe(DATA,'drafts/'+p),d['raw']);return True
 if a=='recover':
  q=safe(DATA,'drafts/'+p);return q.read_text(encoding='utf8') if q.exists() else None
 raise ValueError('Unknown action')
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  try:
   u=urlsplit(self.path); path=unquote(u.path)
   if path=='/': data=Path(__file__).with_name('index.html').read_text().replace('__TOKEN__',TOKEN).encode();typ='text/html; charset=utf-8'
   elif path.startswith('/media/'+TOKEN+'/') and ROOT:
    q=safe(ROOT,path.split('/',3)[3]);data=q.read_bytes();typ=mimetypes.guess_type(q.name)[0] or 'application/octet-stream'
   else: self.send_error(404);return
   self.send_response(200);self.send_header('Content-Type',typ);self.send_header('Content-Length',str(len(data)));self.send_header('X-Content-Type-Options','nosniff');self.send_header('Content-Security-Policy',"sandbox; default-src 'none'" if path.startswith('/media/') else "default-src 'self' 'unsafe-inline' data: https: http:");self.end_headers();self.wfile.write(data)
  except Exception:self.send_error(404)
 def do_POST(self):
  if self.headers.get('X-Studio-Token')!=TOKEN:self.send_error(403);return
  try:
   n=int(self.headers['Content-Length']); result=action(json.loads(self.rfile.read(n)));data=json.dumps({'result':result},default=str).encode()
  except Exception as e:data=json.dumps({'error':str(e)}).encode()
  self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(data)
if __name__=='__main__':
 server=ThreadingHTTPServer(('127.0.0.1',0),Handler);url=f'http://127.0.0.1:{server.server_port}';print('Creator Studio:',url,flush=True);webbrowser.open(url);server.serve_forever()
