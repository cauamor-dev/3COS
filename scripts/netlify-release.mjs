import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import {execFileSync} from "node:child_process";
import JSZip from "jszip";
const action = process.argv[2] ?? "inspect";
const config = JSON.parse(
  await fs.readFile(
    path.join(process.env.APPDATA, "netlify", "Config", "config.json"),
    "utf8",
  ),
);
const token = config.users?.[config.userId]?.auth?.token;
if (!token)
  throw new Error(
    "Login Netlify CLI ausente. Nenhuma credencial foi copiada do navegador.",
  );
async function api(endpoint, method = "GET", body) {
  const r = await fetch(`https://api.netlify.com/api/v1/${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok)
    throw new Error(
      `Netlify ${r.status} em operação ${method}; conteúdo privado omitido`,
    );
  return r.status === 204 ? null : r.json();
}
const accounts = await api("accounts");
const account = accounts.find((a) => a.slug === "axial");
if (!account) throw new Error("Equipe Axial não encontrada.");
const sites = await api("sites?per_page=100");
let site = sites.find(
  (s) => s.name === "central3c-caua" && s.account_slug === "axial",
);
if (action === "inspect") {
  console.log(
    JSON.stringify({
      account: account.slug,
      type: account.type,
      existing_central: site ? { name: site.name, url: site.ssl_url } : null,
      visibility_keys:site?Object.fromEntries(Object.entries(site).filter(([k])=>/visibility|protection|private|access/.test(k)).map(([k,v])=>[k,typeof v==='string'&&['public','private'].includes(v)?v:typeof v])):null,
      projects: sites
        .filter((s) => s.account_slug === "axial")
        .map((s) => ({ name: s.name, url: s.ssl_url })),
    }),
  );
  process.exit(0);
}
if (!["prepare", "preview", "publish", "cloud-preview", "cloud-production", "cloud-status", "promote"].includes(action))
  throw new Error("Ação inválida.");
// Account Free, no card, 269.1/300 credits confirmed in the authenticated dashboard on 2026-10-18.
// Do not upgrade, enable add-ons, register a domain or change the existing Axial project.
if (!site) site = await api("axial/sites", "POST", { name: "central3c-caua" });
await fs.mkdir(".netlify", { recursive: true });
await fs.writeFile(".netlify/state.json", JSON.stringify({ siteId: site.id }));
if(action==="cloud-preview" || action==="cloud-production"){
 if(action==="cloud-production" && process.env.CENTRAL_RELEASE_VALIDATED!=="1")throw new Error('Validar código e preview antes do build Production.');
 const zip=new JSZip();
 const files=execFileSync('git',['ls-files','-z','-c','-o','--exclude-standard'],{encoding:'utf8'}).split('\0').filter(Boolean);
 for(const file of new Set(files)){
  if(/(^|\/)(node_modules|\.git|\.netlify|\.vercel|\.private-backups|\.local-reports)(\/|$)/.test(file)||(/(^|\/)\.env/.test(file)&&file!=='.env.example'))continue;
  zip.file(file,await fs.readFile(file));
 }
 const archive=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
 const query=new URLSearchParams({title:'3C OS validated source'});
 if(action==='cloud-preview')query.set('branch','codex-evolution-preview');
 const response=await fetch(`https://api.netlify.com/api/v1/sites/${site.id}/builds?${query}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/zip'},body:archive});
 if(!response.ok)throw new Error(`Build remoto não iniciado (${response.status}); sem mudança no Painel Axial.`);
 const receipt=await response.json();await fs.mkdir('.local-reports',{recursive:true});await fs.writeFile('.local-reports/netlify-build.json',JSON.stringify({id:receipt.id,deploy_id:receipt.deploy_id,site_id:site.id,expected_context:action==='cloud-production'?'production':'branch-deploy'}));
 console.log(JSON.stringify({queued:true,build_id:receipt.id,deploy_id:receipt.deploy_id,source_files:files.length,source_bytes:archive.length}));process.exit(0);
}
if(action==='cloud-status'||action==='promote'){
 const r=JSON.parse(await fs.readFile('.local-reports/netlify-build.json','utf8'));
 if(action==='promote'){
  if(process.env.CENTRAL_RELEASE_VALIDATED!=='1')throw new Error('Preview e recuperação precisam estar validados.');
  const published=await api(`sites/${site.id}/deploys/${r.deploy_id}/restore`,'POST');console.log(JSON.stringify({published:true,url:published.ssl_url,deploy:published.id}));process.exit(0);
 }
 const deploy=await api(`sites/${site.id}/deploys/${r.deploy_id}`);console.log(JSON.stringify({id:deploy.id,state:deploy.state,url:deploy.deploy_ssl_url,error:deploy.error_message,context:deploy.context,expected_context:r.expected_context}));if(r.expected_context&&deploy.context!==r.expected_context)throw new Error('Contexto de deploy diferente do solicitado. Não promover.');process.exit(0);
}
if (action === "prepare") {
  process.loadEnvFile(".env.local");
  const keys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ALLOWED_EMAIL",
    "API_KEY",
    "MCP_SECRET",
    "CRON_SECRET",
    "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
    "VAPID_PRIVATE_KEY",
    "VAPID_SUBJECT",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID",
    "RESEND_API_KEY",
    "NOTIFICATION_EMAIL_FROM",
  ];
  const vars = keys
    .filter((key) => process.env[key])
    .map((key) => ({
      key,
      values: [{ context: "all", value: process.env[key] }],
    }));
  vars.push({
    key: "NEXT_PUBLIC_APP_URL",
    values: [{ context: "all", value: `https://${site.name}.netlify.app` }],
  });
  for (const key of [
    "CHLOE_AI_ENABLED",
    "CHLOE_FREE_TIER_CONFIRMED",
    "CHLOE_EVALUATION_PASSED",
    "CENTRAL_DISPATCHER_ENABLED",
  ])
    vars.push({ key, values: [{ context: "all", value: "0" }] });
  // Secret values go directly to the authorized Central host; never to stdout or source control.
  const existing = await api(`accounts/${account.id}/env?site_id=${site.id}`);
  for (const item of vars) {
    if (existing.some((v) => v.key === item.key))
      await api(
        `accounts/${account.id}/env/${item.key}?site_id=${site.id}`,
        "PUT",
        item,
      );
    else
      await api(`accounts/${account.id}/env?site_id=${site.id}`, "POST", [
        item,
      ]);
  }
  console.log(
    JSON.stringify({
      prepared: true,
      url: `https://${site.name}.netlify.app`,
      variable_names: vars.map((v) => v.key),
    }),
  );
  process.exit(0);
}
if (action === "publish" && process.env.CENTRAL_RELEASE_VALIDATED !== "1")
  throw new Error("Valide preview e recuperação antes de publicar.");
const args = [
  "--yes",
  "--package=netlify-cli@27.13.0",
  "netlify",
  "deploy",
  "--build",
  ...(action === "publish" ? ["--prod"] : []),
];
const cli = spawn(process.platform === "win32" ? "npx.cmd" : "npx", args, {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    NETLIFY_AUTH_TOKEN: token,
    NETLIFY_SITE_ID: site.id,
    NETLIFY_TELEMETRY_DISABLED: "1",
  },
});
cli.on("exit", (code) => process.exit(code ?? 1));
