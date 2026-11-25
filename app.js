import {renderMarkdown} from "./src/reader.js";
import {applyThemeMode,loadSettings} from "./src/settings.js";
import {SpatialGrid} from "./src/spatial-index.js";
const state={files:[],docs:new Map(),tags:{},settings:{},nodes:[],selected:null,filter:null,expanded:true,scale:1,offset:{x:0,y:0},targetOffset:{x:0,y:0},pointer:null,dragFrame:null,history:[],historyIndex:-1,graphInfoOpen:true};
const $=id=>document.getElementById(id);
const clean=s=>String(s||"").replace(/\\/g,"/").replace(/^\/+/,"").replace(/\.md$/i,"");
const titleFromPath=p=>clean(p).split("/").pop().replace(/[-_]/g," ").replace(/\b\w/g,c=>c.toUpperCase());
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const assetUrl=p=>new URL(p,document.baseURI).toString();
function tagInfo(tag){return state.tags[tag]||{name:tag,color:"#8794a8"};}
function tagsFor(doc){const t=doc.meta.tags||[];return(Array.isArray(t)?t:[t]).map(x=>String(x).replace(/^#/ ,"").trim()).filter(Boolean);}
const body_cache=new Map(), path_lookup=new Map(), title_lookup=new Map();
let reader_request=0, graph_cache=null, graph_frame=null;
async function getDoc(path){
 if(body_cache.has(path)){const body=body_cache.get(path);body_cache.delete(path);body_cache.set(path,body);return body;}
 const response=await fetch(assetUrl("compiled/"+path.split('/').map(encodeURIComponent).join('/')+".html"));if(!response.ok)throw Error(`${response.status} ${path}`);
 const body=await response.text();body_cache.set(path,body);while(body_cache.size>32)body_cache.delete(body_cache.keys().next().value);return body;
}
async function loadIndex(){
 try{const [response,tr]=await Promise.all([fetch(assetUrl("content/index.json")),fetch(assetUrl("content/tags.json"))]);if(!response.ok)throw Error(`Could not load content/index.json (${response.status})`);const index=await response.json();if(tr.ok)state.tags=await tr.json();
 if(!Array.isArray(index.notes))throw Error("Rebuild the Markdown index using npm run build-index.");
 for(const doc of index.notes){state.files.push(doc.path);state.docs.set(doc.path,doc);const key=clean(doc.path).toLowerCase(),title=titleFromPath(doc.path).toLowerCase();if(!path_lookup.has(key))path_lookup.set(key,doc.path);if(!title_lookup.has(title))title_lookup.set(title,doc.path);}
 state.expanded=state.files.length<=500;buildTree();buildTagList();buildGraph();$("note_count").textContent=`${state.docs.size} notes indexed`;if(state.files.length)openDoc(state.files[0]);}
 catch(error){$("graph_summary").textContent=error.message;$("graph_empty").hidden=false;console.error(error);}
}
let search_index=null, search_pending=null;
async function get_search_index(){if(search_index)return search_index;if(!search_pending)search_pending=fetch(assetUrl("content/search-index.json")).then(r=>{if(!r.ok)throw Error("Search index unavailable");return r.json();}).then(rows=>search_index=rows).finally(()=>search_pending=null);return search_pending;}
function update_tree_selection(){const tree=$("file_tree");tree.querySelector('.tree_file.active')?.classList.remove('active');const button=tree.querySelector(`[data-path="${CSS.escape(state.selected||'')}"]`);button?.classList.add('active');}
function buildTree(){const tree=Object.create(null);for(const path of state.files){let n=tree;const parts=clean(path).split("/");parts.forEach((part,i)=>{if(i===parts.length-1)(n.__files||=[]).push({name:part,path});else n=n[part]||=Object.create(null);});}function render(n){let html="";Object.keys(n).filter(k=>k!=="__files").sort().forEach(k=>html+=`<details class="tree_folder" ${state.expanded?"open":""}><summary>${esc(k.replace(/[-_]/g," "))}</summary><div class="tree_children">${render(n[k])}</div></details>`);(n.__files||[]).sort((a,b)=>a.name.localeCompare(b.name)).forEach(f=>{if(state.docs.has(f.path))html+=`<button class="tree_file ${state.selected===f.path?"active":""}" data-path="${esc(f.path)}"><span class="file_icon">▤</span>${esc(titleFromPath(f.path))}</button>`;});return html;}$ ("file_tree").innerHTML=render(tree);$("file_tree").querySelectorAll("[data-path]").forEach(b=>b.onclick=()=>openDoc(b.dataset.path));}
function buildTagList(){const counts=Object.create(null);state.docs.forEach(d=>d.tags.forEach(t=>counts[t]=(counts[t]||0)+1));$("tag_list").innerHTML=Object.keys(counts).sort().map(t=>{const info=tagInfo(t);return `<button class="tag_filter ${state.filter===t?"selected":""}" data-tag="${esc(t)}"><i class="tag_swatch" style="background:${esc(info.color)}"></i>${esc(info.name||t)}<span class="tag_count">${counts[t]}</span></button>`}).join("");$("tag_list").querySelectorAll("[data-tag]").forEach(b=>b.onclick=()=>{state.filter=state.filter===b.dataset.tag?null:b.dataset.tag;buildTagList();buildGraph();});}
function wikiTargets(body){return[...body.matchAll(/!?\[\[([^\]]+)\]\]/g)].map(m=>m[1].split("|")[0].split("#")[0]);}
function resolveWiki(target){const wanted=clean(target).toLowerCase();return path_lookup.get(wanted)||title_lookup.get(wanted.split('/').pop());}
function primary_tag(doc){
 const tags=doc.tags||[];
 const normalize=value=>String(value||'').trim().toLowerCase();
 const folders=clean(doc.path).split('/').slice(0,-1).reverse();
 for(const folder of folders){
  const name=normalize(folder);
  const match=tags.find(tag=>normalize(tag)===name)||tags.find(tag=>normalize(tagInfo(tag).name)===name);
  if(match)return match;
 }
 return tags[0]||'untagged';
}
function makeGraphNodes(width,height){
 const docs=[...state.docs.values()].filter(d=>!state.filter||d.tags.includes(state.filter));
 const groups=new Map();
 for(const doc of docs){const folder=doc.path.split('/').slice(0,-1).join('/');if(!groups.has(folder))groups.set(folder,[]);groups.get(folder).push(doc);}
 const folders=[...groups.keys()].sort(),nodes=[],cx=width/2,cy=height/2;
 const spread_for=n=>n===1?0:Math.max(48,Math.sqrt(n)*25);
 const max_spread=Math.max(0,...folders.map(f=>spread_for(groups.get(f).length)));
 const outer=folders.length<=1?0:Math.max(Math.min(width,height)*.31,(2*max_spread+100)/(2*Math.sin(Math.PI/folders.length)));
 folders.forEach((folder,gi)=>{const angle=gi/folders.length*Math.PI*2-Math.PI/2,gx=cx+Math.cos(angle)*outer,gy=cy+Math.sin(angle)*outer,items=groups.get(folder),spread=spread_for(items.length);
 items.forEach((doc,i)=>{const a=i*2.399963229728653,rad=items.length===1?0:spread*Math.sqrt((i+.5)/items.length),tag=primary_tag(doc);nodes.push({doc,folder,tag,color:tagInfo(tag).color,x:gx+Math.cos(a)*rad,y:gy+Math.sin(a)*rad,r:doc.path===state.selected?7:5.5});});});return nodes;
}
function graphPoint(n,w,h){return{x:(n.x-w/2)*state.scale+w/2+state.offset.x,y:(n.y-h/2)*state.scale+h/2+state.offset.y};}
function buildGraph(){if(graph_frame===null)graph_frame=requestAnimationFrame(()=>{graph_frame=null;draw_graph();});}
function draw_graph(){
 const canvas=$("graph_canvas"),rect=$("graph_stage").getBoundingClientRect(),w=rect.width,h=rect.height;if(!w||!h)return;
 const dpr=Math.min(window.devicePixelRatio||1,state.docs.size>1000?1.5:2);const pw=Math.round(w*dpr),ph=Math.round(h*dpr);if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;}
 const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
 if(!graph_cache||graph_cache.w!==w||graph_cache.h!==h||graph_cache.filter!==state.filter||graph_cache.count!==state.docs.size){
 const nodes=makeGraphNodes(w,h),by_path=new Map(nodes.map(n=>[n.doc.path,n])),groups=new Map(),edges=[],seen=new Set();
 for(const n of nodes){let group=groups.get(n.folder);if(!group)groups.set(n.folder,group={items:[],x:0,y:0});group.items.push(n);group.x+=n.x;group.y+=n.y;for(const target of n.doc.links||[]){const other=by_path.get(resolveWiki(target));if(!other||other===n)continue;const key=JSON.stringify([n.doc.path,other.doc.path].sort());if(seen.has(key))continue;seen.add(key);edges.push([n,other]);}}
 const tag_groups=new Map();for(const n of nodes)for(const tag of new Set(n.doc.tags)){if(!tag_groups.has(tag))tag_groups.set(tag,[]);tag_groups.get(tag).push(n);}
 const tag_edges=[];for(const [tag,items] of tag_groups){for(let i=1;i<items.length;i++)tag_edges.push([items[i-1],items[i],tagInfo(tag).color]);}
 for(const group of groups.values()){group.x/=group.items.length;group.y/=group.items.length;}
 graph_cache={w,h,filter:state.filter,count:state.docs.size,nodes,groups,edges,tag_edges,grid:new SpatialGrid(nodes)};state.nodes=nodes;
 $("graph_empty").hidden=nodes.length>0;$("graph_summary").textContent=`Showing ${nodes.length} of ${state.docs.size} notes · ${groups.size} folder clusters`;
 }
 const {nodes,groups,edges,tag_edges}=graph_cache,large=nodes.length>500,style=getComputedStyle(document.documentElement),text=style.getPropertyValue('--text').trim(),panel=style.getPropertyValue('--panel').trim();
 const visible=p=>p.x>=-140&&p.x<=w+140&&p.y>=-40&&p.y<=h+40;
 const point=n=>graphPoint(n,w,h); const world=(x,y)=>({x:(x-w/2-state.offset.x)/state.scale+w/2,y:(y-h/2-state.offset.y)/state.scale+h/2});const lo=world(-140,-40),hi=world(w+140,h+40);const visible_nodes=graph_cache.grid.query(lo.x,lo.y,hi.x,hi.y);
 const batches=new Map();function line(a,b,color){if(Math.max(a.x,b.x)<0||Math.min(a.x,b.x)>w||Math.max(a.y,b.y)<0||Math.min(a.y,b.y)>h)return;let list=batches.get(color);if(!list)batches.set(color,list=[]);list.push([a,b]);}
 function stroke(alpha){ctx.globalAlpha=alpha;ctx.lineWidth=1;for(const [color,lines] of batches){ctx.beginPath();for(const [a,b] of lines){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}ctx.strokeStyle=color;ctx.stroke();}batches.clear();ctx.globalAlpha=1;}
 for(const [a,b,color] of tag_edges)if(!large||state.scale>=1.5||a.doc.path===state.selected||b.doc.path===state.selected)line(point(a),point(b),color);stroke(.18);
 for(const [a,b] of edges)if(!large||state.scale>=1.5||a.doc.path===state.selected||b.doc.path===state.selected)line(point(a),point(b),a.color);stroke(.43);
 if(!large){for(const [tag,g] of groups)if(g.items.length>1){const center=graphPoint(g,w,h);for(const n of g.items)line(point(n),center,n.color);}stroke(.10);}
 const occupied=new Set();ctx.textAlign='center';ctx.textBaseline='top';
 for(const n of visible_nodes){const p=point(n);if(!visible(p))continue;const selected=n.doc.path===state.selected,r=selected?10:large?3.5:5.5;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=n.color;ctx.globalAlpha=selected?1:.88;if(!large||selected){ctx.shadowColor=n.color;ctx.shadowBlur=selected?18:9;}ctx.fill();ctx.shadowBlur=0;ctx.globalAlpha=1;if(selected){ctx.beginPath();ctx.arc(p.x,p.y,13,0,Math.PI*2);ctx.strokeStyle=n.color;ctx.stroke();}
 const cell=`${Math.floor(p.x/135)},${Math.floor(p.y/24)}`;if(selected||!large||(state.scale>=1.2&&!occupied.has(cell))){occupied.add(cell);ctx.font=`${selected?600:400} ${Number(state.settings.appearance?.graph_label_size||10)}px system-ui`;ctx.fillStyle=text;ctx.fillText(n.doc.title.length>24?n.doc.title.slice(0,22)+'…':n.doc.title,p.x,p.y+r+7,130);}}
 for(const [tag,g] of groups){const pt=graphPoint(g,w,h);if(!visible(pt))continue;const label=tag||"Content root";ctx.font=`700 ${Number(state.settings.appearance?.cluster_label_size||12)}px system-ui`;const tw=ctx.measureText(label).width;ctx.fillStyle=panel;ctx.globalAlpha=.94;ctx.beginPath();ctx.roundRect(pt.x+5,pt.y-25,tw+16,21,5);ctx.fill();ctx.globalAlpha=1;ctx.fillStyle=text;ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(label,pt.x+13,pt.y-14);}
}
function updateHistoryControls(){$("history_back").disabled=state.historyIndex<=0;$ ("history_forward").disabled=state.historyIndex<0||state.historyIndex>=state.history.length-1;}
async function openDoc(path,options={}){const doc=state.docs.get(path);if(!doc)return;const record=options.history!==false;if(record){if(state.history[state.historyIndex]!==path){state.history=state.history.slice(0,state.historyIndex+1);state.history.push(path);state.historyIndex=state.history.length-1;}}state.selected=path;const request=++reader_request;update_tree_selection();buildGraph();updateHistoryControls();$("reader_location").textContent=path.split("/").slice(0,-1).join(" / ")||"LIBRARY";$("document").textContent="Loading note…";let body;try{body=await getDoc(path);}catch(error){if(request===reader_request)$("document").textContent=error.message;return;}if(request!==reader_request)return;$("document").innerHTML=renderMarkdown(body,doc,state.settings);$("document").querySelectorAll("[data-wiki]").forEach(a=>a.onclick=e=>{e.preventDefault();openDoc(a.dataset.wiki);});$("document").querySelectorAll(".note_image").forEach(img=>img.addEventListener('click',()=>openLightbox(img.src,img.alt)));$("reader_meta").innerHTML=doc.tags.map(t=>{const info=tagInfo(t);return `<span class="meta_tag"><i style="background:${esc(info.color)}"></i>${esc(info.name||t)}</span>`}).join("");$("document").scrollTop=0;updateHistoryControls();}
function openLightbox(src,alt){if(state.settings.media?.image_lightbox===false)return;const layer=document.createElement('div');layer.className='image_lightbox';layer.innerHTML=`<button class="lightbox_close" aria-label="Close image">×</button><img src="${esc(src)}" alt="${esc(alt)}">`;const close=()=>{layer.remove();document.removeEventListener('keydown',onKey);};const onKey=e=>{if(e.key==='Escape')close();};layer.addEventListener('click',close);document.addEventListener('keydown',onKey);document.body.append(layer);layer.querySelector('button').focus();}
function navigateHistory(direction){const next=state.historyIndex+direction;if(next<0||next>=state.history.length)return;state.historyIndex=next;openDoc(state.history[next],{history:false});}
function fitGraph(){if(state.dragFrame!==null){cancelAnimationFrame(state.dragFrame);state.dragFrame=null;}state.scale=1;state.offset={x:0,y:0};state.targetOffset={x:0,y:0};buildGraph();}
function animateDrag(){if(state.settings.appearance?.motion_enabled===false||matchMedia("(prefers-reduced-motion: reduce)").matches){state.offset={...state.targetOffset};buildGraph();return;}if(state.dragFrame!==null)return;const tick=()=>{const dx=state.targetOffset.x-state.offset.x,dy=state.targetOffset.y-state.offset.y;state.offset.x+=dx*.24;state.offset.y+=dy*.24;buildGraph();if(Math.abs(dx)+Math.abs(dy)>.25){state.dragFrame=requestAnimationFrame(tick);}else{state.offset={...state.targetOffset};state.dragFrame=null;buildGraph();}};state.dragFrame=requestAnimationFrame(tick);}
function eventGraphPos(e){const r=$("graph_canvas").getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
const canvas=$("graph_canvas");
const active_pointers=new Map();
let pinch=null;
function stop_drag(){if(state.dragFrame!==null){cancelAnimationFrame(state.dragFrame);state.dragFrame=null;}state.targetOffset={...state.offset};}
function pinch_geometry(){const [a,b]=active_pointers.values();return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};}
function start_pinch(){stop_drag();state.pointer=null;const g=pinch_geometry();pinch={...g,scale:state.scale,offset:{...state.offset}};}
canvas.addEventListener("pointerdown",e=>{
 if(e.pointerType==="mouse"&&e.button!==0)return;
 if(active_pointers.size>=2)return;
 const p=eventGraphPos(e);active_pointers.set(e.pointerId,p);canvas.setPointerCapture(e.pointerId);canvas.classList.add("dragging");
 if(active_pointers.size===2){start_pinch();return;}
 stop_drag();state.pointer={start:p,origin:{...state.offset},moved:false};
});
canvas.addEventListener("pointermove",e=>{
 if(!active_pointers.has(e.pointerId))return;
 const p=eventGraphPos(e);active_pointers.set(e.pointerId,p);
 if(pinch&&active_pointers.size===2){const g=pinch_geometry(),w=canvas.clientWidth,h=canvas.clientHeight,next=Math.max(.35,Math.min(3.5,pinch.scale*g.distance/pinch.distance)),ratio=next/pinch.scale;
 state.scale=next;state.offset={x:g.x-w/2-(pinch.x-w/2-pinch.offset.x)*ratio,y:g.y-h/2-(pinch.y-h/2-pinch.offset.y)*ratio};state.targetOffset={...state.offset};buildGraph();return;}
 if(!state.pointer)return;const dx=p.x-state.pointer.start.x,dy=p.y-state.pointer.start.y;if(Math.hypot(dx,dy)>3)state.pointer.moved=true;if(state.pointer.moved){state.targetOffset={x:state.pointer.origin.x+dx,y:state.pointer.origin.y+dy};animateDrag();}
});
function end_pointer(e,cancelled=false){
 if(!active_pointers.has(e.pointerId))return;
 active_pointers.delete(e.pointerId);
 if(pinch){pinch=null;stop_drag();if(active_pointers.size===1){const p=active_pointers.values().next().value;state.pointer={start:p,origin:{...state.offset},moved:true};return;}}
 const was_drag=state.pointer?.moved,can_tap=state.pointer&&!was_drag&&!cancelled;state.pointer=null;canvas.classList.remove("dragging");
 if(!can_tap)return;
 const p=eventGraphPos(e),r=canvas.getBoundingClientRect(),x=(p.x-r.width/2-state.offset.x)/state.scale+r.width/2,y=(p.y-r.height/2-state.offset.y)/state.scale+r.height/2;let hit=null,best=Infinity;(graph_cache?.grid.query(x-20,y-20,x+20,y+20)||[]).forEach(n=>{const d=Math.hypot(n.x-x,n.y-y);if(d<Math.max(15,n.r+7)&&d<best){best=d;hit=n;}});if(hit)openDoc(hit.doc.path);
}
canvas.addEventListener("pointerup",e=>end_pointer(e));
canvas.addEventListener("pointercancel",e=>end_pointer(e,true));
canvas.addEventListener("lostpointercapture",e=>end_pointer(e,true));
canvas.addEventListener("wheel",e=>{e.preventDefault();const p=eventGraphPos(e),old=state.scale,next=Math.max(.35,Math.min(3.5,old*(e.deltaY<0?1.12:.89))),w=canvas.clientWidth,h=canvas.clientHeight,gx=(p.x-w/2-state.offset.x)/old+w/2,gy=(p.y-h/2-state.offset.y)/old+h/2;state.scale=next;state.offset={x:p.x-(gx-w/2)*next-w/2,y:p.y-(gy-h/2)*next-h/2};state.targetOffset={...state.offset};buildGraph();},{passive:false});
$("zoom_in").onclick=()=>{state.scale=Math.min(3.5,state.scale*1.2);buildGraph();};$("zoom_out").onclick=()=>{state.scale=Math.max(.35,state.scale/1.2);buildGraph();};$("zoom_fit").onclick=fitGraph;$("graph_reset").onclick=fitGraph;$("theme_toggle").onclick=()=>{applyThemeMode(state,state.currentTheme==="light"?"dark":"light");buildGraph();};$("mobile_menu").onclick=()=>$ ("sidebar").classList.toggle("open");$("expand_all").onclick=()=>{state.expanded=!state.expanded;buildTree();};$("close_reader").onclick=()=>{$("document").innerHTML='<div class="reader_welcome"><div class="reader_icon">↗</div><h2>Select a thought</h2><p>Choose a dot or a note from the library.</p></div>';$ ("reader_meta").innerHTML="";state.selected=null;++reader_request;update_tree_selection();buildGraph();};$("history_back").onclick=()=>navigateHistory(-1);$("history_forward").onclick=()=>navigateHistory(1);
$("toggle_graph_info").onclick=()=>{state.graphInfoOpen=!state.graphInfoOpen;$("graph_header").classList.toggle("collapsed",!state.graphInfoOpen);$("toggle_graph_info").setAttribute("aria-expanded",String(state.graphInfoOpen));$("toggle_graph_info").innerHTML=state.graphInfoOpen?'Hide info <span>⌃</span>':'Show info <span>⌄</span>';requestAnimationFrame(buildGraph);};
$("search").addEventListener("input",async e=>{const q=e.target.value.trim().toLowerCase();let box=document.querySelector(".search_results");if(!q){box?.remove();return;}if(!box){box=document.createElement("div");box.className="search_results";document.querySelector(".topbar").append(box);}box.textContent="Searching…";let rows;try{rows=await get_search_index();}catch(error){if(box.isConnected)box.textContent=error.message;return;}if(!box.isConnected||$("search").value.trim().toLowerCase()!==q)return;const matches=[];for(const [path,text] of rows){if(text.includes(q)){matches.push(state.docs.get(path));if(matches.length===30)break;}}box.innerHTML=matches.map(d=>`<a class="search_result" href="#" data-result="${esc(d.path)}">${esc(d.title)}<small>${esc(d.path)}</small></a>`).join("")||'<div class="search_result">No matching notes</div>';box.querySelectorAll("[data-result]").forEach(a=>a.onclick=e=>{e.preventDefault();openDoc(a.dataset.result);box.remove();$("search").value="";$("sidebar").classList.remove("open");});});
function playIntro(){const intro=$("intro_screen");if(!intro)return;if(window.matchMedia('(prefers-reduced-motion: reduce)').matches||state.settings.appearance?.motion_enabled===false){intro.remove();return;}const duration=Number(state.settings.appearance?.intro_duration_ms||1500);intro.style.setProperty('--intro-duration',`${duration}ms`);window.setTimeout(()=>{intro.classList.add('intro_done');window.setTimeout(()=>intro.remove(),700);},Math.max(450,duration));}
new ResizeObserver(buildGraph).observe($("graph_stage"));window.addEventListener("resize",buildGraph);(async()=>{await loadSettings(state);playIntro();await loadIndex();})();
