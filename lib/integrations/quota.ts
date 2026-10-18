import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
export async function checkClientQuota(clientId:string) {
 const {data,error}=await createAdminClient().rpc("check_client_quota",{p_client:clientId});
 return !error && data===true;
}
