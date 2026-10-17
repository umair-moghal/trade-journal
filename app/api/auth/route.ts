import {db,checkOrigin} from '@/lib/server';
import {AuthError,accountFromCookie,requireAccount,normalizeEmail,validatePassword,passwordHash,passwordMatches,hashToken,randomToken,newSession,sessionToken,sessionCookie,authResponse,failure,rateLimit} from '@/lib/auth';
export async function GET(req:Request){return authResponse({user:await accountFromCookie(req.headers.get('cookie')||'')});}
export async function POST(req:Request){try{
 checkOrigin(req);if(Number(req.headers.get('content-length')||0)>8192)throw new AuthError('Request too large.',413);
 const b=await req.json() as any;const d=db();
 if(b.action==='logout'){const token=sessionToken(req.headers.get('cookie')||'');if(token)await d.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(hashToken(token)).run();return authResponse({ok:true},200,sessionCookie(req,'',false,true));}
 if(b.action==='profile'){const u=await requireAccount(req);const name=typeof b.name==='string'?b.name.trim():'';if(name.length<2||name.length>100)throw new AuthError('Enter your full name (2–100 characters).',400);await d.prepare('UPDATE app_users SET name=? WHERE id=?').bind(name,u.id).run();return authResponse({user:{...u,name}});}
 if(!['signup','login','reset'].includes(b.action))throw new AuthError('Unknown request.',400);
 const email=normalizeEmail(b.email);await rateLimit(req,b.action,email);
 if(b.action==='signup'){
  const password=validatePassword(b.password,b.confirmPassword),name=typeof b.name==='string'?b.name.trim():'';if(name.length<2||name.length>100)throw new AuthError('Enter your full name (2–100 characters).',400);
  const user={id:crypto.randomUUID(),name,email},recoveryCode=randomToken(),encoded=passwordHash(password);
  const result=await d.prepare('INSERT OR IGNORE INTO app_users(id,name,email,password_hash,recovery_hash,created_at) VALUES(?,?,?,?,?,?)').bind(user.id,name,email,encoded,hashToken(recoveryCode),Date.now()).run();
  if(!result.meta.changes)throw new AuthError('An account already uses this email. Log in or reset your password.',409);
  return authResponse({user,recoveryCode},201,await newSession(req,user.id,!!b.remember,encoded));
 }
 if(b.action==='login'){
  if(typeof b.password!=='string'||b.password.length>128)throw new AuthError('Email or password is incorrect.',401);
  const row=await d.prepare('SELECT id,name,email,password_hash FROM app_users WHERE email=?').bind(email).first<any>();
  // Do the same KDF work for unknown emails to avoid a fast account-enumeration path.
  const dummy='pbkdf2-sha256$600000$00000000000000000000000000000000$'+'0'.repeat(64);
  if(!passwordMatches(b.password,row?.password_hash||dummy)||!row)throw new AuthError('Email or password is incorrect.',401);
  return authResponse({user:{id:row.id,name:row.name,email:row.email}},200,await newSession(req,row.id,!!b.remember,row.password_hash));
 }
 const password=validatePassword(b.password,b.confirmPassword),code=typeof b.recoveryCode==='string'?b.recoveryCode.trim():'';
 const row=await d.prepare('SELECT id FROM app_users WHERE email=? AND recovery_hash=?').bind(email,hashToken(code)).first<{id:string}>();
 if(!row||code.length!==43)throw new AuthError('Email or recovery code is incorrect.',400);
 const nextCode=randomToken();const update=await d.prepare('UPDATE app_users SET password_hash=?,recovery_hash=? WHERE id=? AND recovery_hash=? RETURNING id').bind(passwordHash(password),hashToken(nextCode),row.id,hashToken(code)).first();
 if(!update)throw new AuthError('This recovery code has already been used.',400);
 await d.prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(row.id).run();
 return authResponse({ok:true,recoveryCode:nextCode},200,sessionCookie(req,'',false,true));
 }catch(e){return failure(e);}}
