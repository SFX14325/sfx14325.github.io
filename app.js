const state={files:[],docs:new Map(),tags:{},nodes:[],selected:null,filter:null,expanded:true,scale:1,offset:{x:0,y:0},pointer:null};
const $=id=>document.getElementById(id);
const clean=s=>String(s||"").replace(/\\/g,"/").replace(/^\/+/,"").replace(/\.md$/i,"");
const titleFromPath=p=>clean(p).split("/").pop().replace(/[-_]/g," ").replace(/\b\w/g,c=>c.toUpperCase());
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const assetUrl=p=>new URL(p,document.baseURI).toString();
function parseFrontmatter(raw){
 const m=raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);if(!m)return{body:raw,meta:{}};
 const meta={};let active="";
 for(const line of m[1].split("\n")){const x=line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
  if(x){active=x[1];meta[active]=x[2].trim();if(!meta[active])meta[active]=[];}
  else if(active&&/^\s+-\s*/.test(line)&&Array.isArray(meta[active]))meta[active].push(line.replace(/^\s+-\s*/,"").trim());
 }
 if(typeof meta.tags==="string")meta.tags=meta.tags.replace(/^\[|\]$/g,"").split(",").map(x=>x.trim().replace(/^["']|["']$/g,"")).filter(Boolean);
 return{body:raw.slice(m[0].length),meta};
}
function tagInfo(tag){return state.tags[tag]||{name:tag,color:"#8794a8"};}
function tagsFor(doc){const t=doc.meta.tags||[];return(Array.isArray(t)?t:[t]).map(x=>String(x).replace(/^#/,"").trim()).filter(Boolean);}
async function getDoc(path){
 if(state.docs.has(path))return state.docs.get(path);
 const response=await fetch(assetUrl("content/"+path));if(!response.ok)throw Error(`${response.status} ${path}`);
 const parsed=parseFrontmatter(await response.text()),doc={...parsed,path,title:parsed.meta.title||titleFromPath(path),tags:tagsFor(parsed)};
 state.docs.set(path,doc);return doc;
}
async function loadIndex(){
 try{
  const response=await fetch(assetUrl("content/index.json"));if(!response.ok)throw Error(`Could not load content/index.json (${response.status})`);
  state.files=await response.json();
  const tr=await fetch(assetUrl("content/tags.json"));if(tr.ok)state.tags=await tr.json();
  const results=await Promise.allSettled(state.files.map(getDoc));
  const failures=results.map((r,i)=>r.status==="rejected"?`${state.files[i]}: ${r.reason.message}`:null).filter(Boolean);
  buildTree();buildTagList();buildGraph();
  $("note_count").textContent=`${state.docs.size} notes loaded`;
  if(state.files.length&&state.docs.size)openDoc(state.files.find(p=>state.docs.has(p)));
  if(failures.length){$("graph_summary").textContent=`Loaded ${state.docs.size}/${state.files.length} notes. ${failures.length} file(s) failed; check paths and filename capitalization.`;console.warn("Markdown load failures:",failures);}
 }catch(error){$("graph_summary").textContent=error.message;$("graph_empty").hidden=false;console.error(error);}
}
function buildTree(){
 const tree={};for(const path of state.files){let n=tree;const parts=clean(path).split("/");parts.forEach((part,i)=>{if(i===parts.length-1)(n.__files||=[]).push({name:part,path});else n=n[part]||=( {} );});}
 function render(n){let html="";Object.keys(n).filter(k=>k!=="__files").sort().forEach(k=>html+=`<details class="tree_folder" ${state.expanded?"open":""}><summary>${esc(k.replace(/[-_]/g," "))}</summary><div class="tree_children">${render(n[k])}</div></details>`);
  (n.__files||[]).sort((a,b)=>a.name.localeCompare(b.name)).forEach(f=>{if(state.docs.has(f.path))html+=`<button class="tree_file ${state.selected===f.path?"active":""}" data-path="${esc(f.path)}"><span class="file_icon">▤</span>${esc(titleFromPath(f.path))}</button>`;});return html;}
 $("file_tree").innerHTML=render(tree);$("file_tree").querySelectorAll("[data-path]").forEach(b=>b.onclick=()=>openDoc(b.dataset.path));
}
function buildTagList(){
 const counts={};state.docs.forEach(d=>d.tags.forEach(t=>counts[t]=(counts[t]||0)+1));
 $("tag_list").innerHTML=Object.keys(counts).sort().map(t=>{const info=tagInfo(t);return `<button class="tag_filter ${state.filter===t?"selected":""}" data-tag="${esc(t)}"><i class="tag_swatch" style="background:${esc(info.color)}"></i>${esc(info.name||t)}<span class="tag_count">${counts[t]}</span></button>`}).join("");
 $("tag_list").querySelectorAll("[data-tag]").forEach(b=>b.onclick=()=>{state.filter=state.filter===b.dataset.tag?null:b.dataset.tag;buildTagList();buildGraph();});
}
function wikiTargets(body){return[...body.matchAll(/!?\[\[([^\]]+)\]\]/g)].map(m=>m[1].split("|")[0].split("#")[0]);}
function resolveWiki(target){const wanted=clean(target).toLowerCase();return state.files.find(p=>clean(p).toLowerCase()===wanted)||state.files.find(p=>titleFromPath(p).toLowerCase()===wanted.split("/").pop());}
function makeGraphNodes(width,height){
 const docs=[...state.docs.values()].filter(d=>!state.filter||d.tags.includes(state.filter));
 const groups={};docs.forEach(d=>{const primary=d.tags[0]||"untagged";(groups[primary]||=[]).push(d);});
 const tags=Object.keys(groups).sort(),cx=width/2,cy=height/2,outer=Math.min(width,height)*.31,nodes=[];
 tags.forEach((tag,gi)=>{
  const angle=(gi/Math.max(tags.length,1))*Math.PI*2-Math.PI/2,centerRadius=tags.length===1?0:outer,gx=cx+Math.cos(angle)*centerRadius,gy=cy+Math.sin(angle)*centerRadius;
  const items=groups[tag],spread=Math.min(125,Math.max(48,Math.sqrt(items.length)*25));
  items.forEach((doc,i)=>{const a=i*2.399963229728653,rad=items.length===1?0:spread*Math.sqrt((i+.5)/items.length);nodes.push({doc,tag,color:tagInfo(tag).color,x:gx+Math.cos(a)*rad,y:gy+Math.sin(a)*rad,r:doc.path===state.selected?7:5.5});});
 });
 return nodes;
}
function graphPoint(n,w,h){return{x:(n.x-w/2)*state.scale+w/2+state.offset.x,y:(n.y-h/2)*state.scale+h/2+state.offset.y};}
function buildGraph(){
 const canvas=$("graph_canvas"),stage=$("graph_stage"),rect=stage.getBoundingClientRect(),w=rect.width,h=rect.height;if(!w||!h)return;
 const dpr=window.devicePixelRatio||1;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
 const ctx=canvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 state.nodes=makeGraphNodes(w,h);const byPath=new Map(state.nodes.map(n=>[n.doc.path,n]));
 ctx.lineWidth=1;const drawn=new Set();
 state.nodes.forEach(n=>wikiTargets(n.doc.body).forEach(t=>{const p=resolveWiki(t),other=byPath.get(p);if(!other||other===n)return;const key=[n.doc.path,p].sort().join("|");if(drawn.has(key))return;drawn.add(key);const a=graphPoint(n,w,h),b=graphPoint(other,w,h);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=n.color;ctx.globalAlpha=.43;ctx.stroke();}));
 const groups={};state.nodes.forEach(n=>(groups[n.tag]||=[]).push(n));
 Object.entries(groups).forEach(([tag,items])=>{if(items.length<2)return;const center=items.reduce((p,n)=>({x:p.x+n.x/items.length,y:p.y+n.y/items.length}),{x:0,y:0});items.forEach(n=>{const a=graphPoint(n,w,h),b=graphPoint(center,w,h);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=tagInfo(tag).color;ctx.globalAlpha=.10;ctx.stroke();});});
 ctx.globalAlpha=1;
 Object.entries(groups).forEach(([tag,items])=>{const c=items.reduce((p,n)=>({x:p.x+n.x/items.length,y:p.y+n.y/items.length}),{x:0,y:0}),pt=graphPoint(c,w,h);ctx.font="10px system-ui";ctx.fillStyle=tagInfo(tag).color;ctx.globalAlpha=.85;ctx.fillText(tagInfo(tag).name||tag,pt.x+12,pt.y-12);});
 state.nodes.forEach(n=>{const p=graphPoint(n,w,h),selected=n.doc.path===state.selected;ctx.beginPath();ctx.arc(p.x,p.y,n.r+(selected?3:0),0,Math.PI*2);ctx.fillStyle=n.color;ctx.globalAlpha=selected?1:.88;ctx.shadowColor=n.color;ctx.shadowBlur=selected?18:9;ctx.fill();ctx.shadowBlur=0;ctx.globalAlpha=1;if(selected){ctx.beginPath();ctx.arc(p.x,p.y,13,0,Math.PI*2);ctx.strokeStyle=n.color;ctx.globalAlpha=.65;ctx.lineWidth=1;ctx.stroke();ctx.globalAlpha=1;}});
 $("graph_empty").hidden=state.nodes.length>0;
 $("graph_summary").textContent=`Showing ${state.nodes.length} of ${state.docs.size} notes${state.filter?" · filtered by "+(tagInfo(state.filter).name||state.filter):""} · ${Object.keys(groups).length} clusters`;
}
function markdownHtml(body){
 const text=body.replace(/!?\[\[([^\]]+)\]\]/g,(whole,inside)=>{const [target,label]=inside.split("|");if(/\.(png|jpe?g|gif|svg|webp)$/i.test(target))return`<img src="${esc(assetUrl("content/"+target.replace(/^\/+/,"")))}" alt="${esc(label||target)}">`;const path=resolveWiki(target);return path?`<a class="wikilink" href="#" data-wiki="${esc(path)}">${esc(label||titleFromPath(path))}</a>`:`<span title="Note not found">${esc(label||target)}</span>`;});
 return window.marked?marked.parse(text):`<pre>${esc(text)}</pre>`;
}
function openDoc(path){
 const doc=state.docs.get(path);if(!doc)return;state.selected=path;buildTree();buildGraph();
 $("reader_location").textContent=path.split("/").slice(0,-1).join(" / ")||"LIBRARY";
 $("document").innerHTML=markdownHtml(doc.body);
 $("document").querySelectorAll("[data-wiki]").forEach(a=>a.onclick=e=>{e.preventDefault();openDoc(a.dataset.wiki);});
 $("reader_meta").innerHTML=doc.tags.map(t=>{const info=tagInfo(t);return`<span class="meta_tag"><i style="background:${esc(info.color)}"></i>${esc(info.name||t)}</span>`}).join("");
 $("document").scrollTop=0;
}
function fitGraph(){state.scale=1;state.offset={x:0,y:0};buildGraph();}
function eventGraphPos(e){const r=$("graph_canvas").getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
const canvas=$("graph_canvas");
canvas.addEventListener("pointerdown",e=>{const p=eventGraphPos(e);state.pointer={start:p,origin:{...state.offset},moved:false};canvas.setPointerCapture(e.pointerId);canvas.classList.add("dragging");});
canvas.addEventListener("pointermove",e=>{if(!state.pointer)return;const p=eventGraphPos(e),dx=p.x-state.pointer.start.x,dy=p.y-state.pointer.start.y;if(Math.hypot(dx,dy)>3)state.pointer.moved=true;if(state.pointer.moved){state.offset={x:state.pointer.origin.x+dx,y:state.pointer.origin.y+dy};buildGraph();}});
canvas.addEventListener("pointerup",e=>{if(!state.pointer)return;const p=eventGraphPos(e),wasDrag=state.pointer.moved;state.pointer=null;canvas.classList.remove("dragging");if(!wasDrag){const r=canvas.getBoundingClientRect(),x=(p.x-r.width/2-state.offset.x)/state.scale+r.width/2,y=(p.y-r.height/2-state.offset.y)/state.scale+r.height/2;let hit=null,best=Infinity;state.nodes.forEach(n=>{const d=Math.hypot(n.x-x,n.y-y);if(d<Math.max(15,n.r+7)&&d<best){best=d;hit=n;}});if(hit)openDoc(hit.doc.path);}});
canvas.addEventListener("pointercancel",()=>{state.pointer=null;canvas.classList.remove("dragging");});
canvas.addEventListener("wheel",e=>{e.preventDefault();const p=eventGraphPos(e),old=state.scale,next=Math.max(.35,Math.min(3.5,old*(e.deltaY<0?1.12:.89))),w=canvas.clientWidth,h=canvas.clientHeight;const gx=(p.x-w/2-state.offset.x)/old+w/2,gy=(p.y-h/2-state.offset.y)/old+h/2;state.scale=next;state.offset={x:p.x-(gx-w/2)*next-w/2,y:p.y-(gy-h/2)*next-h/2};buildGraph();},{passive:false});
$("zoom_in").onclick=()=>{state.scale=Math.min(3.5,state.scale*1.2);buildGraph();};
$("zoom_out").onclick=()=>{state.scale=Math.max(.35,state.scale/1.2);buildGraph();};
$("zoom_fit").onclick=fitGraph;$("graph_reset").onclick=fitGraph;
$("theme_toggle").onclick=()=>{document.documentElement.classList.toggle("light");buildGraph();};
$("mobile_menu").onclick=()=>$("sidebar").classList.toggle("open");
$("expand_all").onclick=()=>{state.expanded=!state.expanded;buildTree();};
$("close_reader").onclick=()=>{$("document").innerHTML='<div class="reader_welcome"><div class="reader_icon">↗</div><h2>Select a thought</h2><p>Choose a dot or a note from the library.</p></div>';$("reader_meta").innerHTML="";state.selected=null;buildTree();buildGraph();};
$("search").addEventListener("input",e=>{const q=e.target.value.trim().toLowerCase();let box=document.querySelector(".search_results");if(!q){box?.remove();return;}if(!box){box=document.createElement("div");box.className="search_results";document.querySelector(".topbar").append(box);}const matches=[...state.docs.values()].filter(d=>(d.title+" "+d.path+" "+d.body+" "+d.tags.join(" ")).toLowerCase().includes(q)).slice(0,30);box.innerHTML=matches.map(d=>`<a class="search_result" href="#" data-result="${esc(d.path)}">${esc(d.title)}<small>${esc(d.path)}</small></a>`).join("")||'<div class="search_result">No matching notes</div>';box.querySelectorAll("[data-result]").forEach(a=>a.onclick=e=>{e.preventDefault();openDoc(a.dataset.result);box.remove();$("search").value="";$("sidebar").classList.remove("open");});});
window.addEventListener("resize",buildGraph);loadIndex();
