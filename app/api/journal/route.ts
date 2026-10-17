import {db,checkOrigin} from '@/lib/server';
import {defaults,strategies,demoTrades,validate} from '@/lib/journal';
import {requireAccount,authResponse,failure,AuthError} from '@/lib/auth';
async function checkScreenshot(userId:string,t:any){if(!t.screenshot)return;const m=typeof t.screenshot==='string'&&t.screenshot.match(/^\/api\/image\/([A-Za-z0-9-]+)$/);if(!m||!await db().prepare('SELECT id FROM user_images WHERE id=? AND user_id=?').bind(m[1],userId).first())throw new AuthError('Screenshot unavailable for this account.',400);}
export async function GET(req:Request){try{const u=await requireAccount(req),d=db();await d.batch([
 d.prepare('INSERT OR IGNORE INTO user_preferences(user_id,id,payload) VALUES(?,?,?)').bind(u.id,'settings',JSON.stringify(defaults)),
 d.prepare('INSERT OR IGNORE INTO user_preferences(user_id,id,payload) VALUES(?,?,?)').bind(u.id,'strategies',JSON.stringify(strategies))]);
 const ts=await d.prepare('SELECT id,payload FROM user_trades WHERE user_id=?').bind(u.id).all();const ps=await d.prepare('SELECT id,payload FROM user_preferences WHERE user_id=?').bind(u.id).all();
 return authResponse({user:u,trades:ts.results.map((t:any)=>({...JSON.parse(t.payload),id:t.id,user_id:u.id})),...Object.fromEntries(ps.results.map((p:any)=>[p.id,JSON.parse(p.payload)]))});
 }catch(e){return failure(e);}}
export async function POST(req:Request){try{checkOrigin(req);const u=await requireAccount(req),b=await req.json() as any,d=db();
 const save=async(t:any)=>{validate(t);if(typeof t.id!=='string'||t.id.length>100||!t.id.length)throw new AuthError('Invalid trade ID.',400);await checkScreenshot(u.id,t);const {user_id,owner_id,...trade}=t;return d.prepare('INSERT INTO user_trades(user_id,id,payload) VALUES(?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET payload=excluded.payload').bind(u.id,t.id,JSON.stringify(trade));};
 if(b.action==='save'){await (await save(b.trade)).run();}
 else if(b.action==='delete'){await d.prepare('DELETE FROM user_trades WHERE id=? AND user_id=?').bind(b.id,u.id).run();}
 else if(b.action==='clearDemo'){const rows=await d.prepare('SELECT id,payload FROM user_trades WHERE user_id=?').bind(u.id).all();const demo=rows.results.filter((r:any)=>JSON.parse(r.payload).demo);if(demo.length)await d.batch(demo.map((r:any)=>d.prepare('DELETE FROM user_trades WHERE id=? AND user_id=?').bind(r.id,u.id)));}
 else if(b.action==='settings'){const s=b.settings;if(!s||s.goldContractSize!==undefined&&(!(s.goldContractSize>0)||!Number.isFinite(s.goldContractSize)))throw new AuthError('Gold contract size must be positive.',400);if(!(s.pointSize>0)||!Number.isFinite(s.pointSize)||!Number.isInteger(s.precision)||s.precision<0||s.precision>8||!(s.lot>0)||!Number.isFinite(s.lot)||!/^[A-Z]{3}$/.test(s.currency))throw new AuthError('Check settings values.',400);await d.prepare('INSERT INTO user_preferences(user_id,id,payload) VALUES(?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET payload=excluded.payload').bind(u.id,'settings',JSON.stringify(s)).run();}
 else if(b.action==='strategies'){if(!Array.isArray(b.strategies)||b.strategies.length>500||b.strategies.some((x:any)=>typeof x!=='string'||!x.trim()||x.length>200))throw new AuthError('Invalid strategies.',400);await d.prepare('INSERT INTO user_preferences(user_id,id,payload) VALUES(?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET payload=excluded.payload').bind(u.id,'strategies',JSON.stringify([...new Set(b.strategies)])).run();}
 else if(b.action==='import'){if(!Array.isArray(b.trades)||b.trades.length>3000)throw new AuthError('Import up to 3,000 trades per file.',400);const queries=[];for(const t of b.trades)queries.push(await save(t));if(queries.length)await d.batch(queries);}
 else throw new AuthError('Unknown action.',400);
 return authResponse({ok:true});}catch(e){if(e instanceof Error&&!(e instanceof AuthError))return authResponse({error:'Check the submitted trade and settings values.'},400);return failure(e);}}
