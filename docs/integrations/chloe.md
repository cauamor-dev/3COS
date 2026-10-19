# Chloe com Groq Free

Groq fornece o modelo da Chloe. Grok Bot é outro produto, usado pela Clara.
O guia do proprietário está em `/conexoes/ativar`, com status sem mostrar segredos.

## Etapa do proprietário

1. Entrar em `https://console.groq.com/keys`, revisar os termos e conferir o plano Free em Settings → Billing. Não habilitar Developer ou adicionar pagamento.
2. Criar uma chave e cadastrá-la somente como `GROQ_API_KEY` no ambiente do projeto Central na Netlify. Marcar Contains secret values, manter os escopos permitidos (Builds e Functions) e preencher Production. Os controles All scopes e mesmo valor para todos os contextos ficam desabilitados para segredos. Não fazer upgrade nem remover a proteção. Nunca usar prefixo `NEXT_PUBLIC_`.
3. Após conferir o plano, definir `CHLOE_FREE_TIER_CONFIRMED=1`, ou pedir ao operador para registrar a confirmação verificada. Não enviar chave ou captura do segredo.

## Avaliação e ativação técnica

```powershell
npm run ai:status
npm run ai:evaluate
npm run ai:activate
```

O operador usa a CLI Netlify já autenticada para metadados e configuração não secreta. A chave Groq nunca é recuperada pelo script. Os vinte casos com dados fictícios são executados no próprio host Production por POST `/api/internal/chloe-evaluation`, protegido pela credencial interna de cron existente. O endpoint não aceita prompts arbitrários nem muda a pausa da equipe. Pedidos anônimos são recusados antes de acessar banco ou provedor.

A avaliação exige pelo menos dezoito acertos e todos os casos críticos aprovados. Os recibos sanitizados são guardados em `operation_receipts` por caso, chave/modelo/código e valem por sete dias. Não contêm chave, dados pessoais ou resposta integral do modelo. Casos concluídos não são repetidos na retomada. Em cota/erro, interrompe sem trocar de provedor. Relatório local em `.local-reports`, ignorado pelo Git.

`activate` consulta os recibos no servidor e recusa se faltarem casos, aprovação ou correspondência do código. Configura os dois níveis com o mesmo modelo avaliado e vincula a aprovação à identidade da chave/modelo/código. Troca desses elementos invalida o vínculo. `prepare` somente preenche configurações ausentes; não cadastra chave nem liga IA. O script local antigo `chloe:evaluate` fica disponível apenas para desenvolvimento com fixtures, sem retirar segredos do host.

Após alterar ambiente, é necessário **build em contexto Production**. Promover um branch deploy não transforma seu contexto e não incorpora uma chave cadastrada somente em Production. Seguir a validação do release, depois `CENTRAL_RELEASE_VALIDATED=1` e `node scripts/netlify-release.mjs cloud-production`; conferir estado/contexto e perguntar no host definitivo. Não usar o `prepare` geral do release para ligar IA, pois ele restaura bloqueios de avaliação.

O padrão preparado é `openai/gpt-oss-20b`; 120b exige avaliação própria antes da troca. Não há provedor pago de reserva ou tentativa automática após falha. Tetos locais: cem chamadas e cem mil tokens por dia, com reserva antes da chamada e conciliação uma vez. Esses tetos não substituem a confirmação do plano Free. Anotar e consultas por regras continuam disponíveis na cota.

Perguntar usa ferramentas de leitura. Anexos nesse modo são recusados sem criar registro nem enviar arquivo ao modelo. Anotar preserva texto integral. Dados privados e histórico vinculado a registros são filtrados antes do contexto.

Para desligar: `node scripts/chloe-setup.mjs disable`, seguido de redeploy Production. Não muda a pausa nem o dispatcher da equipe.

Referências: [planos Groq](https://console.groq.com/docs/billing-faqs), [cotas](https://console.groq.com/docs/rate-limits), [segredos Netlify](https://docs.netlify.com/build/environment-variables/secrets-controller/).
