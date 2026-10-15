---
name: 3c-os
description: Memória, agenda, tarefas e Mural compartilhados entre ChatGPT e Claude (3C OS, antes chamado Central 3C), acessados pelo plugin Supabase. Use sempre que o usuário falar de projetos, trabalho, faculdade, cursos, carreira, compromissos, prazos ou lembretes, pedir para salvar/lembrar/agendar algo, ou perguntar o que tem hoje ou o que há de novo em uma área.
---

# 3C OS via plugin Supabase

3C OS (antes Central 3C) é o ambiente pessoal e a fonte única de contexto do Cauã, compartilhada com o Claude. Ele vive no projeto Supabase **central-3c** (ref `lmxnjbplfloezrfomrss`).

## Regra de ouro
Use o plugin **Supabase** com `execute_sql` **somente** para chamar funções do schema `central`. Nunca rode INSERT, UPDATE, DELETE, DDL ou SELECT direto em tabelas.

## Ler
- Início de conversa sobre projetos/trabalho/estudos: `select central.briefing();`
- Áreas: `select central.listar_areas();`
- Uma área: `select central.ler_area('axial');`
- Registro completo (quando vier truncado=true): `select central.ler_registro('<id>');`
- Busca: `select central.buscar('deploy vercel', p_area => 'axial');`
- Agenda (padrão: hoje + 7 dias): `select central.ver_agenda();` ou `select central.ver_agenda(p_de => '2026-10-20', p_ate => '2026-10-27');`
- Tarefas: `select central.listar_tarefas();` (`p_status => 'concluidas'` ou `'todas'`)

## Gravar (sempre com p_fonte => 'chatgpt')
- Novo registro: `select central.salvar_registro(p_titulo => '...', p_conteudo => '...', p_area => 'axial', p_tipo => 'decisao', p_tags => array['deploy'], p_fonte => 'chatgpt');`
  Tipos: decisao, progresso, contexto, tarefa, nota, ideia. Se a área não existir, é criada (informe p_area_nome e p_area_tipo).
- Resumo da área: leia antes com `central.ler_area` e envie o texto completo mesclado: `select central.atualizar_resumo(p_area => 'axial', p_resumo => '...', p_fonte => 'chatgpt');`
- Evento: `select central.salvar_registro(p_titulo => 'Prova de Grafos', p_tipo => 'evento', p_area => 'faculdade-grafos', p_inicio => '2026-11-03T19:00:00-03:00', p_fim => '2026-11-03T22:30:00-03:00', p_local => 'PUC Betim', p_lembrar_em => '2026-11-03T08:00:00-03:00', p_fonte => 'chatgpt');` Repetição: `p_recorrencia => 'semanal'` (diaria, semanal, mensal, anual).
- Tarefa: `p_tipo => 'tarefa', p_prazo => '2026-10-20T18:00:00-03:00'`. Lembrete avulso ("me lembra amanhã às 9h"): tarefa com `p_lembrar_em`.
- Prioridade (alta, media, baixa): `select central.definir_prioridade(p_id => '<id>', p_prioridade => 'alta', p_fonte => 'chatgpt');`
- Concluir tarefa: `select central.editar_registro(p_id => '<id>', p_concluida => true, p_fonte => 'chatgpt');`
- Post no Mural (notícias, achados, resultados de tarefas agendadas): `p_tipo => 'post', p_area => 'noticias', p_links => '[{"url":"https://...","titulo":"Fonte"}]'::jsonb, p_imagem => 'https://.../imagem.jpg'`
- Datas sempre com fuso de Brasília (-03:00).
- Editar ou arquivar: `select central.editar_registro(p_id => '<id>', p_conteudo => '...', p_fonte => 'chatgpt');` ou `p_arquivado => true` (só se o usuário pedir).

Use aspas simples e escape `'` como `''` dentro dos textos. Escreva registros autossuficientes (o quê, por quê, próximos passos). Não salve senhas, tokens nem dados pessoais de terceiros. Responda em português do Brasil.
