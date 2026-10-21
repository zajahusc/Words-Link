// All access to the upstream API stays on the server. No API URLs or credentials
// are copied into the browser's asset directory.
export class DictionaryError extends Error {
  constructor(code,message){super(message);this.code=code;}
}
const uncommon=/\b(archaic|obsolete|dated|rare|chiefly dialectal|dialect|offensive|vulgar|slang)\b/i;
export function normalizeWord(value){
 const word=typeof value==='string'?value.trim().toLowerCase():'';
 return /^[a-z]{2,24}$/.test(word)?word:null;
}
export function plainText(value=''){
 return String(value)
  .replace(/\{(?:a_link|d_link|i_link|et_link|mat|sx|dxt)\|([^|{}]+)(?:\|[^{}]*)?\}/g,'$1')
  .replace(/\{bc\}/g,': ').replace(/\{ldquo\}/g,'“').replace(/\{rdquo\}/g,'”')
  .replace(/\{[^{}]*\}/g,'').replace(/\s+/g,' ').replace(/^:\s*/,'').trim();
}
function labels(value){return Array.isArray(value)?value.filter(v=>typeof v==='string').join(' '):'';}
function* senses(value){
 if(Array.isArray(value)){
  if(value[0]==='sense' && value[1] && typeof value[1]==='object'){
   yield value[1];
   if(value[1].sdsense)yield value[1].sdsense;
  }else if(value[0]==='bs'&&value[1]?.sense){yield value[1].sense;}
  else for(const item of value)yield* senses(item);
 }
}
export function parseEntries(word,payload){
 if(!Array.isArray(payload))throw new DictionaryError('UPSTREAM_FORMAT','The thesaurus returned an unexpected response.');
 const result=[];
 for(const entry of payload){
  if(!entry||typeof entry!=='object'||entry.meta?.offensive)continue;
  // Suggestions, inflections and neighboring headwords must never become synonym edges.
  const head=String(entry.meta?.id||'').replace(/:\d+$/,'').toLowerCase();
  if(head!==word||!['noun','verb','adjective','adverb'].includes(entry.fl))continue;
  if(uncommon.test(labels(entry.lbs)+' '+labels(entry.sls)))continue;
  for(const section of entry.def||[])for(const sense of senses(section.sseq)){
   const usage=[labels(sense.sls),labels(sense.lbs),sense.sgram||''].join(' ');
   if(uncommon.test(usage))continue;
   const definition=(sense.dt||[]).filter(x=>x[0]==='text').map(x=>plainText(x[1])).join(' ');
   if(!definition)continue;
   const synonyms=[];
   // Strict syn_list only: related/near-synonym/antonym lists are deliberately excluded.
   for(const group of sense.syn_list||[])for(const item of group){
    const candidate=normalizeWord(item.wd);
    if(candidate&&candidate!==word&&!uncommon.test(labels(item.wsls)))synonyms.push(candidate);
   }
   if(synonyms.length)result.push({partOfSpeech:entry.fl,definition,synonyms:[...new Set(synonyms)].sort()});
  }
 }
 return {word,senses:result};
}
export async function lookup(word,{key,fetchImpl=fetch,timeout=12000}={}){
 word=normalizeWord(word);
 if(!word)throw new DictionaryError('INVALID_WORD','Use a single alphabetic word.');
 if(!key)throw new DictionaryError('MISSING_KEY','Add the thesaurus key to the server environment.');
 const url=new URL(`https://www.dictionaryapi.com/api/v3/references/thesaurus/json/${encodeURIComponent(word)}`);
 url.searchParams.set('key',key);
 let response;
 try{response=await fetchImpl(url,{signal:AbortSignal.timeout(timeout),redirect:'error'});}
 catch{throw new DictionaryError('UPSTREAM_UNAVAILABLE','The thesaurus request failed. Try again later.');}
 // Never forward upstream body, request URL or original errors: they can contain the key.
 if(!response.ok)throw new DictionaryError(response.status===429?'UPSTREAM_LIMIT':'UPSTREAM_UNAVAILABLE',response.status===429?'The thesaurus request limit was reached.':'The thesaurus could not complete the request.');
 let payload;try{payload=await response.json();}catch{throw new DictionaryError('UPSTREAM_FORMAT','The thesaurus returned an unexpected response.');}
 return parseEntries(word,payload);
}
