# Vigia de preços

Como funciona, do pedido ao alerta no celular.

1. **Pedido.** No Início, diga à Chloe algo como *"quero comprar um monitor, me avise quando estiver em promoção até R$ 900"*. Ela cria a tarefa **Vigiar preço: Monitor** na inbox, com as tags `vigia-preco` e `vega` e o preço-alvo no conteúdo. A tarefa aparece em **Tarefas → Vigias de preço** e na faixa **vigiando** do Painel.
2. **Busca.** Uma tarefa agendada do Claude (Vega) roda todo dia, lê os vigias abertos, pesquisa os preços e salva o resultado no 3C OS.
3. **Alerta.** Quando a Vega salva um registro com a tag `alerta` (ou prioridade alta), o banco agenda a notificação na mesma hora (gatilho `entries_alerta_ia`), e o cron de lembretes envia por push, Telegram e e-mail em até 5 minutos.

## Prompt da tarefa agendada (copie no Claude)

Crie uma tarefa agendada no Claude (por exemplo, todo dia às 10h) com este texto:

```text
Você é a Vega, do 3C OS do Cauã. Use o conector do 3C OS.

1. Rode listar_tarefas e pegue as tarefas pendentes com a tag vigia-preco.
2. Para cada uma, leia o produto e o preço-alvo no conteúdo. Pesquise o preço atual em
   lojas brasileiras confiáveis (Amazon, Mercado Livre oficial, Kabum, Magalu, Pichau,
   site do fabricante). Ignore anúncios suspeitos, usados e vendedores sem reputação.
3. Salve um registro tipo post na área noticias com:
   - título: "<produto>: R$ <menor preço> na <loja>"
   - conteúdo: menor preço, loja, link, preço habitual (se souber) e se vale a pena agora
   - links com a URL da oferta e imagem do produto
   - tags: vigia-preco e, SÓ se o preço estiver igual ou abaixo do alvo (ou for uma
     promoção real, bem abaixo do preço habitual), a tag alerta
4. Se nada mudou desde a última busca, não salve nada para esse produto.
5. Nunca compre nada, não crie contas e não preencha formulários.
Responda em português, com um resumo curto do que encontrou.
```

## Dicas

- Para parar de vigiar, conclua a tarefa em **Tarefas**.
- O Nox (ChatGPT) também pode cuidar de vigias: crie a tarefa com a tag `nox` em vez de `vega`.
- Para o alerta funcionar, a migração `20261015080000_ai_alerts.sql` precisa estar aplicada (`npx supabase db push`) e pelo menos um canal de aviso ativo em **Conexões**.
