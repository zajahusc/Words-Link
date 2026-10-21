import {dailyKey} from './engine.js';
export const LEGACY_VERSION='OEWN-2025';
export async function loadLegacy(fetchImpl=fetch){
 const responses=await Promise.all(['Synonyms.json','DailyChallenges.json'].map(name=>fetchImpl(`data/${name}`)));
 if(responses.some(r=>!r.ok))throw Error('The word dictionary is unavailable.');
 const [database,schedule]=await Promise.all(responses.map(r=>r.json()));
 return {provider:'wordnet',version:LEGACY_VERSION,database,schedule};
}
export async function loadDictionary({fetchImpl=fetch,savedSession,finish,day=dailyKey()}={}){
 let response;
 try{response=await fetchImpl('api/dictionary');}catch{throw Error('Connect to the internet once to load the dictionary, then try again.');}
 if(response.status===404)return loadLegacy(fetchImpl); // Static GitHub Pages remains supported.
 if(!response.ok)throw Error('Today’s dictionary is temporarily unavailable. Please try again shortly.');
 let info=await response.json();
 if(info.provider==='wordnet'){
  if(info.activateOn&&day>=info.activateOn)throw Error('Connect to the internet to load the new daily dictionary.');
  return loadLegacy(fetchImpl);
 }
 if(info.provider!=='merriam-webster'||!info.database||!Array.isArray(info.schedule)||info.version!==info.database.version)throw Error('The dictionary could not be loaded.');
 // A legacy attempt/finish already on this browser completes its day under the old rules.
 const active=savedSession?.day===day?savedSession:finish?.day===day?finish:null;
 if(active&&(active.dictionaryVersion||LEGACY_VERSION)===LEGACY_VERSION)return loadLegacy(fetchImpl);
 if(active?.dictionaryVersion&&active.dictionaryVersion!==info.version){
  const pinned=await fetchImpl(`api/dictionary?version=${encodeURIComponent(active.dictionaryVersion)}`);
  if(!pinned.ok)throw Error('Your saved puzzle is temporarily unavailable. Please try again shortly.');
  info=await pinned.json();
  if(info.version!==active.dictionaryVersion||!info.database||!Array.isArray(info.schedule))throw Error('Your saved dictionary could not be loaded.');
 }
 return info;
}
export function meaningLookup(database){
 const pairs=new Map();
 for(const sense of database.meanings||[])for(const word of sense.synonyms){
  for(const [from,to]of[[sense.headword,word],[word,sense.headword]]){
   const key=`${from}|${to}`;if(!pairs.has(key))pairs.set(key,[]);
   pairs.get(key).push(sense);
  }
 }
 return (from,to)=>pairs.get(`${from}|${to}`)||[];
}
