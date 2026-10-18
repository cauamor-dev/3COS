import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const base=(process.env.CENTRAL_TEST_URL??'https://codex-evolution-preview--central3c-caua.netlify.app').replace(/\/$/,'');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const credential=JSON.parse(await fs.readFile('.private-backups/smoke-client.json','utf8'));
const checks=[];function check(name,passed){checks.push({name,passed:!!passed});if(!passed)throw new Error(`Falhou: ${name}`);}
async function api(body){return fetch(`${base}/api/files`,{method:'POST',headers:{Authorization:`Bearer ${credential.token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});}
const area=await db.from('areas').select('id').eq('slug','validacao-3c').single();
const entry=await db.from('entries').select('id,ai_access').eq('area_id',area.data.id).eq('source','codex').order('created_at',{ascending:false}).limit(1).single();
if(!entry.data)throw new Error('Execute primeiro smoke-integration.');
try{
 check('MIME não aceito negado',(await api({action:'reserve',name:'invalido.exe',mime:'application/x-msdownload',size:100,entry_id:entry.data.id})).status===400);
 check('Tamanho acima de 50 MB negado',(await api({action:'reserve',name:'invalido.mp4',mime:'video/mp4',size:52428801,entry_id:entry.data.id})).status===400);
 const bytes=await fs.readFile('tools/marketing/out/demo.mp4');
 const reserved=await api({action:'reserve',name:'Demo Axial — agendamento fictício.mp4',mime:'video/mp4',size:bytes.length,entry_id:entry.data.id});
 check('Reserva autenticada aceita',reserved.ok);const upload=await reserved.json();
 const sent=await fetch(upload.upload_url,{method:'PUT',headers:{'Content-Type':'video/mp4','x-upsert':'false'},body:bytes,signal:AbortSignal.timeout(45000)});
 check('Upload direto real do MP4 aceito',sent.ok);
 const finalized=await api({action:'finalize',id:upload.id});check('Finalização confere objeto real',finalized.ok);await finalized.body?.cancel();
 const metadata=await db.from('artifacts').select('sha256,status').eq('id',upload.id).single();
 check('Hash do artefato confere com MP4 renderizado',metadata.data?.sha256===createHash('sha256').update(bytes).digest('hex')&&metadata.data.status==='ready');
 const opened=await fetch(`${base}/api/files/${upload.id}`,{headers:{Authorization:`Bearer ${credential.token}`},redirect:'manual'});
 check('Link estável exige autorização e renova assinatura',opened.status===302&&!!opened.headers.get('location'));
 const downloaded=await fetch(opened.headers.get('location'));const binary=Buffer.from(await downloaded.arrayBuffer());
 check('Download retorna os mesmos bytes',downloaded.ok&&createHash('sha256').update(binary).digest('hex')===metadata.data.sha256);
 const anonymous=await fetch(`${base}/api/files/${upload.id}`,{redirect:'manual'});check('Arquivo não abre anonimamente',anonymous.status===401);
 await db.from('entries').update({ai_access:'private'}).eq('id',entry.data.id);
 const denied=await fetch(`${base}/api/files/${upload.id}`,{headers:{Authorization:`Bearer ${credential.token}`},redirect:'manual'});check('Arquivo de nota privada negado ao cliente AI',denied.status===403||denied.status===404);
 await fs.mkdir('.local-reports',{recursive:true});await fs.writeFile('.local-reports/file-delivery.json',JSON.stringify({artifact_id:upload.id,entry_id:entry.data.id,url:`${base}/api/files/${upload.id}`,sha256:metadata.data.sha256,bytes:bytes.length},null,2));
}finally{
 await db.from('entries').update({ai_access:entry.data.ai_access}).eq('id',entry.data.id);
 await fs.mkdir('.local-reports',{recursive:true});await fs.writeFile('.local-reports/files-smoke.json',JSON.stringify({tested_at:new Date().toISOString(),url:base,checks},null,2));console.log(JSON.stringify({checks}));
}
