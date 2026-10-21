const CACHE='words-link-v3';
const ASSETS=['./','./index.html','./styles.css','./app.js','./engine.js','./dictionary-client.js','./icon.svg','./manifest.webmanifest','./data/Synonyms.json','./data/DailyChallenges.json','./data/Licenses.txt','./data/Provenance.json'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(async cache=>{
 await cache.addAll(ASSETS);
 // Capture static-host 404s too, so offline reload can still select the bundled dictionary.
 try{const response=await fetch('./api/dictionary');if(response.ok||response.status===404)await cache.put('./api/dictionary',response);}catch{}
}));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('words-link-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 const base=new URL('./',self.location.href);
 const publicPaths=new Set(ASSETS.map(path=>new URL(path,base).pathname));
 const dictionaryPath=new URL('api/dictionary',base).pathname;
 // Never cache admin endpoints, function invocations, environment files or server source.
 if(!publicPaths.has(url.pathname)&&url.pathname!==dictionaryPath)return;
 event.respondWith(fetch(event.request).then(response=>{
  if(response.ok||(url.pathname===dictionaryPath&&response.status===404)){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}
  return response;
 }).catch(()=>caches.match(event.request).then(response=>response||(event.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));
});
