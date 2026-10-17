import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {pbkdf2} from '@noble/hashes/pbkdf2.js';
import {sha256} from '@noble/hashes/sha2.js';
import {db} from './server';
// The hosted native PBKDF2 API caps iterations at 100,000. Keep the
// 600,000-round format using the portable, independently maintained KDF.
const derivePassword=(password:string,salt:string)=>Buffer.from(pbkdf2(sha256,password,salt,{c:600000,dkLen:32}));
export type Account={id:string;name:string;email:string};
export class AuthError extends Error{constructor(message:string,public status=401){super(message);}}
export const hashToken=(s:string)=>createHash('sha256').update(s).digest('hex');
export const randomToken=()=>randomBytes(32).toString('base64url');
export function passwordHash(password:string){const salt=randomBytes(16).toString('hex');return `pbkdf2-sha256$600000$${salt}$${derivePassword(password,salt).toString('hex')}`;}
export function passwordMatches(password:string,encoded:string){const [kind,rounds,salt,hash]=encoded.split('$');if(kind!=='pbkdf2-sha256'||Number(rounds)!==600000||!salt||!hash)return false;const actual=derivePassword(password,salt);const expected=Buffer.from(hash,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected);}
export function validatePassword(password:unknown,confirm:unknown){if(typeof password!=='string'||password.length<12||password.length>128)throw new AuthError('Use a password between 12 and 128 characters.',400);if(password!==confirm)throw new AuthError('Passwords do not match.',400);return password;}
export function normalizeEmail(value:unknown){const email=typeof value==='string'?value.trim().toLowerCase():'';if(email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email))throw new AuthError('Enter a valid email address.',400);return email;}
export function sessionToken(cookie:string){return cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('journal_session='))?.slice(16)||'';}
export async function accountFromCookie(cookie:string):Promise<Account|null>{const token=sessionToken(cookie);if(!/^[A-Za-z0-9_-]{43}$/.test(token))return null;return db().prepare('SELECT u.id,u.name,u.email FROM auth_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND s.credential_version=u.password_hash').bind(hashToken(token),Date.now()).first<Account>();}
export async function requireAccount(req:Request){const u=await accountFromCookie(req.headers.get('cookie')||'');if(!u)throw new AuthError('Please log in to continue.');return u;}
export function sessionCookie(req:Request,token:string,remember:boolean,clear=false){const secure=new URL(req.url).protocol==='https:'?'; Secure':'';return `journal_session=${clear?'':token}; Path=/; HttpOnly; SameSite=Lax${secure}${clear?'; Max-Age=0':remember?'; Max-Age=2592000':''}`;}
export async function newSession(req:Request,id:string,remember:boolean,credentialVersion:string){const token=randomToken(),expires=Date.now()+(remember?30:1)*86400000;await db().prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at,credential_version) VALUES(?,?,?,?)').bind(hashToken(token),id,expires,credentialVersion).run();return sessionCookie(req,token,remember);}
export function authResponse(data:unknown,status=200,cookie?:string){return Response.json(data,{status,headers:{'Cache-Control':'no-store','Vary':'Cookie',...(cookie?{'Set-Cookie':cookie}:{})}});}
export function failure(e:unknown){if(e instanceof AuthError)return authResponse({error:e.message},e.status);console.error('Journal operation failed',e instanceof Error?{name:e.name,message:e.message.slice(0,500)}:{name:'UnknownError'});return authResponse({error:'The request could not be completed. Please retry.'},500);}
/** Atomic database counter; never trust a client-supplied account ID or IP header. */
export async function rateLimit(req:Request,scope:string,email=''){const window=Math.floor(Date.now()/900000),ip=req.headers.get('cf-connecting-ip')||'local';for(const part of [ip,...(email?[email]:[])]){const key=hashToken(scope+':'+part+':'+window);const row=await db().prepare('INSERT INTO auth_limits(id,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(key,(window+2)*900000).first<{attempts:number}>();if((row?.attempts||0)>20)throw new AuthError('Too many attempts. Try again in 15 minutes.',429);}await db().prepare('DELETE FROM auth_limits WHERE expires_at<?').bind(Date.now()).run();}
