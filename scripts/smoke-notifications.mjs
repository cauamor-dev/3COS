import fs from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
const base=process.env.CENTRAL_TEST_URL??'https://codex-evolution-preview--central3c-caua.netlify.app';
const credential=JSON.parse(await fs.readFile('.private-backups/smoke-client.json','utf8'));
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const checks=[];function check(name,passed){checks.push({name,passed:!!passed});if(!passed)throw new Error(`Falhou: ${name}`);}
const headers={Authorization:`Bearer ${credential.token}`,'Content-Type':'application/json'};
let entry;
try{
 const unauthorized=await fetch(`${base}/api/cron/lembretes`,{method:'POST'});check('Cron sem segredo negado',unauthorized.status===401);
 const saved=await fetch(`${base}/api/v1/entries`,{method:'POST',headers,body:JSON.stringify({area_slug:'validacao-3c',titulo:'Validação — lembrete e prazo',tipo:'tarefa',conteudo:'Registro sanitizado do teste de notificações. Sem envio a terceiros.',prazo:new Date(Date.now()+30*60000).toISOString(),lembrar_em:new Date(Date.now()-60000).toISOString()})});check('Tarefa de validação criada',saved.ok);entry=(await saved.json()).registro;
 for(let i=0;i<2;i++){
  const tick=await fetch(`${base}/api/cron/lembretes`,{method:'POST',headers:{Authorization:`Bearer ${process.env.CRON_SECRET}`},signal:AbortSignal.timeout(45000)});check(`Tick autenticado ${i+1} concluído`,tick.ok);await tick.body?.cancel();
 }
 const notices=await db.from('notifications').select('id,kind,owner_id').eq('entry_id',entry.id);
 check('Lembrete persistido sem duplicação',notices.data?.filter(n=>n.kind==='reminder').length===1);
 check('Prazo próximo persistido sem duplicação',notices.data?.filter(n=>n.kind==='due_soon').length===1);
 const owner=await db.from('entries').select('owner_id,revision').eq('id',entry.id).single();check('Avisos pertencem somente ao dono',notices.data?.every(n=>n.owner_id===owner.data.owner_id));
 const anon=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const denied=await anon.from('notifications').select('id').eq('entry_id',entry.id);check('Leitura anônima do histórico negada',!!denied.error||denied.data?.length===0);
 const completed=await fetch(`${base}/api/v1/entries/${entry.id}`,{method:'PATCH',headers,body:JSON.stringify({revision:owner.data.revision,concluida:true})});check('Teste concluído sem apagar registro',completed.ok);
}finally{await fs.mkdir('.local-reports',{recursive:true});await fs.writeFile('.local-reports/notifications-smoke.json',JSON.stringify({tested_at:new Date().toISOString(),url:base,checks},null,2));console.log(JSON.stringify({checks}));}
