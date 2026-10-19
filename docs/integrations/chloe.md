# Chloe com Groq Free

Groq fornece o modelo da Chloe. Grok Bot é outro produto, usado pela Clara.
O guia do proprietário está em `/conexoes/ativar`, com status sem mostrar segredos.

## Etapa do proprietário

1. Entrar em `https://console.groq.com/keys`, revisar os termos e conferir que a conta está no plano Free. Não habilitar Developer ou adicionar pagamento.
2. Criar uma chave e cadastrá-la somente como `GROQ_API_KEY` no ambiente do projeto Central na Netlify, contexto All deploys. Usar os escopos disponíveis no plano Free; não contratar granularidade de escopos. Nunca usar prefixo `NEXT_PUBLIC_`.
3. Após conferir o plano, definir `CHLOE_FREE_TIER_CONFIRMED=1`. Avisar que concluiu, sem enviar chave ou captura do segredo.

## Avaliação e ativação técnica

Com a CLI Netlify autenticada no computador autorizado:

```powershell
npm run ai:status
npm run ai:prepare
npm run ai:evaluate
npm run ai:activate
```

`prepare` preenche somente configurações ausentes, sem cadastrar chave ou ligar a IA. `evaluate` lê a chave do host em memória e executa vinte casos com dados fictícios. O relatório fica em `.local-reports`, ignorado pelo Git. A avaliação exige pelo menos dezoito acertos e todos os casos críticos aprovados. Em erro de cota ou provedor, interrompe e guarda os casos concluídos; repetir o comando retoma o mesmo modelo, chave e código por até sete dias. Não simular resultado se faltar chave.

`activate` exige recibo aprovado, recente e correspondente à chave/modelo/código atuais. Configura os dois níveis com o mesmo modelo avaliado. Após ativar, publicar pelo procedimento de `docs/operations/release-recovery.md` e conferir uma pergunta real no host definitivo. Não usar o `prepare` geral do release para ligar IA: ele pode restaurar os bloqueios de avaliação.

O padrão preparado é `openai/gpt-oss-20b`. O candidato 120b precisa de avaliação própria antes de qualquer troca. Não há troca automática de provedor, tentativa automática após falha ou fallback pago. O runtime reserva cota antes da chamada, conta uma tentativa por chamada e concilia o uso reportado uma vez. Os tetos locais são cem chamadas e cem mil tokens por dia, com estimativa conservadora quando falta uso real. Esses tetos não substituem a confirmação do plano Free da conta. Ao atingir o limite, Anotar e consultas por regras continuam disponíveis.

Perguntar usa ferramentas de leitura; anexos nesse modo são recusados sem criar registro nem enviar arquivo ao modelo. Anotar preserva o texto integral. Dados privados e histórico vinculado a registros são filtrados antes de formar o contexto.

Para desligar: `node scripts/chloe-setup.mjs disable`, seguido de redeploy. Não muda a pausa global nem o dispatcher da equipe.

Referências: [planos Groq](https://console.groq.com/docs/billing-faqs), [cotas](https://console.groq.com/docs/rate-limits), [variáveis Netlify](https://docs.netlify.com/build/configure-builds/environment-variables/).
