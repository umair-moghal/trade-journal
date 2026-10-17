import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {accountFromCookie} from './auth';
export async function pageAccount(){const h=await headers();const u=await accountFromCookie(h.get('cookie')||'');if(!u)redirect('/login');return u;}
