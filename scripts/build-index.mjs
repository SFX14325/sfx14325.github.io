import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {parseFrontmatter,tagsFor,wikiTargets,titleFromPath} from './note-metadata.mjs';
const root=path.resolve('content'),files=[];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())await walk(full);else if(entry.isFile()&&/\.md$/i.test(entry.name))files.push(path.relative(root,full).split(path.sep).join('/'));}}
await walk(root);files.sort((a,b)=>a.localeCompare(b));const notes=[],search=[];
for(const file of files){const parsed=parseFrontmatter(await readFile(path.join(root,file),'utf8')),title=parsed.meta.title||titleFromPath(file),tags=tagsFor(parsed);notes.push({path:file,title,tags,links:[...new Set(wikiTargets(parsed.body))]});search.push([file,[title,file,parsed.body,...tags].join(' ').toLowerCase()]);}
await writeFile(path.join(root,'index.json'),JSON.stringify({version:2,notes}));await writeFile(path.join(root,'search-index.json'),JSON.stringify(search));console.log(`Indexed ${notes.length} Markdown files.`);
