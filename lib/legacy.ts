import {env} from 'cloudflare:workers';
import {requireAccount,AuthError} from './auth';
export async function legacyOwner(req:Request){const user=await requireAccount(req),owner=(env as any).LEGACY_OWNER_EMAIL;const email=req.headers.get('oai-authenticated-user-email')?.toLowerCase();if(!owner||!req.headers.get('oai-authenticated-user-id')||email!==owner.toLowerCase()||user.email!==email)throw new AuthError('Verify the original site-owner identity and use a journal account with the same email.',403);return user;}
