# Ajuste ao time Grok v2 — proposta para aprovação

Data: 18/10/2026. Estado: **aprovado pelo Cauã e implementado na Central; ativação nativa da Clara e teste no aparelho pendentes**.

A proposta abaixo fica como registro da decisão aprovada, incluindo Central + push sem gasto novo. Estado operacional e limitações estão em `implementation-progress.md` e `matriz-aceitacao.md`; não interpretar os trechos históricos “depende de ok” como nova solicitação de aprovação.

Fonte lida integralmente: `C:/Users/Caua/Downloads/contexto-grokbots-para-codex.md`, fornecida e contextualizada pelo Cauã. Esta atualização prevalece sobre os nomes, papéis e horários antigos do pacote inicial. Não implica aceitar como comprovadas conexões ou execuções descritas no arquivo.

## Comparação com o que foi implementado

| Tema | Implementação atual | Ajuste proposto |
|---|---|---|
| Equipe Grok | Oito cadastros: Norte, Rastro, Atlas, Forja, Lume, Pulso, Prumo e Campus; todos desativados na Central | Clara, Rastro, Tereza e Atlas como equipe atual; Téo fora da fila operacional. Preservar histórico e aposentar cadastros antigos sem apagar |
| Identidades | Norte e Forja ainda têm os nomes do pacote inicial | Migrar Norte → Clara e Forja → Tereza preservando os IDs e as referências históricas; aliases antigos apenas para rastreabilidade |
| Ponte | Documentação propõe credencial por bot | Apenas Clara recebe credencial Grok de integração. Demais bots não escrevem diretamente na Central |
| Papéis | Rastro verifica leads; Atlas pesquisa demanda; Lume/Pulso fazem marketing | Rastro assume vendas/marketing; Atlas carreira/estudos; Tereza projetos/QA; Clara coordenação e síntese |
| Calendário | Seis horários antigos, cadastrados como não verificados e inativos | Registrar a semana atual e distinguir informação do usuário de verificação na conta |
| Workflows | `axial_lead`/`weekly_review` apontam a Norte; `marketing_package` aponta a Lume | Atualizar responsáveis e encaminhar comunicação Grok exclusivamente pela Clara |
| Código | Runner Codex opcional preparado, desligado e não configurado | Claude Code continua sendo o ambiente em que Cauã constrói; nenhum bot desenvolvedor automático. Codex/Cursor/OpenCode somente quando solicitados |
| QA | Revisão genérica no fluxo anterior | Tereza testa após Cauã avisar que construiu, com evidência de teste e impedimentos |
| Aprovação | Hash de conteúdo/destino, decisão humana e consumo com posse já implementados | Clara apresenta propostas. Sincronizar propostas por ID/versão, sem tratar texto de bot ou aprovação em outro item como autorização |
| Notificações | Push/service worker, lembretes e canais opcionais já existem | Avaliar e ampliar o mecanismo atual somente após aprovação desta proposta |

Inventário confirmado no banco: zero clientes Grok não revogados; os oito cadastros Grok e os seis horários antigos permanecem inativos; execuções da Central pausadas. Nenhum bot ou rotina foi criado no Grok por esta implementação. Não excluir Téo ou bots antigos da conta.

Arquivos afetados pelo plano antigo: `lib/work/contracts.ts`, `docs/integrations/{grok,vega,axial-contract,README}.md` e os registros gerados por `20261018185852_team_engine.sql`. Migração já aplicada é história: a correção deve ser uma **nova migração aditiva**, sem reescrever a antiga.

## Plano de execução após o ok

1. **Cadastro e política no servidor.** Migrar nomes e papéis sem apagar registros. Separar “ativo no Grok” de “conexão Central verificada”. Impedir que Rastro, Tereza ou Atlas ganhem acesso direto de escrita por uma seleção na interface ou payload. Nenhuma concessão a Pessoal/Finanças por padrão. Téo fica fora da automação.
2. **Fila com dono e ponte distintos.** Manter o responsável de negócio (por exemplo, Tereza para QA) e registrar Clara como ponte Grok. Somente o cliente Clara pode receber e reportar essas passagens; autoria da mensagem será Clara/Grok. “Tereza produziu” precisa de referência real à entrega, nunca de uma mensagem fabricada em nome dela. Sem integração comprovada, mostrar “aguarda próxima rotina”.
3. **Calendário sem duplicar rotinas.** Inspecionar as rotinas atuais em modo de leitura e atualizar o espelho da Central. Não criar outro agendamento para aquilo que o Grok já faz. Horários aproximados ficam assim até serem conferidos; preservar fuso Brasília.
4. **Leads e projetos.** Preservar o envio de leads pelo Claude. Rastro procura primeiro no Gmail pessoal e depois no Axial, registra em qual conta encontrou e avisa Clara se faltar. Conferir a identidade das duas conexões antes de afirmar que são contas diferentes. Tereza prepara o pacote; Cauã constrói no Claude Code; Tereza executa QA depois do aviso. Atlas alimenta carreira/estudos sem duplicar coleta existente.
5. **Aprovações e ferramentas de apoio.** Apresentar conteúdo, conta, destino, anexos, versão e motivo na Central. O arquivo Grok `aprovacoes.md` continua como apoio durante a transição: sincronizar por referência estável, sem duas aprovações independentes e sem presumir acesso ao arquivo. Posts permanecem rascunhos; e-mail, contato, compra, exclusão e mudança de calendário dependem do ok aplicável. Sheets/Drive/Postiz apoiam a operação; não criar outro CRM nem mudar o Painel Axial.
6. **Conectar e testar somente Clara.** Usar a URL MCP canônica após validar a hospedagem, segredo individual armazenado com segurança, escopos mínimos e um teste sanitizado de ponta a ponta. Não colar token em chat, nota ou documento. A integração só recebe estado verificado depois de leitura, negação de acesso indevido, escrita e entrega reais. Não redistribuir token aos outros bots.
7. **Encerrar o release da Central.** Retomar arquivos, testes finais, preview e publicação já autorizados. A autorização para remover somente o bloqueio adicional Netlify da Central foi recebida; não precisa ser pedida novamente. Aguardar este ok de ajuste antes de mudanças grandes no fluxo e não alterar o Painel.

## Calendário a refletir

| Dia | Entrega |
|---|---|
| Segunda ~07h41 | Leads do Claude, preservando a rotina atual |
| Segunda ~09h | Rastro seleciona leads e prepara abordagens |
| Terça ~09h | Rastro prepara três posts; rascunhos, sem publicação |
| Quarta ~09h | Tereza entrega pacote para Claude Code; primeiro em 21/10 |
| Quinta ~09h | Atlas entrega radar de IA, faculdade e carreira; primeiro em 22/10 |
| Segunda, quarta e sexta ~17h | Resumo da Clara: entregas, bloqueios, aprovações e próximos passos |
| Diariamente ~08h | Clara avisa somente quando houver pendência ou prazo em até três dias |
| 19/10 a 01/11 | Período de teste do time; revisão em 01/11 e meta informada de 80% |

Conferir no Grok se a checagem das 08h ocorre literalmente todos os dias ou somente nos dias sem resumo. Não duplicar avisos da mesma pendência. Revisão de 01/11 não será marcada no Google Calendar sem aprovação específica.

## Proposta de notificações — também depende de ok

| Opção | O que oferece | Esforço estimado de implementação | Situação |
|---|---|---|---|
| Central | Sino, contador, lista lida/não lida e link para tarefa/agenda/aprovação | Médio | Nova caixa persistente; reutilizar eventos/fila, sem broker novo |
| Push no navegador e celular | Aviso do sistema, mesmo fora da tela do app quando suportado | Baixo a médio | Base já existe; faltam validação por aparelho e ajustes de tipos/preferências |
| E-mail | Resumo e avisos selecionados | Médio | Adaptador existe, mas disponibilidade gratuita e remetente devem ser validados antes de ativar |
| Telegram | Avisos no app e links para a Central | Médio | Código existe; conexão e destinatário não estão comprovados nesta execução |
| SMS/WhatsApp | Avisos por número | Alto e depende de serviço externo | Fora da primeira entrega; não há conector adequado nem gasto novo autorizado |

**Recomendação:** caixa de notificações na Central + push opcional por aparelho, sem novo serviço pago. Eventos: lembrete configurado de agenda/prazo, tarefa atribuída ao usuário, prazo próximo/atrasado, proposta esperando aprovação e entrega ou falha relevante. Não avisar a cada leitura, tentativa de pesquisa ou tick.

Preferências propostas: tipos habilitados, antecedência, horário silencioso e canais. Deduplicar por item/ocorrência/destinatário; marcar leitura; tratar permissão negada e assinatura expirada; mostrar “enviado ao serviço” sem inventar confirmação de leitura. No push, texto mínimo para não expor detalhes pessoais na tela bloqueada. A caixa interna continua disponível se o push falhar.

Push exige HTTPS e permissão do usuário. No iPhone/iPad, usar o app adicionado à Tela de Início em versão compatível. Fontes: [MDN — Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API), [MDN — Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API), [WebKit — Web Push](https://webkit.org/blog/13878/).

Não ativar canal ou enviar notificação de teste antes do ok correspondente. A preparação permite manter R$ 0 de gasto novo, com limites e sem fallback pago; não representa prova de entrega em dispositivo.

## Aceitação do ajuste

- Somente quatro bots operacionais atuais aparecem como time Grok; antigos ficam arquivados/históricos, Téo fora do fluxo.
- Outro bot ou identidade forjada não consegue escrever usando o contrato da Clara.
- Resumos seg/qua/sex e aviso condicional de 08h refletem as rotinas reais, sem novo agendamento duplicado.
- Pedido externo pendente não é enviado; mudar conteúdo/destino invalida aprovação anterior.
- A passagem Grok → Central → executor → entrega usa execução e autoria reais. A ponte Claude existente, já testada, não substitui esse teste.
- Se aprovadas as notificações: validar permissão, duplicação, fuso, recorrência, falha de canal e privacidade no aparelho; nenhuma promessa de entrega exata sem teste.

## Dependências preservadas

Instagram/LinkedIn no Postiz, logins do portal/LinkedIn e confirmação de conta Gmail continuam etapas externas do usuário. Não contornar login/CAPTCHA e não ativar canal social por inferência. Não criar automação de aniversário/revisão/calendário ou publicar peças sem solicitação aplicável.
