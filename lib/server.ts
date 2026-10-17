import {env} from 'cloudflare:workers';
export const db=()=> (env as any).DB as D1Database;
export const bucket=()=> (env as any).BUCKET as R2Bucket;
export function checkOrigin(req:Request){if(req.headers.get('sec-fetch-site')==='cross-site')throw Error('Cross-origin write rejected');const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw Error('Cross-origin write rejected');}
