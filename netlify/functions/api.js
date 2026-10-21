import {getStore} from '@netlify/blobs';
import {createAPI} from '../../server/api.js';
export default async request=>{
 const store=getStore({name:'words-link-dictionaries',consistency:'strong'});
 return createAPI({store,env:process.env})(request);
};
export const config={path:'/api/*'};
