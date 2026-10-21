import {getStore} from '@netlify/blobs';
import {authorized} from '../../server/api.js';
import {prepareDictionary,validateBuildOptions} from '../../server/prepare.js';
export default async request=>{
 // Background invocations return 202 immediately; authorization is enforced before any work.
 if(request.method!=='POST'||!authorized(request,process.env))return;
 let options;try{options=validateBuildOptions(await request.json());}catch{return;}
 const store=getStore({name:'words-link-dictionaries',consistency:'strong'});
 try{await prepareDictionary({store,env:process.env,options});}
 catch{/* Sanitized status is saved by the generator. Never log upstream errors or secrets. */}
};
