# Revisão visual — quadro e conversa

Pedido de 18/10/2026: revisão geral, com foco na Equipe, menos texto/poluição e inspiração Trello + chat. Preservar funções, privacidade e aprovação; não inventar atividade dos bots.

Referências pesquisadas: [Trello: quadro/listas/cartões](https://trello.com/guide/trello-101), [Linear: projetos e hierarquia](https://linear.app/docs/projects), [Slack: conversas em threads](https://slack.com/help/articles/115000769927-Use-threads-to-organize-discussions), [NN/g: ícones com rótulos](https://www.nngroup.com/articles/icon-usability/), [NN/g: detalhes sob demanda](https://www.nngroup.com/articles/progressive-disclosure/), [WCAG: alvos de interação](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum).

Decisões: Quadro como entrada; colunas por estado verdadeiro do motor, sem arrastar para fingir execução/entrega. Cartão abre painel lateral com dono, próximo passo, critérios, anexos e conversa vinculada. Chat com lista de projetos e mensagens; criação em diálogo, participantes/anexos em seletores legíveis. Conexões/rotinas/pessoas ficam acessíveis sem disputar atenção com o trabalho diário. Aprovações mantêm conteúdo/destino/versionamento visíveis antes do ok.

Identidade: preto/grafite, branco e roxo de destaque, ícones consistentes, avatares com iniciais, títulos legíveis e espaços úteis; cor não é a única indicação de status. Evitar parágrafos técnicos, formulários permanentes e seletores multiple nativos. Celular com uma coluna/filtros claros, sem página mais larga que a tela. Testar teclado, loading/erro/vazio, ações reais e acessibilidade dos diálogos.

Revisão das demais áreas: preservar a navegação e arquitetura atuais, cabeçalhos concisos, criação/importação sob demanda, arquivos com prévia/tipo e notificações com preferências recolhidas. Não ativar novas integrações por uma mudança de aparência.

Desempenho: expor o modo desempenho já persistido por aparelho, remover efeitos decorativos e usar lista no Cérebro quando ativo. Preservar todas as ações. Navegação: registros abrem no detalhe estável; notificações da equipe abrem o trabalho e sua aprovação. Conferir em desktop e celular. Não prometer desempenho medido no PC do trabalho sem teste nesse aparelho.

## Implementado e validado localmente

Quadro com quatro colunas, pesquisa/projeto, cartões e painel de conversa/detalhes; chat por projeto, respostas, participantes e anexos em diálogos. Pessoas, conexões, rotinas, entregas e aprovação individual/em seleção mantêm as regras existentes. A criação fica sob demanda; controles usam o Radix já instalado. Sem biblioteca visual nova.

Notificações têm preferências em diálogo, checkbox roxo e seletor de horário compatível com o site. Finanças têm lançamento/importação em diálogos, sem conexão bancária nova; CSV mantém conferência e deduplicação. Biblioteca e Carreira têm estados vazios claros. Menu/identidade preservados, com rolagem útil em telas baixas.

Modo desempenho acessível também pelo menu móvel, persistido por aparelho; sem céu/partículas/animações, e sem montar canvas do Cérebro. Corrigida a pausa de animação que deixava entradas de painéis transparentes. CSS antigo no cache de desenvolvimento foi identificado: cache persistente do Turbopack desativado apenas no desenvolvimento, sem alteração no cache de produção. Worker antigo do localhost é removido no desenvolvimento; produção preservada. Zoom do navegador volta a ser permitido.

Feed, agenda, tarefas, busca rápida, lembretes/ICS, Mural e histórico abrem o detalhe estável. Avisos antigos com entry_id também recebem destino exato; avisos de trabalho/entrega abrem painel e aprovação filtra o trabalho solicitado, incluindo busca por ID fora dos cem cartões recentes. Conversa vinculada não compartilha registro privado e perde acesso para IA se a privacidade mudar.

Verificações: 143 testes em 26 arquivos, tipos, lint e build de produção passaram. Navegador local conferiu quadro/conversa/painel/formulários, controles de horário, detalhe pelo início e celular 390×844 sem largura excedente. Cérebro em desempenho: zero canvas montado. Dados de demonstração fictícios, ações externas desabilitadas. Publicação e testes autenticados devem ser registrados no progresso após o build remoto.

Limites: nenhum benchmark no PC físico do trabalho ou teste de push em telefone real. Não afirmar que bots/modelo/Google/bancos foram conectados por esta revisão visual. Continuam exigindo configuração, consentimento e testes reais próprios.
