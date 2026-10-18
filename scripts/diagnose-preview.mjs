import fs from 'node:fs/promises';
const credential=JSON.parse(await fs.readFile('.private-backups/smoke-client.json','utf8'));
const base='https://codex-evolution-preview--central3c-caua.netlify.app';
for(const [name,token] of [['new',credential.token],['legacy',process.env.API_KEY]]){
 const r=await fetch(`${base}/api/v1/areas`,{headers:{Authorization:`Bearer ${token}`}});const data=await r.json().catch(()=>null);
 console.log(JSON.stringify({name,status:r.status,server:r.headers.get('server'),auth:r.headers.get('www-authenticate'),error:data?.error?.code,error_message:data?.error?.message}));
}
