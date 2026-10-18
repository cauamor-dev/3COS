# Evolução 3C OS — relatório técnico

18/10/2026. Produção: https://central3c-caua.netlify.app. Hospedagem pública, login humano restrito ao proprietário e APIs autenticadas. Somente Central publicada; Painel Axial preservado.

## Arquitetura e comportamento

Reutilizados CentralService, operações, Auth/Storage e contratos legados. Next 16.4.1/React 19.3 mantidos; migrações aditivas, sem reset. Dependências de teste/formatação/adaptador fixadas no lockfile. Remotion isolado em tools/marketing, fora do runtime.

Cada chamada tem ator real. Privacidade aplicada antes de busca, contagem, briefing/exportação e agregação, inclusive no caminho administrativo e SQL. Privado fica fora das IAs; restrito exige concessão. Identidade deriva da credencial, nunca de header/query informando source. Clientes novos usam token individual com hash, concessões, expiração/revogação; credenciais legadas têm fonte fixa. SQL administrativo atribui system porque não comprova qual IA chamou.

Edições com revisão rejeitam sobrescrita concorrente. Histórico integral/restauração permitida; captura preserva original até 50 mil caracteres, sugere duplicatas sem unir/apagar. Complementar usa editor. Chloe separa Anotar/Perguntar/Equipe, contexto filtrado e referências; modelo desligado até chave gratuita, flags, quota e avaliação real. Busca/regras/captura funcionam sem API paga.

Agenda Lista/Semana/Mês, datas Brasília e links estáveis; editor de evento/tarefa, conclusão, recorrência, anexos e retorno. Notícias com controles por teclado e preferências; CSS sem animações e modo leve evitam conteúdo invisível.

Equipe: conversas por projeto/área, respostas/anexos, menções explícitas, trabalhos com dono/critério/próximo passo. Fila idempotente, posse 90s, heartbeat, fencing, limites concorrentes, recuperação e até três tentativas. Aprovação amarra ação/conta/destino/texto/anexos/hash/versão; lote atômico. Resultado incerto impede repetir efeito às cegas. Não há adaptador externo com envio irrestrito.

Clara é única ponte Grok, protegida em servidor e banco; Rastro/Tereza/Atlas mantêm responsabilidade de negócio. IDs/aliases e histórico preservados, antigos arquivados na Central, Téo fora da automação. Resumos seg/qua/sex ~17h e aviso ~08h condicional são espelho não verificado; nenhuma rotina nativa foi criada/duplicada. Gravar trabalho não acorda produto externo.

Notificações têm RLS por dono, sino/leitura/preferências, deduplicação e silêncio Brasília. O cron existente produz avisos; push opcional por aparelho, com texto discreto e posse de envio. Aceite do serviço não comprova recebimento/leitura. Sem aparelho cadastrado, não há entrega push comprovada; email/Telegram novos não ativados.

Arquivos: reserva/upload direto, conferência de objeto real, MIME/tamanho/SHA-256, biblioteca/link protegido e assinatura de dez minutos. Documentos/imagens até 10 MB, MP4 até 50 MB, teto conservador de 300 MB contando legados/reservas. Importação remota arbitrária desativada contra SSRF. Sete referências antigas catalogadas sem romper acesso; suas capacidades longas ainda não foram revogadas.

Carreira guarda fonte/data informada/aderência/lacunas/próximo passo; e-mails guardam só resumo/metadados selecionados. Não se inventaram vagas/contatos. Axial continua dono de CRM e financeiro empresarial: Central recebe trabalhos/resumos mínimos; contrato documentado, sem endpoint autenticado de resumo comprovado nas rotas inspecionadas, sem mudança no outro projeto.

Finanças pessoais: manual/CSV com prévia e correção, decimal e importação transacional idempotente. Coincidências entre arquivos geram aviso, sem eliminar despesas iguais legítimas. Sem banco conectado. Runner opcional desligado/sob demanda, worktree e ambiente filho sem segredos de serviço/deploy; Claude Code continua a construção do usuário.

Marketing executado: demo fictícia funcional, vídeo vertical 12s, capa, três peças e textos. MP4 realmente enviado/baixado na Central com hash igual. Caminho local sozinho não conta como entrega acessível. Enviar/publicar peças exige aprovação específica.

## Evidência e limites

- 138 testes/24 arquivos, lint/tipos/build aprovados. PostgreSQL isolado aplica migrações reais; Auth/Storage/Cron usam fixtures nesses testes, não contam como plataformas externas. Runner local passou a permitir só variáveis de runtime, excluindo inclusive credenciais futuras desconhecidas; autenticação oficial ChatGPT ainda confirmada por inspect, execução desligada.
- HTTPS produção: integração 9, arquivos 10, notificações 9; consulta real de privacidade do resumo 4. Evidências privadas ignoradas pelo Git.
- Navegador: captura longa, demo 390×844, reserva sem duplicação, Equipe/Notificações autenticadas e leitura de aviso. Usuário confirmou login real no preview.
- Claude e Nox leram/escreveram pela memória existente. Nox usou Supabase Work; nenhum plugin novo. Conversa Equipe individual e passagem Grok continuam não comprovadas.
- Auth/Vault configurados para Netlify e quatro cron preservados. APIs/arquivos/avisos aprovados; login humano definitivo aguarda quota SMTP (dois emails/hora), confirmada por logs. Texto de “um minuto” corrigido; não se enfraqueceu proteção.
- Backup final de 33 tabelas e onze objetos restaurado isoladamente com contagens/FKs/hashes. Todos os 175 registros originais preservados, conferidos por ID. Snapshot por tabela, não PITR; identidades mínimas sem senhas/sessões. Recuperação remota não executada.
- npm: zero vulnerabilidades de runtime. Advisory braces permanece no tooling, sem downgrade forçado; revisar atualização segura antes de builds não confiáveis.

Advisors Supabase: RLS sem política em tabelas internas é deny-all intencional ([0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)); pg_net em public é legado ([0014](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public)); is_member é lookup intencional de membership, anon revogado ([0029](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)); proteção de senha vazada não ativada no fluxo passwordless ([documentação](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)).

## Custos e operação

Gasto novo R$ 0. Supabase/Netlify Free verificados, sem cartão, upgrade, domínio comprado, recarga ou trial. Netlify compartilha quota com o Painel: agrupar deploys e não prometer capacidade ilimitada. Remotion local sem API paga; assinaturas não convertidas em APIs por cookies. Badge removido na configuração oficial da Central.

Execuções Central pausadas; dispatcher/modelo desligados. Pausar em Equipe impede novas aquisições/efeitos, sem desfazer ações já enviadas; rotinas externas pausam na origem. Revogar corta cliente individual. Guia em operations/release-recovery.md.

Intervenções inevitáveis: login definitivo após quota; MCP somente Clara no segredo do Grok Bot; ativar/testar push no aparelho; chave grátis/avaliação para modelo Chloe; runner no PC pessoal se desejado; contrato/teste de resumo do Painel e clientes individuais Equipe Vega/Nox. Tudo externo continua sujeito ao ok aplicável. Matriz completa em matriz-aceitacao.md.

Release concluído no main/branch, commit 5fe4529; deploy Netlify 6ad55647db55a9f3a40c5538. Vercel legado Ready/testado sem redirecionar segredos entre hosts. REST/MCP individuais e legados, privacidade e arquivo conferidos nos dois caminhos. Primeiro callback da função Vault para Netlify retornou 200 e cron original continuou succeeded. Cliente temporário Codex de validação revogado ao encerrar; 401 nos dois hosts comprovou efeito imediato, sem apagar histórico.
