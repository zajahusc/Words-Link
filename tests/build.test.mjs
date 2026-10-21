import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('public build excludes secrets, backend and admin tools even when secret environment variables are set',async()=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 execFileSync(process.execPath,['scripts/build.mjs'],{cwd:root,env:{...process.env,MERRIAM_WEBSTER_API_KEY:'synthetic-build-secret-key',WORDS_LINK_ADMIN_TOKEN:'synthetic-build-secret-admin'},stdio:'pipe'});
 const walk=async(dir)=>{let result=[];for(const entry of await readdir(dir,{withFileTypes:true})){const url=new URL(entry.name+(entry.isDirectory()?'/':''),dir);result.push(...(entry.isDirectory()?await walk(url):[url]));}return result;};
 const files=await walk(new URL('../dist/',import.meta.url));
 for(const file of files){
  assert.ok(!/\/(server|netlify|tests|scripts|\.private|node_modules)\//.test(file.pathname));assert.ok(!file.pathname.includes('.env'));
  const text=await readFile(file,'utf8');assert.ok(!text.includes('synthetic-build-secret-key'));assert.ok(!text.includes('synthetic-build-secret-admin'));
 }
 assert.ok(files.some(file=>file.pathname.endsWith('/dictionary-client.js')));
});
