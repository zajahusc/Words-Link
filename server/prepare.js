import {randomUUID} from 'node:crypto';
import {lookup,DictionaryError} from './merriam-webster.js';
import {graphFromEntries,makeSchedule,validDay} from './puzzles.js';
// Everyday starting vocabulary; expansion follows the provider's strict synonym lists.
export const SEEDS=['bright','clear','light','strong','calm','quick','happy','kind','quiet','sharp','fair','sound','plain','fine','close','open','hard','soft','cool','warm','fresh','sweet','great','small','large','fast','slow','right','true','bold','clean','simple','rich','rough','smooth','still','free','easy','firm','deep'];
export const validVersion=version=>typeof version==='string'&&/^[a-z0-9][a-z0-9-]{0,39}$/.test(version);
export function validateBuildOptions(options={}){
 const {version,startDay,maxQueries=400,days=365}=options;
 if(!validVersion(version)||!validDay(startDay)||!Number.isInteger(maxQueries)||maxQueries<1||maxQueries>800||!Number.isInteger(days)||days<1||days>366)throw new DictionaryError('INVALID_OPTIONS','Use a valid version, start date, 1–800 maximum queries and 1–366 days.');
 return {version,startDay,maxQueries,days};
}
export async function prepareDictionary({store,env,options,lookupImpl=lookup,now=()=>Date.now(),seeds=SEEDS,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 const config=validateBuildOptions(options);
 if(env.MW_LICENSE_APPROVED!=='true')throw new DictionaryError('APPROVAL_REQUIRED','Written permission for generation, caching and offline distribution must be confirmed first.');
 if(!env.MERRIAM_WEBSTER_API_KEY)throw new DictionaryError('MISSING_KEY','Add MERRIAM_WEBSTER_API_KEY to the server environment.');
 const existing=await store.get(`datasets/${config.version}`,{type:'json'});
 if(existing)return {state:'ready',version:config.version,reused:true};
 const runId=randomUUID(),started=now(),lockKey='generation-lock';
 let lock=await store.setJSON(lockKey,{runId,expires:started+20*60*1000},{onlyIfNew:true});
 if(!lock.modified){
  const previous=await store.getWithMetadata(lockKey,{type:'json'});
  if(previous&&previous.data.expires<started)lock=await store.setJSON(lockKey,{runId,expires:started+20*60*1000},{onlyIfMatch:previous.etag});
 }
 if(!lock.modified)throw new DictionaryError('BUILD_RUNNING','Another preparation is running. Please wait.');
 const statusKey=`status/${config.version}`;
 const status={state:'building',version:config.version,startedAt:new Date(started).toISOString(),queries:0,cached:0};
 try{
  await store.setJSON(statusKey,status);
  const queue=[...seeds],seen=new Set(queue),entries=[];
  for(let i=0;i<queue.length&&entries.length<config.maxQueries;i++){
   if(now()-started>11*60*1000)throw new DictionaryError('BUILD_TIMEOUT','Preparation paused before the runtime limit. Run it again to resume from saved entries.');
   const word=queue[i],entryKey=`entries/${config.version}/${word}`;
   let entry=await store.get(entryKey,{type:'json'});
   if(!entry){
    // A global mutex and a durable pre-request counter also cover retries/new versions.
    const usageKey=`usage/${new Date(now()).toISOString().slice(0,10)}`;
    const usage=(await store.get(usageKey,{type:'json'}))||{queries:0};
    if(usage.queries>=800)throw new DictionaryError('DAILY_BUDGET','The app’s 800-request daily preparation budget is used. Resume tomorrow.');
    usage.queries++;await store.setJSON(usageKey,usage);
    entry=await lookupImpl(word,{key:env.MERRIAM_WEBSTER_API_KEY,timeout:8000});
    await store.setJSON(entryKey,entry);status.queries++;
    await pause(250);
   }else status.cached++;
   entries.push(entry);
   for(const sense of entry.senses)for(const candidate of sense.synonyms)if(!seen.has(candidate)){seen.add(candidate);queue.push(candidate);}
   if(i%10===0)await store.setJSON(statusKey,{...status,wordsProcessed:entries.length});
  }
  const database=graphFromEntries(entries,config.version);
  const schedule=makeSchedule(database,config);
  const dataset={provider:'merriam-webster',version:config.version,database,schedule,builtAt:new Date(now()).toISOString()};
  const saved=await store.setJSON(`datasets/${config.version}`,dataset,{onlyIfNew:true});
  if(!saved.modified)throw new DictionaryError('VERSION_EXISTS','That dictionary version already exists.');
  const result={...status,state:'ready',completedAt:dataset.builtAt,words:database.words.length,puzzles:schedule.length,firstDay:schedule[0].date,lastDay:schedule.at(-1).date};
  await store.setJSON(statusKey,result);return result;
 }catch(error){
  // Unknown errors are never serialized: upstream URLs may contain credentials.
  const safe=error instanceof DictionaryError?{code:error.code,message:error.message}:{code:'PREPARATION_FAILED',message:'Could not prepare verified puzzles. Check the seed vocabulary and setup, then retry; saved entries are reused.'};
  await store.setJSON(statusKey,{...status,state:'failed',...safe});
  throw new DictionaryError(safe.code,safe.message);
 }finally{await store.delete(lockKey);}
}
