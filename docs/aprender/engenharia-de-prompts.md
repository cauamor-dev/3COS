# Engenharia de prompts, na prática

Aula curta, com exemplos tirados do próprio 3C OS. A ideia central: um modelo de linguagem não lê sua mente, ele completa o texto que recebe. Quanto mais o prompt parece o começo de uma boa resposta, melhor a resposta.

## 1. As cinco peças de um bom prompt

| Peça | Pergunta que responde | Exemplo no 3C OS |
| --- | --- | --- |
| Papel | Quem o modelo é aqui? | "Você é a Chloe, assistente pessoal do Cauã dentro do 3C OS." |
| Contexto | O que ele precisa saber que não sabe? | "Agora é quarta, 14/10/2026, 10h (fuso -03:00)." |
| Tarefa | O que exatamente deve fazer? | "Use as ferramentas para agir: não diga que fez algo sem chamar a ferramenta." |
| Formato | Como a saída deve sair? | "Responda em uma ou duas frases confirmando o que foi feito." |
| Limites | O que não pode? | "Nunca compre nada, não crie contas e não preencha formulários." |

Abra `lib/chloe/agent.ts` e veja a função `systemPrompt`: ela tem exatamente essas peças.

## 2. Seja específico (o erro mais comum)

Ruim:

```text
Resume as notícias.
```

Bom:

```text
Resuma as 5 notícias abaixo para um dev full stack brasileiro.
Para cada uma: 1 linha do que aconteceu + 1 linha de por que importa para ele.
Ignore notícias de celebridades. Responda em português, sem introdução.
```

Por que funciona: diz para quem, quantas, o formato de cada item e o que descartar.

## 3. Dê exemplos (few-shot)

Modelos imitam muito bem. Dois ou três exemplos valem mais que um parágrafo de regras.

```text
Classifique o pedido em: lembrete, evento, tarefa, nota ou consulta.

"me lembra de beber água às 15h" → lembrete
"dia 20 tenho prova às 19h" → evento
"o que tenho amanhã?" → consulta

"preciso pagar o boleto sexta" →
```

Compare com `tests/chloe-command.test.ts`: os testes das regras da Chloe são, na prática, uma lista de exemplos. Bons exemplos servem para testar código e para ensinar modelos.

## 4. Peça estrutura quando a saída vai para código

Se a resposta vai ser lida por um programa, peça JSON e mostre o formato. Melhor ainda: use **ferramentas** (tool calling), como a Chloe faz. O modelo não escreve texto livre; ele preenche os parâmetros de uma função que o seu código valida.

```json
{ "name": "criar_evento", "arguments": { "titulo": "Prova de Grafos", "inicio": "2026-10-20T19:00:00-03:00" } }
```

Regra de ouro: **o modelo sugere, o código decide.** No 3C OS, quem grava é o `CentralService`, com validação Zod. Um modelo confuso não consegue salvar um evento sem data.

## 5. Contexto certo, não contexto máximo

Mais texto não é melhor. O briefing do 3C OS (`obter_briefing`) manda o perfil, as áreas ativas e os registros recentes, cortados (`truncado: true`). Se a IA precisar de mais, ela pede (`ler_registro`). Isso deixa o modelo focado e mais barato.

## 6. Deixe o modelo pensar (quando precisar)

Para problemas de raciocínio, peça os passos antes da resposta: "Primeiro liste as restrições, depois proponha a agenda." Para comandos simples, não: só deixa mais lento. É por isso que o roteador da Chloe (`pickTier` em `lib/chloe/llm.ts`) manda pedidos curtos para um modelo rápido e pedidos de planejamento para um maior.

## 7. Itere como engenheiro

1. Escreva o prompt.
2. Teste com 5 a 10 casos reais (inclua casos difíceis e ambíguos).
3. Anote onde errou e por quê.
4. Mude **uma coisa** por vez e teste de novo.
5. Guarde os casos como testes automáticos.

## Exercícios

1. Reescreva a instrução da tarefa agendada do vigia de preços (`docs/vigia-precos.md`) para também comparar com o preço da última semana. O que precisa entrar no contexto?
2. Escreva 5 frases que as regras da Chloe ainda não entendem (rode `npx vitest run tests/chloe-command.test.ts` com elas). Quais valem virar regra e quais devem ir para a IA?
3. Crie um prompt para a Vega gerar o resumo semanal da faculdade a partir de `ver_agenda` e `listar_tarefas`. Defina papel, contexto, tarefa, formato e limites.
