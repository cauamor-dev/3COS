import { isCronRequest } from "@/lib/http/cron";
import { dispatchOnce } from "@/lib/work/dispatcher";
export async function POST(request:Request){if(!isCronRequest(request))return Response.json({ok:false},{status:401});return Response.json(await dispatchOnce(),{headers:{"Cache-Control":"no-store"}});}
