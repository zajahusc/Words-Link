import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createAPI,authorized,json} from '../server/api.js';
import {localStore} from '../server/local-store.js';
import {prepareDictionary,validateBuildOptions} from '../server/prepare.js';
try{process.loadEnvFile(new URL('../.env.local',import.meta.url));}catch(error){if(error.code!=='ENOENT')throw error;}
await import('./build.mjs');
const store=localStore(),api=createAPI({store,env:process.env});
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.txt':'text/plain; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const root=new URL('../dist/',import.meta.url);
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname.startsWith('/api/')||url.pathname==='/.netlify/functions/prepare-dictionary-background'){
   let body='';for await(const chunk of req){body+=chunk;if(body.length>4096){res.writeHead(413).end();return;}}
   const request=new Request(url,{method:req.method,headers:req.headers,...(req.method==='GET'||req.method==='HEAD'?{}:{body})});
   let response;
   if(url.pathname==='/.netlify/functions/prepare-dictionary-background'){
    if(req.method!=='POST')response=json({error:'METHOD_NOT_ALLOWED'},405);
    else if(!authorized(request,process.env))response=json({error:'UNAUTHORIZED'},401);
    else if(process.env.MW_LICENSE_APPROVED!=='true')response=json({error:'APPROVAL_REQUIRED'},403);
    else{
     const options=validateBuildOptions(JSON.parse(body));
     response=json({state:'accepted'},202);
     prepareDictionary({store,env:process.env,options}).catch(()=>{});
    }
   }else response=await api(request);
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
  let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{res.writeHead(400).end();return;}
  const file=new URL(pathname==='/'?'index.html':'.'+pathname,root);
  if(!file.href.startsWith(root.href)||pathname.split('/').some(part=>part.startsWith('.'))){res.writeHead(404).end();return;}
  const extension=file.pathname.slice(file.pathname.lastIndexOf('.'));
  const content=await readFile(file);res.writeHead(200,{'Content-Type':types[extension]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:content);
 }catch(error){res.writeHead(error.code==='ENOENT'?404:400,{'Content-Type':'text/plain'});res.end('Request could not be completed.');}
});
server.listen(Number(process.env.PORT||8081),'127.0.0.1',()=>console.log(`Words Link: http://127.0.0.1:${server.address().port} (API key stays server-side)`));
