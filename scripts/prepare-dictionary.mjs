// Operator-only command. The browser never receives this token or the provider key.
import {validateBuildOptions} from '../server/prepare.js';
try{process.loadEnvFile(new URL('../.env.local',import.meta.url));}catch(error){if(error.code!=='ENOENT')throw error;}
const args=process.argv.slice(2);
const option=(name,fallback)=>{const i=args.indexOf(`--${name}`);return i<0?fallback:args[i+1];};
const site=option('site',process.env.WORDS_LINK_SITE_URL||'http://127.0.0.1:8081');
const url=new URL(site);
if(url.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(url.hostname))throw Error('Use HTTPS for a remote site.');
const token=process.env.WORDS_LINK_ADMIN_TOKEN;
if(!token||token.length<32)throw Error('Run npm run setup:secrets and copy WORDS_LINK_ADMIN_TOKEN into the host’s Functions environment.');
const version=option('version',process.env.MW_DATASET_VERSION||'mw-v1');
const headers={Authorization:`Bearer ${token}`};
const request=async path=>{
 const response=await fetch(new URL(path,url),{headers,redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error(`Setup check failed (${response.status}). Verify the site URL and admin token.`);
 return response.json();
};
try{
 const status=await request(`/api/admin/status?version=${encodeURIComponent(version)}`);
 if(!status.configured)throw Error('Add MERRIAM_WEBSTER_API_KEY to the host’s Functions environment and redeploy.');
 if(!status.approved)throw Error('Approval has not been confirmed. Leave MW_LICENSE_APPROVED=false until permission is received.');
 if(status.preparation?.state==='ready'){
  console.log(`${version} is already prepared for ${status.preparation.firstDay} through ${status.preparation.lastDay}. Use a NEW --version to change its dates or vocabulary.`);process.exit(0);
 }
 const startDay=option('start');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(startDay||''))throw Error('Specify --start YYYY-MM-DD (a future New York date).');
 const options=validateBuildOptions({version,startDay,days:Number(option('days',365)),maxQueries:Number(option('queries',400))});
 const response=await fetch(new URL('/.netlify/functions/prepare-dictionary-background',url),{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(options),redirect:'error',signal:AbortSignal.timeout(20000)});
 if(response.status!==202)throw Error(`Preparation was not accepted (${response.status}).`);
 console.log(`Preparation requested for ${version}. Polling sanitized status; no credentials are displayed.`);
 const started=Date.now();
 while(Date.now()-started<16*60*1000){
  await new Promise(resolve=>setTimeout(resolve,5000));
  const {preparation}=await request(`/api/admin/status?version=${encodeURIComponent(version)}`);
  if(!preparation||preparation.startedAt===status.preparation?.startedAt&&preparation.state==='failed')continue;
  console.log(`${preparation.state}: ${preparation.queries||0} new requests, ${preparation.cached||0} saved entries`);
  if(preparation.state==='failed')throw Error(preparation.message);
  if(preparation.state==='ready'){
   console.log(`Verified ${preparation.puzzles} puzzles (${preparation.firstDay} through ${preparation.lastDay}) across ${preparation.words} words. Review on a preview deployment, then set MW_ACTIVATE_ON to ${startDay} and redeploy.`);process.exit(0);
  }
 }
 throw Error('Preparation is still pending. Check the protected status endpoint or try again later.');
}catch(error){console.error(error.message);process.exitCode=1;}
