import {mkdir,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
// Local development storage only. Netlify uses its durable, strongly consistent Blobs store.
export function localStore(directory=new URL('../.private/blobs/',import.meta.url)){
 let pending=Promise.resolve();
 const file=key=>new URL(encodeURIComponent(key)+'.json',directory);
 const load=async key=>{try{return JSON.parse(await readFile(file(key),'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}};
 return {
  async get(key){return (await load(key))?.data??null;},
  async getWithMetadata(key){const entry=await load(key);return entry?{...entry,metadata:{}}:null;},
  async setJSON(key,data,options={}){
   const task=pending.then(async()=>{
    await mkdir(directory,{recursive:true,mode:0o700});
    const previous=await load(key);
    if(options.onlyIfNew&&previous||options.onlyIfMatch&&previous?.etag!==options.onlyIfMatch)return {modified:false};
    const etag=createHash('sha256').update(JSON.stringify(data)).digest('hex');
    const temporary=new URL(randomUUID()+'.tmp',directory);
    await writeFile(temporary,JSON.stringify({data,etag}),{mode:0o600});await rename(temporary,file(key));
    return {modified:true,etag};
   });
   pending=task.catch(()=>{});return task;
  },
  async delete(key){try{await unlink(file(key));}catch(error){if(error.code!=='ENOENT')throw error;}}
 };
}
