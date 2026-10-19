# Grok v2 — Clara é a única ponte

Fluxo aprovado por Cauã em 18/10/2026. Clara (antes Norte) coordena; Rastro cuida de vendas e marketing; Tereza (antes Forja) prepara projetos e executa QA; Atlas cuida de carreira e estudos. Téo está fora da automação. Lume/Pulso/Prumo/Campus ficam arquivados na Central; não excluir bots nem histórico da conta.

## Conexão da Clara

Guia autenticado em `/conexoes/ativar`. `npm run clara:prepare` prepara de forma idempotente dois registros sintéticos, um compartilhado e um privado, sem gerar token. O roteiro copiável da página manda a Clara chamar `equipe_diagnostico`, ler o compartilhado, comprovar a recusa do privado e salvar uma confirmação com o marcador lido. IDs e marcadores ficam no ambiente privado. O diagnóstico informa identidade, áreas concedidas e pausa; não comprova sozinho a integração nativa. Só marcar a conexão como validada depois de conferir a resposta real da Clara e o registro confirmado.

Na Central autenticada, Equipe → Conexões → gerar token para **Clara**, com somente Axial e outras áreas explicitamente autorizadas. Não selecionar Pessoal/Finanças. MCP remoto: `https://central3c-caua.netlify.app/api/mcp`, header `Authorization: Bearer <segredo individual>`. O segredo aparece uma vez; armazenar na configuração segura do destino, nunca em chat, arquivo de equipe ou Git. Usar a URL depois do release validado.

Servidor e banco recusam clientes Grok de outro bot. Não compartilhar o token com Rastro/Tereza/Atlas. Se o plugin for global à equipe Grok, não presumir isolamento: confirmar que só Clara pode usá-lo ou manter a ativação pendente. Não fornecer service_role nem credenciais legadas administrativas.

Teste: listar área concedida, negar área proibida, ler trabalho sanitizado, escrever mensagem como Clara e devolver entrega com origem real. Marcar somente capacidades comprovadas; teste local não é integração Grok.

## Semana atual

- Segunda ~09h: Rastro lê leads do Claude, procura primeiro no Gmail pessoal e depois no Axial, registra a conta onde encontrou. Se faltar, informa Clara; não inventa leads. Conferir as identidades das duas conexões Gmail.
- Terça ~09h: Rastro prepara três posts em rascunho. Postiz não autoriza publicação.
- Quarta ~09h: Tereza prepara pacote para Claude Code. Cauã constrói; Tereza testa quando avisada, com evidência. Pastas `entregas/norte` e `entregas/forja` mantêm os nomes.
- Quinta ~09h: Atlas entrega radar de IA, faculdade, carreira e ideias de projeto.
- Segunda, quarta e sexta ~17h: Clara consolida entregas, impedimentos, aprovações e próximos passos na Central.
- ~08h: aviso somente diante de pendência ou prazo em até três dias. Conferir rotina existente para evitar duplicação nos dias de resumo.

A Central espelha a operação; não cria rotinas Grok. Confirmar horários/fuso na conta antes de marcar como verificados. Teste do desenho: 19/10–01/11, meta informada de 80%; não criar evento externo automaticamente.

## Fila e aprovação

O trabalho mantém seu responsável (Rastro/Tereza/Atlas), mas a ponte de execução é Clara. Ela assume e reporta; mensagens têm autoria Clara/Grok. Entrega produzida por outro bot precisa de referência real, sem mensagem fingindo ser ele. Sem disparo externo comprovado: aguarda próxima rotina. Mensagem comum não cria trabalho.

Clara apresenta propostas com ação, conta, destino, conteúdo e anexos/versionamento. O ok vale somente para essa versão. Manter referência estável ao arquivo Grok `aprovacoes.md` durante a transição, sem duas aprovações independentes. Não declarar sincronização sem teste real. E-mail, contato, candidatura, publicação, compra, exclusão e alteração de calendário dependem do ok aplicável. Guardar recibo ou estado incerto; não repetir efeito às cegas.

Sheets, Drive e Postiz são apoio. Painel Axial mantém CRM e financeiro empresarial. Não duplicar coleta nem importar caixas/DMs/arquivos pessoais inteiros. Canais sociais e logins do portal/LinkedIn dependem do usuário.

Grok Bot é aplicativo nativo; não confundir com o chat grok.com. Nesta sessão há controle de navegador, mas não de aplicativos nativos. Conexão permanece pendente até configuração segura pelo usuário; não copiar cookies nem recorrer a endpoints privados.
