import {NextResponse} from 'next/server';
export function middleware(){const response=NextResponse.next();response.headers.set('Cache-Control','private, no-store');response.headers.set('Vary','Cookie');return response;}
export const config={matcher:['/','/login','/signup','/forgot-password','/reset-password','/profile','/legacy-import','/dashboard','/journal','/trades','/analytics','/calendar','/screenshots','/strategies','/settings']};
