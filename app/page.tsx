import Journal from '@/components/trading-journal';
import {pageAccount} from '@/lib/server-account';
export const dynamic='force-dynamic';
export default async function Page(){const user=await pageAccount();return <Journal user={user}/>;}
