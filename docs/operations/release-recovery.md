# Operação, release e recuperação

Produção: https://central3c-caua.netlify.app. Preview: https://codex-evolution-preview--central3c-caua.netlify.app. Login restrito e APIs autenticadas; Supabase preservado; Painel Axial separado. Nunca colocar token/senha em chat, nota, issue ou commit.

## Pausar

Equipe → Pausar tudo bloqueia novas aquisições/efeitos da Central. Revogar cliente comprometido em Conexões. Não desfaz ação já enviada; rotinas Grok/Claude pausam também na origem. Retomar somente após conferir conexão, concessões, resultado incerto e aprovação. Habilitar agente não comprova conexão.

Dispatcher permanece CENTRAL_DISPATCHER_ENABLED=0 e depende do controle global. Modelo exige chave grátis, três flags Chloe, quotas e avaliação real. Runner requer configuração explícita no PC pessoal. Nenhum deve ser ligado por inferência.

## Login e host

Pedir link no host em que deseja entrar, abrir no mesmo navegador; sessão vale por host. E-mail antigo pode apontar à Vercel. Callback limitado a origens próprias exatas, próximo caminho em cookie HttpOnly. Não copiar link/código para suporte.

SMTP padrão permite dois emails/hora; over_email_send_rate_limit pode exigir esperar a janela, não um minuto. Evitar pedidos repetidos e links administrativos de contorno. SMTP próprio só com remetente/provedor autorizado e cota grátis verificada, sem comprar domínio/plano. [Limites](https://supabase.com/docs/guides/auth/rate-limits).

Site URL e Vault app_url apontam ao host aprovado. Antes de config push, usar diff e arquivo parcial (campos não declarados preservados). Não imprimir Vault/segredos. Preservar callbacks legados durante a transição. Quatro cron originais: lembretes, resumo, notícias e limpeza; não duplicar.

## Release

1. Conferir diff/segredos/migrações/dados; autor noreply sem Co-Authored-By. Executar lint, tipos, testes e build; backup privado/restauração isolada antes de alteração sensível.
2. Aplicar só novas migrações testadas, nunca reescrever as já aplicadas. Fonte pública sem dados privados.
3. netlify-release.mjs cloud-preview envia ZIP limpo para build Linux, com adaptador Next explícito; cloud-status consulta recibo local. Windows CLI Edge falhou por caminho; não publicar .next cru sem adaptador.
4. Conferir HTTP/login/callback/MCP/REST/arquivo/cron/notificações individualmente. Ready não basta; inspecionar arquivos publicados. Com preview validado, CENTRAL_RELEASE_VALIDATED=1 no processo e promote restaura o deploy validado.
5. Conferir produção/primeiro ciclo e atualizar Site URL/Vault. Credencial CLI só em memória. Preservar host antigo com mesmo hardening até testar consumidores; não redirecionar Authorization entre hosts nem encaminhar segredo a domínio arbitrário.

Badge desligado somente na Central via Project configuration → General → Powered by Netlify badge. Sem custo/redeploy. [Documentação](https://docs.netlify.com/manage/projects/powered-by-netlify-badge/).

## Backup/recuperação

npm run backup:private exporta 33 tabelas, identidades Auth mínimas e bytes do bucket privado com SHA-256. .private-backups ignorado pelo Git. Snapshot por tabela, não físico/transacional/PITR. Não inclui senhas/sessões, Vault, cron ou configuração remota. Guardar cópia segura fora do PC sob controle do dono, nunca em repositório público ou IA.

npx tsx scripts/restore-check.mts .private-backups/<snapshot> usa **sempre banco em memória**: importa dados/identidades e verifica contagens/FKs/hashes. O truncate do ensaio é exclusivamente isolado; não reutilizá-lo em produção.

Recuperação remota: pausar escritores/cron aplicáveis, snapshot atual, projeto isolado com mesmas migrações, identidades pelo mecanismo Auth suportado (sem inventar UUIDs), dados em ordem de dependência e upload dos objetos privados. Revogar clientes restaurados ou reaplicar as revogações posteriores ao snapshot antes de expor o serviço; nunca reativar token antigo por restauração de backup. Conferir propriedade/RLS/contagens/download antes de trocar configuração. Não há restauração remota automática destrutiva neste projeto.

Rollback normal mantém tabelas aditivas/dados novos: desligar flags, pausar e restaurar release **compatível e segura** ou aplicar correção. Não executar down migration nem voltar API sem filtros de privacidade. Esta é a primeira release Netlify funcional; não existe deploy anterior Netlify seguro. Em incidente, pausar e corrigir mantendo o banco; voltar Auth/Vault somente após validar host anterior.

Arquivos legados: --catalog mantém links. migrate-file-references.mjs --apply requer acesso canônico validado e CENTRAL_FILE_LINKS_READY=1; edita com revisão, sem deletar objetos. Não revoga capacidades antigas automaticamente. Revogação exige plano por objeto/consumidor; não rotacionar segredo Supabase geral para isso.

## Etapas externas

- Grok Bot: ../integrations/grok.md, segredo MCP só da Clara, usuário configura aplicativo nativo e faz teste real. grok.com não substitui o bot.
- Nox: Supabase no Work, funções central.*. Fonte administrativa system; cliente individual Equipe é etapa separada.
- Vega: preservar MCP/rotinas, testar ferramentas Equipe antes de migrar segredo.
- Push: ativar no aparelho, iPhone pela PWA na Tela de Início, testar recebimento/silêncio/assinatura. Caixa interna independe do push.
- Axial: resumo mínimo autenticado, sem clonar CRM/banco. Modelo/runner opcionais; nada pago ativado automaticamente.
