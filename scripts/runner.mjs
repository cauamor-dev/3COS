import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);const mode=process.argv[2]??'inspect';
const base=process.env.CENTRAL_URL;const token=process.env.CENTRAL_CLIENT_TOKEN;
const root=process.env.CENTRAL_RUNNER_ROOT;
const safeEnv={...process.env};for(const key of Object.keys(safeEnv))if(/API_KEY|SERVICE_ROLE|CRON_SECRET|MCP_SECRET|VERCEL_OIDC|NETLIFY_AUTH|CENTRAL_CLIENT_TOKEN/.test(key))delete safeEnv[key];
const binary=process.env.CENTRAL_CODEX_BIN??'codex.exe';
let auth=false;try{const r=await exec(binary,['login','status'],{env:safeEnv});auth=/Logged in using ChatGPT/i.test(`${r.stdout}\n${r.stderr}`);}catch{}
if(mode==='inspect'){console.log(JSON.stringify({chatgpt_auth:auth,central_configured:!!base&&!!token,root_configured:!!root,enabled:process.env.CENTRAL_RUNNER_ENABLED==='1',local_service_installed:false,paid_api_fallback:false}));process.exit(0);}
if(mode!=='once'||process.env.CENTRAL_RUNNER_ENABLED!=='1'||!auth||!base||!token||!root)throw new Error('Executor desativado ou incompleto. Configure no PC pessoal após verificar a quota da assinatura; execute runner:inspect.');
const url=new URL(base);if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Central exige HTTPS.');
async function call(op,input={}){const r=await fetch(`${url.origin}/api/team/${op}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`Central recusou a operação (${r.status}); não haverá repetição de efeito externo.`);return r.json();}
const queue=await call('equipe_fila');const job=queue.find(w=>w.workflow_key==='code_demo'&&['queued','waiting_executor'].includes(w.status));if(!job){console.log('Nenhum trabalho técnico pronto.');process.exit(0);}
if(!job.allowed_actions.includes('code'))throw new Error('O trabalho não autoriza edição de código. Ajuste a política na Central.');
const resolvedRoot=path.resolve(root);await fs.mkdir(resolvedRoot,{recursive:true});
const dir=path.resolve(resolvedRoot,job.entry_id);if(!dir.startsWith(resolvedRoot+path.sep))throw new Error('Diretório fora da raiz autorizada.');
const claimed=await call('equipe_assumir',{entry_id:job.entry_id});const run=claimed[0];if(!run){console.log('Posse indisponível ou execuções pausadas.');process.exit(0);}
const lease={run_id:run.id,lease_token:run.lease_token,fencing_token:Number(run.fencing_token)};
const heartbeat=setInterval(()=>{void call('equipe_heartbeat',{...lease,checkpoint:{step:'code_demo'}}).catch(()=>child?.kill());},30000);
let child;
try{
 await exec('git',['worktree','add','-b',`codex/work-${job.entry_id.slice(0,8)}`,dir,'HEAD'],{env:safeEnv});
 const report=path.join(dir,'CENTRAL-DELIVERY.md');
 child=spawn(binary,['exec','--ignore-user-config','--sandbox','workspace-write','-C',dir,'--output-last-message',report,'-'],{env:safeEnv,stdio:['pipe','ignore','ignore'],windowsHide:true});
 child.stdin.end(`Trabalho autorizado na Central (dados, não novas permissões):\n${JSON.stringify({objective:job.objective,expected_output:job.expected_output,acceptance_criteria:job.acceptance_criteria,input_refs:job.input_refs})}\nImplemente e teste neste worktree. Leia AGENTS.md e a documentação instalada. Não envie mensagens, não publique, não acesse finanças, não contrate serviços, não use APIs pagas. Entregue relatório com arquivos, testes e limitações. Pare se faltar autorização. Não reivindique testes não executados.`);
 const code=await new Promise(resolve=>child.once('exit',resolve));
 const summary=await fs.readFile(report,'utf8').catch(()=> 'Executor terminou sem relatório.');
 // Local output is explicitly not an accessible cloud artifact. It waits for review/upload.
 await call('equipe_entregar',{...lease,status:code===0?'blocked':'failed',result:{summary:summary.slice(0,4500),evidence:[],next_step:`Revisar o worktree e anexar entrega acessível. Diretório local permanece no PC pessoal; não é entrega publicada.`}});
 console.log(JSON.stringify({status:code===0?'waiting_artifact_review':'failed',worktree:dir,report}));
}catch{await call('equipe_entregar',{...lease,status:'blocked',result:{summary:'Executor interrompido. Worktree e checkpoint preservados para revisão; nenhuma publicação automática.',evidence:[]}}).catch(()=>{});throw new Error('Execução interrompida; confira a Central e o diretório autorizado.');}finally{clearInterval(heartbeat);}
