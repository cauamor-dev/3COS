# Contrato proposto com o Painel Axial

O repositório privado e a URL do Painel existente foram confirmados. Não houve reconstrução, alteração de banco nem migração de seus dados para outro CRM. A Central já coordena trabalho e artefatos na frente Axial; o Painel continua dono de leads, etapas, propostas e finanças empresariais.

Integração mínima: cliente individual com área Axial somente; publicar um resumo autorizado e idempotente com identificador do período/origem, contagens de leads qualificados/propostas, impedimentos, próximos passos e links internos do Painel. Não incluir credenciais, dados bancários, caixa integral, contatos privados ou linhas financeiras pessoais.

Recepção disponível pela memória REST (`POST /api/v1/entries`, `external_id` por cliente) e Equipe (`equipe_mensagem`/`equipe_trabalho`). Quando o backend do Painel enviar, ele deve usar token seguro próprio; conexão nativa em outra IA não autentica o backend. Leitura futura pelo servidor da Central exige endpoint autenticado contratado e host fixo permitido, sem fetch arbitrário de URL fornecida por mensagem.

Antes de ativar: inspecionar o contrato real da API do Painel, escolher quem faz a coleta para não duplicar Clara/Rastro, executar um resumo de teste e confirmar acesso negado a áreas pessoais. Só então marcar a conexão verificada. Na ausência desse teste, a Central mostra a integração pendente e oferece o link do Painel.
