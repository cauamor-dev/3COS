# Chloe: como ela pensa (e o que dá para fazer de verdade)

A Chloe é a assistente do 3C OS, o "Jarvis" do Cauã. Este documento explica, em linguagem simples, como ela funciona hoje, como vai ficar com IA e o que é viável ou não.

## Hoje: sem chave de IA

O campo **"O que você quer hoje?"** no topo do Início já executa pedidos curtos usando regras em português, sem custo e sem depender de nenhum serviço:

| Você diz | Ela faz |
| --- | --- |
| "me lembra daqui a pouco de tirar o bolo" | tarefa com lembrete em 30 min |
| "dia 20 tenho prova às 19h" | evento na agenda |
| "preciso pagar o boleto amanhã" | tarefa com prazo |
| "anota: o cliente prefere azul" / "ideia: ..." | nota ou ideia na inbox |
| "o que tenho amanhã?" / "minha agenda essa semana" | responde com a agenda |
| "quero comprar um monitor, me avise quando estiver em promoção" | vigia de preço delegado à Vega |

Tudo tem **desfazer**. O código fica em `lib/chloe/command.ts` (regras) e `app/(app)/chloe-actions.ts` (execução), com testes em `tests/chloe-command.test.ts`. O microfone usa o reconhecimento de voz do próprio navegador, quando existe.

## Próximo passo: com IA gratuita

Com uma chave gratuita (Groq, por exemplo), a Chloe passa a entender pedidos livres ("reorganiza minha semana para eu estudar grafos") usando **ferramentas**: os mesmos comandos do 3C OS (criar, consultar, concluir, delegar). O modelo só escolhe a ferramenta e os parâmetros; quem grava é o próprio app, com as mesmas validações de sempre. As regras de hoje continuam como plano B quando a IA estiver fora do ar.

## "Várias IAs juntas": o roteador de modelos

Não é uma IA nova treinada do zero: é um **roteador** que manda cada pedido para o modelo aberto mais adequado.

```text
pedido ──► regras (instantâneo, grátis) ── entendeu? ──► executa
              │ não
              ▼
         roteador
          ├─ comando curto ........ modelo pequeno e rápido (ex.: Llama 8B)
          ├─ raciocínio/planejar .. modelo maior (ex.: Llama 70B, Qwen, GPT-OSS)
          ├─ áudio ................ Whisper (transcrição)
          └─ falhou/limite ........ outro provedor (fallback)
```

| Ideia | Viável? | Por quê |
| --- | --- | --- |
| Roteador por tipo de pedido | Sim, agora | Só código; usa modelos gratuitos já prontos |
| Fallback entre provedores (Groq → Cloudflare → OpenRouter) | Sim, agora | Mesma API compatível com OpenAI |
| "Ensemble" (dois modelos e um juiz) para decisões importantes | Sim, com moderação | Dobra o consumo; vale só para casos raros |
| Memória pessoal (perfil, histórico) no contexto | Sim | Já existe no 3C OS: áreas, resumos e registros |
| Ajuste fino (fine-tuning) de um modelo pequeno com o jeito do Cauã | Futuro | Precisa de centenas de exemplos bons e um pouco de GPU alugada |
| Treinar um modelo do zero | Não | Custa milhões e não ficaria melhor que os abertos |

## Delegação para Vega e Nox

A Chloe não substitui a Vega (Claude) nem o Nox (ChatGPT): ela **delega**. Um pedido que precisa de pesquisa ou trabalho longo vira uma tarefa com a tag `vega` ou `nox`, que eles leem na próxima conversa ou tarefa agendada. Quando eles salvam algo urgente (tag `alerta` ou prioridade alta), o Cauã recebe notificação na hora.
