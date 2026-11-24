import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("content");
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(path.relative(root, full).split(path.sep).join("/"));
    }
  }
}
await walk(root);
files.sort((a,b)=>a.localeCompare(b));
await writeFile(path.join(root, "index.json"), JSON.stringify(files, null, 2) + "\n");
console.log(`Indexed ${files.length} Markdown files.`);
