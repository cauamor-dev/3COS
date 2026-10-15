---
name: central-3c
description: Memória, agenda, tarefas e Mural compartilhados entre Claude e ChatGPT via conector Central 3C. Use sempre que o usuário falar de projetos, trabalho, faculdade, cursos, compromissos, prazos ou lembretes, pedir para salvar, lembrar, agendar ou registrar algo, perguntar o que tem hoje ou o que há de novo em uma área (ex.: Axial, Orion), ou mencionar algo que você não conhece.
---

# Central 3C

A Central 3C é a fonte única de contexto do Cauã, compartilhada entre Claude e ChatGPT. O ChatGPT só enxerga o que está na Central, então **não use a memória nativa do Claude para projetos, trabalho ou estudos**: grave na Central.

## Ler

- No início de conversas sobre projetos, trabalho ou estudos, ou quando o usuário citar algo que você não conhece, chame `obter_briefing`.
- Para uma área específica, chame `ler_area` com o slug (use `listar_areas` se não souber o slug).
- Use `buscar` para decisões ou contexto antigo. Se um registro vier com `truncado: true`, chame `ler_registro`.

## Salvar

- Quando o usuário pedir para salvar, lembrar ou registrar, ou ao fim de um trabalho com decisão, progresso ou contexto novo, chame `salvar_registro` sem pedir permissão e avise em uma linha o que foi salvo.
- Escreva registros autossuficientes: outra IA vai ler sem ver esta conversa. Título curto e específico; conteúdo em markdown com o quê, por quê e próximos passos.
- Tipos: `decisao`, `progresso`, `contexto`, `tarefa`, `nota`, `ideia`.
- Se a área for ambígua, pergunte; se o usuário não souber, use `inbox`.

## Agenda, tarefas e Mural

- "O que tenho hoje/na semana?" → `ver_agenda`. "O que falta fazer?" → `listar_tarefas`.
- Compromisso: `salvar_registro` com tipo `evento`, `inicio` (e `fim`, `local`, `recorrencia` se houver). Tarefa: tipo `tarefa` com `prazo`. "Me lembra de X às 9h": tarefa com `lembrar_em`.
- Concluir tarefa: `editar_registro` com `concluida: true`.
- Resultados de tarefas agendadas, notícias e achados: tipo `post` (vai para o Mural), com `links` das fontes e `imagem` quando houver.
- Datas sempre com fuso de Brasília (-03:00).

## Resumo vivo

- `atualizar_resumo` substitui o documento canônico da área. Use só quando algo mudar de verdade (escopo, stack, status, próximos passos).
- Leia a área antes e envie o resumo completo, preservando o que continua válido.

## Regras

- Nunca arquive nada sem o usuário pedir.
- Se o conector Central 3C não estiver disponível na conversa, avise o usuário para ativá-lo no botão + em vez de salvar na memória nativa.
