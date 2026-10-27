import {privateAccess} from '@/lib/private-access';
import PrivateHealth from './private-health';
export const dynamic='force-dynamic';
export const revalidate=0;
export default async function MinhaSaude(){
 const access=await privateAccess();
 return <PrivateHealth access={access}/>;
}
