import {mkdir, rm, copyFile, cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
const output=new URL('dist/',root);
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
// Explicit allowlist: no environment files, server source, private data or dependencies.
for(const name of ['index.html','styles.css','app.js','engine.js','dictionary-client.js','sw.js','icon.svg','manifest.webmanifest','CNAME']) {
 await copyFile(new URL(name,root),new URL(name,output));
}
await cp(new URL('data/',root),new URL('data/',output),{recursive:true});
console.log(`Built public assets in ${fileURLToPath(output)} (server secrets are excluded).`);
