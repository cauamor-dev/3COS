# Central 3C — contexto e continuidade para o Cursor

Atualizado em **18/10/2026, horário de Brasília**. Este arquivo é público, sem segredos ou dados pessoais de registros. Comece por ele, `AGENTS.md` e `CLAUDE.md`; confirme o estado com `git status` e `git log -5 --oneline`. Documentação antiga pode descrever intenções como funcionalidades: sempre confira implementação e teste real.

## 1. Quem somos e o que estamos construindo

A Central 3C / 3C OS é o espaço pessoal do Cauã para organizar vida, projetos, trabalho, estudos e a colaboração entre IAs. É uma aplicação existente e usada diariamente, não um projeto para reconstruir do zero. O objetivo é ter memória compartilhada, tarefas, agenda, arquivos, decisões, entregas e aprovações num lugar só, acessível também pelo celular.

A Central organiza o trabalho. Cada IA continua funcionando no seu aplicativo; cadastrar um agente não cria uma sessão naquele aplicativo nem o aciona automaticamente. Conexões individuais permitem ler e registrar somente nos projetos autorizados. Nenhuma IA pode se fazer passar por outra.

Cauã é o proprietário, define prioridades e aprova efeitos externos. A interface deve ser eficiente, intuitiva, bonita e leve para um PC de trabalho fraco e uma PWA no iPhone. Não presumir que uma animação ou novo painel melhora a experiência. Reduzir texto e revelar detalhes quando necessários.

## 2. Identidade visual e regras de produto

- Preservar preto, branco e roxo, com toque estelar discreto, componentes shadcn/ui existentes, tipografia e arquitetura atuais.
- Equipe deve combinar um quadro de trabalhos, inspirado em Trello, com conversas vinculadas às entregas. Não clonar o visual de outra ferramenta.
- Ícones consistentes e títulos claros; evitar excesso de textos, cards, menus e emojis decorativos.
- Responsivo em 390×844 e 1440×900, sem rolagem horizontal da página. Abas e botões não podem ficar cortados.
- Modo desempenho e preferência de movimento reduzido devem preservar a estrutura e as ações, desligando efeitos caros.
- Feed e notificações devem abrir o registro exato, ou expandir seu conteúdo completo; abrir apenas uma lista e exigir procura manual não atende ao pedido.
- Mudanças grandes de produto/arquitetura: apresentar um plano concreto e esperar o ok. Correções e implementação já autorizadas podem prosseguir.
- Nada de gasto novo: sem upgrades, recargas, planos/API pagos, conta bancária intermediária ou Cloud Agent pago.
- Tudo externo — mensagens, e-mails, postagens, candidaturas, compras, alterações em outros aplicativos — depende do ok do Cauã para conteúdo e destino concretos.

## 3. Equipe, nomes e responsabilidades

| Identidade | Aplicativo | Responsabilidade | Conexão |
|---|---|---|---|
| Cauã | Central | Direção e aprovação | Login humano único |
| Chloe | Central + Groq | Assistente embutida: captura, organização e busca | Modelo gratuito ativo e avaliado |
| Nox | ChatGPT | Ideias, critérios de aceite e validação final | Preservar integração existente via Supabase no Work; não presumir MCP individual ativo |
| Vega | Claude | Especificação, revisão, testes e busca de bugs | Preservar MCP existente; validar ferramentas de equipe separadamente |
| Cursor | Cursor | Implementação, tarefas pesadas de código e testes | MCP individual preparado; token e teste nativo pendentes |
| Codex | Codex | Implementação e apoio à continuidade | Ferramenta existente; não substitui a identidade Cursor |
| Clara | Grok Bot | Coordenação e **única ponte Grok → Central** | Configuração/teste no aplicativo nativo pendentes |
| Rastro | Grok Bot | Vendas, marketing, leads e rascunhos | Trabalha em paralelo, entregue à Central por Clara |
| Tereza | Grok Bot | Arquitetura de projetos e QA | Trabalha em paralelo, entregue à Central por Clara |
| Atlas | Grok Bot | Carreira, estudos, radar de IA e projetos | Trabalha em paralelo, entregue à Central por Clara |

Norte/Forja/Lume/Pulso/Prumo/Campus são referências antigas: não reintroduzir nas rotinas ativas. Téo é apoio pessoal fora da automação. OpenCode é opcional, sem ativação solicitada.

Os agentes já existem em `agents`; não criar usuários Auth com e-mail/senha para bots. `integration_clients` associa cada token à identidade verdadeira, e `client_area_grants` restringe operações por projeto. `active`, `external_active`, presença de credencial e conexão comprovada são estados diferentes. Na conferência desta etapa havia **zero clientes individuais não revogados**; não confundir integrações legadas com esse cadastro.

Os papéis de Nox, Vega e Cursor foram atualizados no banco sem ativar executores ou conceder permissões adicionais. Os quatro Grok Bots estão cadastrados; somente Clara pode receber conexão MCP. Um MCP global compartilhado por todos os bots não atende ao isolamento solicitado.

## 4. Fluxo combinado pelo Cauã

1. Nox/ChatGPT transforma a ideia em objetivo e critérios de pronto.
2. Vega/Claude detalha solução, riscos, tarefas e plano de testes.
3. Cursor implementa em branch, executa verificações e registra evidências.
4. Vega revisa, procura bugs e testa; Cursor corrige os achados.
5. Nox faz a segunda avaliação e Cauã aprova a entrega e os efeitos externos.
6. Grok Bots fazem tarefas paralelas; Clara consolida entregas e impedimentos na Central.

O novo modelo de trabalho **“Ideia → implementação → revisão”** (`ai_delivery`) documenta essas passagens. É um fluxo **assistido**, não um orquestrador que abre e controla todos os aplicativos sozinho. Vincular trabalhos, conversas, decisões, arquivos e evidências. Um trabalho deve ter dono, próximo passo, entrega esperada e critério de aceite.

Clara mantém os resumos de **segunda, quarta e sexta**, conforme o contexto atual dos bots. Não inventar horários ou reativar rotinas antigas. Mensagens/menções não provam execução. Não duplicar o calendário nativo dos bots com cron na Central sem necessidade e autorização.

Leads e conteúdo devem permanecer como propostas/rascunhos até aprovação. O Painel Axial é separado: não copiar CRM/banco nem alterar proteção/acesso desse projeto ao mexer na Central.

## 5. Stack e mapa para trabalhar

- Next.js **16.4.1**, React 19.3, TypeScript, Tailwind 4, shadcn/ui, Motion, Zod e Vitest.
- **Leia os guias locais relevantes em `node_modules/next/dist/docs/` antes de programar.** Esta versão altera convenções conhecidas. `proxy.ts` substitui middleware; params/searchParams são assíncronos.
- Supabase: Postgres, RLS, Auth por magic link, Storage privado, Realtime, cron/Vault existentes.
- `app/(app)/`: páginas autenticadas; `lib/auth.ts`: proprietário permitido e contexto humano.
- `lib/central/service.ts`: núcleo das operações; `access.ts`: autorização; repositórios Supabase e memória; `schemas.ts`: contratos.
- `lib/central/operations.ts`: ferramentas compartilhadas por MCP/REST/Chloe.
- `app/api/mcp/`: conexão MCP; `app/api/v1/`: REST/OpenAPI.
- `lib/team/`, `lib/work/`, `app/(app)/team-actions.ts`: identidades, clientes, trabalhos, conversas, aprovações e execução.
- `components/team/`: quadro/chat/entregas/conexões. `components/shell/`: navegação, ambiente e Novo registro.
- `lib/chloe/`: interpretação e agente; `lib/notify/`: avisos; `lib/files/`: arquivos; `lib/finance/` e página Finanças: conferir implementação antes de prometer sincronização.
- `supabase/migrations/`: histórico aplicado; não reescrever migrações antigas. Mudança aditiva deve ter migração reproduzível e testes adequados.
- `docs/operations/release-recovery.md`: release/backup/login. `docs/integrations/`: conexões; `docs/CONTINUAR-NO-CURSOR.md`: este documento.

## 6. Estado verificado antes desta passagem

### Produção e autenticação

Produção canônica: **https://central3c-caua.netlify.app**.
Preview: **https://codex-evolution-preview--central3c-caua.netlify.app**.
Repositório público: **https://github.com/cauamor-dev/3COS**.
Base anterior desta entrega: commit `29548e9`, deploy `6ad57d27c1bb58bb8c6b838b`.

Houve erros de login por redirecionamento a Vercel/URLs imutáveis e limite de envio de e-mails. O callback e o proxy foram corrigidos para origens próprias exatas. Cauã confirmou acesso autenticado no host canônico. Não pedir e-mail repetidamente: SMTP padrão pode limitar a dois por hora. Não gerar links administrativos para contornar login. Não copiar código, link de acesso, cookie ou sessão para chat.

### Chloe: funcionando, com limites claros

- Groq Free foi conferido na página de cobrança correta; Grok Free é outro serviço.
- Modelo **`openai/gpt-oss-20b`** nos níveis rápido e inteligente. Outros modelos/provedores ainda não foram validados/ativados.
- Chave `GROQ_API_KEY` é segredo na Netlify, cadastrada pelo proprietário somente em Production. Não revelar nem retirar proteção para testar.
- Avaliação real em dados sintéticos: **20 casos, 19 aprovados e todos os críticos aprovados**. Um caso não crítico de evento não chamou a ferramenta esperada; não declarar 100%.
- Uma pergunta somente leitura foi enviada pela interface em produção e respondeu “conexão confirmada”. Nenhum registro foi solicitado nesse teste.
- Correções de busca lexical com filtro de privacidade, preservação de nota explícita e prazo de tarefa sem horário às 23h59 de Brasília.
- Limites configurados: 100 chamadas e 100.000 tokens/dia. A avaliação consumiu boa parte da cota de 18/10; não repetir chamadas por rotina.
- Sem fallback pago, sem recarga automática. `ai:status` inspeciona; `ai:evaluate` chama modelo; `ai:activate` exige aprovação dos casos.
- Aprovação é ligada a chave, modelo e hash do código em `lib/chloe/evaluation-sources.json`. Alterar arquivos dessa lista pode desativar a IA até nova avaliação. Não ligar flags para contornar isso.
- Antes destas alterações, passaram tipos/lint/build e **167 testes**. A entrega atual deve registrar sua própria validação ao final; não tomar esse número antigo como prova nova.

### Equipe e proteções

Existe controle de pausa, fila, trabalhos, conversas, entregas, autorizações por projeto, aprovação vinculada ao conteúdo e credenciais revogáveis. `CENTRAL_DISPATCHER_ENABLED=0`; controle global estava pausado. Não retomar silenciosamente. Configuração não implica operação contínua. APIs sem autenticação devem recusar acesso. Autoria vem do token, não de texto, user-agent ou parâmetro.

### Backups e privacidade

Backup privado e restauração em banco isolado já foram ensaiados (33 tabelas e objetos de Storage). Não existe garantia absoluta de nunca perder informação, PITR contratado ou cofre ponta a ponta. Backups/relatórios locais contêm dados sensíveis e **não são material para indexar ou ler com IA**. Último ensaio anterior à passagem foi registrado em 18/10 à noite, em `.private-backups/`; conferir metadados sem abrir conteúdo pessoal.

## 7. Arquivos preparados nesta entrega

- `.cursor/mcp.json`: servidor canônico com Bearer por variável `CENTRAL_3C_CURSOR_TOKEN`; **sem token no arquivo**.
- `.cursor/rules/central-3c.mdc`: regras do agente. `.cursorignore`: reduz indexação de segredos/artefatos; não é um sandbox e não bloqueia todas as ferramentas.
- `scripts/configure-cursor-token.ps1`: proprietário informa token em prompt oculto; salva apenas na variável de ambiente de seu usuário Windows. Essa variável é acessível a processos desse usuário, não é armazenamento cifrado.
- `/conexoes/cursor`: guia do acesso individual e teste. Equipe aceita o preset Cursor sem permitir conexão Grok a outro bot.
- `ai_delivery`: fluxo assistido, visível em Novo trabalho.
- Novo registro: opções de tipo agora quebram em linhas, sem ocultar Contexto/Post depois de Progresso.
- `/seguro` + navegação Área segura: formulário de nota privada, com visibilidade forçada no servidor, e lista de títulos de até 50 notas privadas do proprietário. Lista não carrega conteúdo das notas. Conteúdo abre pelo registro exato.
- Notas privadas são excluídas das ferramentas restritas das IAs, inclusive Chloe. **Não é cofre criptografado**; para senhas/códigos de recuperação usar gerenciador próprio. Administradores do banco continuam privilegiados. Não colocar credenciais em resumos de área ou anexos compartilhados.

Uma implementação local não é publicação. Confira o recibo do release e a seção de validação deste documento antes de afirmar que essas páginas estão em produção.

## 8. Conectar o Cursor — ação do proprietário

Pode começar **agora na versão existente**, mesmo antes da publicação do novo guia:

1. Abra a Central canônica já autenticada → **Equipe → Conexões → Conectar agente**. Nome: `Cursor · desenvolvimento`. Agente: **Cursor**.
2. Selecione inicialmente só **Validação operacional 3C**. Deixe “Permitir assumir trabalhos” desmarcado. O primeiro acesso permite ler/escrever nessa área e usar recursos de equipe/arquivos dela; não é somente leitura.
3. Gere acesso limitado. O token aparece uma vez e expira em 90 dias. Não usar chave Groq, service_role Supabase nem token da Clara.
4. Abra esta pasta do projeto no Cursor. No PowerShell do projeto execute:

   ```powershell
   powershell -File scripts/configure-cursor-token.ps1
   ```

   Cole **você mesmo** o token no prompt oculto. Não passar token como argumento, em print ou conversa. Não enfraquecer ExecutionPolicy; se o computador bloquear scripts, usar o editor de Variáveis de Ambiente do usuário Windows para definir `CENTRAL_3C_CURSOR_TOKEN` e reiniciar o Cursor.
5. Feche totalmente e reabra o Cursor para herdar a variável. Em Configurações → MCP (ou Tools & MCP, conforme versão), confira **central-3c**. Mantenha a aprovação de ferramentas.
6. Peça ao Cursor: “Use central-3c e chame equipe_diagnostico. Confirme identidade Cursor/fonte cursor e somente áreas concedidas. Leia apenas a área validacao-3c e salve um progresso sintético com ID externo único, descrevendo a leitura real. Retorne o ID confirmado. Não leia perfil, inbox, notas privadas ou finanças. Não faça ação externa.”
7. Confira autoria do registro na Central. Teste também recusa de um registro sintético de projeto não concedido e de um canário privado **sem dados pessoais**, preparado pelo proprietário. Interrompa se qualquer conteúdo indevido aparecer.
8. Só depois conceder os projetos necessários. Para assumir trabalhos, é necessário acesso com operação execute e controle global compatível; pausar/retomar e aprovar ações são decisões do Cauã. Desenvolvimento local pelo Cursor não exige executar a fila automaticamente.

Não há cliente Cursor criado nem teste dentro do aplicativo nativo comprovado por este documento. Sem token fornecido ao aplicativo, a configuração retorna erro de autenticação: isso é esperado, não uma conexão concluída. Revogar pela Central quando não necessário; remover variável local para eliminar a cópia neste PC. A API do servidor não precisa conhecer a variável do Cursor.

Referência oficial: [MCP no Cursor](https://cursor.com/docs/mcp). Configuração remota suporta headers por variável de ambiente; `envFile` só serve a servidores STDIO. Não instalar servidor ponte de terceiro sem necessidade.

## 9. Conectar Clara e testar os Grok Bots

1. Guia `/conexoes/ativar`, documentação `docs/integrations/grok.md`; fixtures sintéticas preparadas por `npm run clara:prepare`.
2. Gerar cliente **Clara**, inicialmente validação; projetos adicionais só com escopo explícito. Não reutilizar acesso do Cursor.
3. No aplicativo nativo Grok Bot, proprietário configura MCP **somente da Clara**: URL `https://central3c-caua.netlify.app/api/mcp`, Authorization Bearer com token individual no segredo do conector.
4. Se a conexão for global e compartilhada com todos os bots, parar: não atende ao requisito. grok.com aberto no navegador não é prova do funcionamento do bot nativo.
5. Usar o teste sintético da página: identidade real Clara, leitura concedida, recusa do canário privado e escrita com ID confirmado. Só então marcar como verificada.
6. Rastro, Tereza e Atlas mantêm seus nomes nas entregas, com Clara identificada como ponte; não simular que cada bot fez uma chamada direta que na verdade partiu da Clara.
7. Confirmar resumos segunda/quarta/sexta e primeira execução real antes de dizer que a rotina está funcionando.

## 10. Pendências para o Cursor, em ordem

### P0 — concluir acesso e conferir a entrega atual

- Fazer teste MCP real dentro do Cursor com o Cauã, sem exposição do token.
- Conferir o diff desta entrega e todos os checks, sem mexer nos dados pessoais existentes.
- Validar Novo registro com os oito tipos visíveis em celular/desktop, Área segura com teste sintético e limites de autorização, e seleção do agente Cursor.
- Publicar **um lote** após validar preview; conferir `/seguro`, `/conexoes/cursor`, login, APIs e Chloe no host canônico sem gastar cota desnecessariamente.
- Atualizar este documento com commit/release/checks reais e manter separados os estados preparado/configurado/testado/verificado.

### P1 — integração e segurança operacionais

- Ajudar o Cauã na configuração nativa da Clara e validar isolamento/autoria/escopo. Não marcar conectada apenas porque aparece na equipe.
- Validar push em aparelho real: permissão, assinatura, notificação recebida, link exato e horário silencioso. No iPhone, testar PWA adicionada à Tela de Início.
- Auditar exposição de anexos das notas privadas antes de oferecer upload na Área segura. Nesta primeira versão ela salva texto; não prometer proteção por herança sem implementar e testar.
- Mostrar status de conexões com evidências e último sucesso; identificar manualmente o que ainda não roda. Não alterar a chave Supabase geral para revogar apenas um cliente.

### P2 — desempenho e experiência

- Revisão geral solicitada: quadro/chat de Equipe, controles de notificações, checkboxes, selects e densidade. Parte já recebeu ajustes em commits anteriores; conferir cada tela antes de declarar concluído.
- Inspecionar implementação do modo desempenho e reduzir animação/canvas/blur/sombras/redraws quando ativo. Medir com CPU reduzida e celular; evitar efeitos novos caros.
- Testar links do Feed/notificações com muitos registros: chegar ao item certo e preservar retorno, foco e acessibilidade. Corrigir casos que ainda abram só a lista.
- Não recriar sistema de design, trocar de framework ou adicionar bibliotecas pesadas para resolver controles simples.

### P3 — finanças e outros conectores

- **Nubank e C6** são os bancos escolhidos. Não há sincronização automática comprovada. Pesquisar fornecedor/Open Finance e confirmar suporte, API, gratuidade contínua, frequência, retenção, escopo e consentimento. Teste grátis não é integração gratuita permanente.
- Nunca pedir senha bancária à Central/chat. Conexão somente leitura via consentimento oficial do banco/provedor. Distinguir conta, cartão, fatura, transferência e duplicatas; oferecer desconectar/revogar. Não disparar pagamentos.
- Se nenhuma opção gratuita for confirmada, apresentar importação manual de extratos como alternativa antes de contratar qualquer coisa. Não prometer automatização por scraping de internet banking.
- Google Calendar: definir primeiro leitura, assinatura ICS ou sincronização OAuth; tratar fuso e duplicidade, escopo mínimo, consentimento e revogação. Alterações externas dependem do ok.
- Sheets/Drive: conectar apenas documentos/pastas autorizados. Fazer propostas sem gravar em outros sistemas automaticamente. Guardar credenciais exclusivamente no servidor, nunca no Git.

### P4 — IA e melhorias futuras

- Outros provedores/modelos somente com chaves e gratuidade confirmadas; avaliar português, ferramentas, privacidade, limites e qualidade. Roteamento multi-modelo é desejo, não funcionalidade já ativa.
- Melhorar o caso de evento que falhou sem relaxar casos críticos. Nova avaliação só com cota disponível e alteração relevante.
- Sugerir melhorias após evidências de uso: caixa de entrada unificada, busca com fontes, estado de integrações, controle de custos/cotas, exportação e recuperação simples. Não abrir várias frentes antes de fechar P0/P1.

## 11. Testes, custos e publicação

Antes de entregar: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. Use `npm run dev:demo` para dados fictícios. Não ler dados pessoais para tirar screenshot. Novos testes devem verificar regra/risco, não copiar implementação.

Repositório público: nunca versionar `.env.local`, tokens, cookies, relatórios privados, backups, dump de banco ou dados de pessoas. Autor Git noreply indicado em CLAUDE.md, sem `Co-Authored-By`. Preserve mudanças do usuário e verifique git status antes de editar/commitar.

Netlify Free: alerta recebido de **50% dos 300 créditos**, ciclo 16/10–15/11. Produção custa **15 créditos por publicação**, previews/branches não cobram esse custo de publicação, mas tráfego/compute continuam consumindo. Ao esgotar, os sites da equipe podem pausar, inclusive outros projetos. Não ativar upgrade/recarga. [Regras oficiais](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/).

Release nesta instalação Windows: `node scripts/netlify-release.mjs cloud-preview`, depois `cloud-status` até Ready e validação real. Não usar o comando `prepare`: ele pode desligar flags já ativas. Para segredo Production-only, promover branch deploy não incorpora chave. Depois de validar, uma única publicação:

```powershell
$env:CENTRAL_RELEASE_VALIDATED = '1'
node scripts/netlify-release.mjs cloud-production
node scripts/netlify-release.mjs cloud-status
```

Confirmar contexto **production** no recibo. O ZIP de produção omite branch; adicionar branch main pode criar branch deploy incorreto. Build Linux usa adaptador Next explícito; CLI local Windows teve falha de Edge e não deve publicar `.next` cru. Não modificar o Painel Axial. Push main também pode acionar Vercel legado: verificar status se publicar mudanças ali.

## 12. Pedido inicial para colar no Cursor

> Leia AGENTS.md, CLAUDE.md e docs/CONTINUAR-NO-CURSOR.md. Este é um projeto existente: preserve o visual e não gere gasto novo. Confira git status e o que já está implementado. Comece por validar a conexão MCP central-3c com sua identidade Cursor, sem ler segredos nem dados privados. Depois conclua as pendências P0 e P1, registre evidências e explique o que precisa de mim. Clara continua a única ponte dos Grok Bots e tudo externo depende do meu ok. Não afirme que uma conexão funciona antes do teste real.

## Validação desta entrega

Nesta branch `codex/cursor-handoff`: tipos, lint, build e **169 testes em 34 arquivos aprovados**. Novo registro conferido em viewport móvel 390×844: oito tipos visíveis, quebrando em linhas; Área segura conferida também em desktop 1440×900. Preview Linux `6ad5814eaf1c1365d0b4d6c2` Ready, contexto branch-deploy. No preview autenticado, preset selecionou Cursor corretamente, sem gerar credencial. Uma nota sintética sem dados pessoais foi salva pelo formulário, confirmada no banco como private/manual/com proprietário e aberta pelo link do registro exato. O teste foi arquivado depois para não poluir suas notas. Testes automatizados confirmaram recusa de leitura/busca pela Chloe e rejeição de escrita por ator não humano. Nenhum arquivo do hash de avaliação Chloe foi alterado.

Publicação em produção ainda será conferida separadamente. A conexão nativa do Cursor e a da Clara dependem das etapas do proprietário descritas acima; nenhum token individual foi gerado nesta entrega.
