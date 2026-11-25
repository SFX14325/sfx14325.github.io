const clean=s=>String(s||"").replace(/\\/g,"/").replace(/^\/+/,"").replace(/\.md$/i,"");
const titleFromPath=p=>clean(p).split("/").pop().replace(/[-_]/g," ").replace(/\b\w/g,c=>c.toUpperCase());
function parseFrontmatter(raw){
 const m=raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);if(!m)return{body:raw,meta:{}};
 const meta={};let active="";
 for(const line of m[1].split("\n")){const x=line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);if(x){active=x[1];meta[active]=x[2].trim();if(!meta[active])meta[active]=[];}else if(active&&/^\s+-\s*/.test(line)&&Array.isArray(meta[active]))meta[active].push(line.replace(/^\s+-\s*/,"").trim());}
 if(typeof meta.tags==="string")meta.tags=meta.tags.replace(/^\[|\]$/g,"").split(",").map(x=>x.trim().replace(/^['"]|['"]$/g,"")).filter(Boolean);
 return{body:raw.slice(m[0].length),meta};
}
function tagsFor(doc){const t=doc.meta.tags||[];return(Array.isArray(t)?t:[t]).map(x=>String(x).replace(/^#/ ,"").trim()).filter(Boolean);}
function wikiTargets(body){return[...body.matchAll(/!?\[\[([^\]]+)\]\]/g)].map(m=>m[1].split("|")[0].split("#")[0]);}
export {parseFrontmatter,tagsFor,wikiTargets,titleFromPath};
