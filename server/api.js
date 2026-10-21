import {timingSafeEqual} from 'node:crypto';
import {dailyKey} from '../engine.js';
import {validDay} from './puzzles.js';
import {validVersion} from './prepare.js';
export const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function authorized(request,env){
 const secret=env.WORDS_LINK_ADMIN_TOKEN;
 if(!secret||secret.length<32)return false;
 const actual=Buffer.from(request.headers.get('Authorization')||''),expected=Buffer.from(`Bearer ${secret}`);
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
export function createAPI({store,env,now=()=>new Date()}){
 return async request=>{
  try{
   const url=new URL(request.url);
   if(request.method!=='GET')return json({error:'METHOD_NOT_ALLOWED'},405);
   if(url.pathname==='/api/admin/status'){
    if(!authorized(request,env))return json({error:'UNAUTHORIZED'},401);
    const version=url.searchParams.get('version')||env.MW_DATASET_VERSION||'mw-v1';
    if(!validVersion(version))return json({error:'INVALID_VERSION'},400);
    return json({configured:!!env.MERRIAM_WEBSTER_API_KEY,approved:env.MW_LICENSE_APPROVED==='true',version,activationDate:env.MW_ACTIVATE_ON||null,preparation:await store.get(`status/${version}`,{type:'json'})});
   }
   if(url.pathname!=='/api/dictionary')return json({error:'NOT_FOUND'},404);
   const activateOn=env.MW_ACTIVATE_ON;
   if(activateOn&&!validDay(activateOn))return json({error:'DICTIONARY_NOT_READY'},503);
   if(!activateOn||dailyKey(now())<activateOn)return json({provider:'wordnet',version:'OEWN-2025',activateOn:activateOn||null});
   if(!validDay(activateOn)||env.MW_LICENSE_APPROVED!=='true')return json({error:'DICTIONARY_NOT_READY'},503);
   const version=url.searchParams.get('version')||env.MW_DATASET_VERSION||'mw-v1';
   if(!validVersion(version))return json({error:'DICTIONARY_NOT_READY'},503);
   const dataset=await store.get(`datasets/${version}`,{type:'json'});
   if(!dataset||!dataset.schedule.some(puzzle=>puzzle.date===dailyKey(now())))return json({error:'DICTIONARY_NOT_READY'},503);
   // Explicit fields only. Environment variables and raw upstream responses never leave the server.
   return json({provider:dataset.provider,version:dataset.version,database:dataset.database,schedule:dataset.schedule});
  }catch{return json({error:'DICTIONARY_UNAVAILABLE'},503);}
 };
}
