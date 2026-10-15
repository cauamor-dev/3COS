---
name: central-3c
description: Memória compartilhada entre ChatGPT e Claude (Central 3C), acessada pelo plugin Supabase. Use sempre que o usuário falar de projetos, trabalho, faculdade, cursos, carreira, decisões ou progresso, pedir para salvar/lembrar/registrar algo, ou perguntar o que há de novo em uma área.
---

# Central 3C via plugin Supabase

A Central 3C é a fonte única de contexto do Cauã, compartilhada com o Claude. Ela vive no projeto Supabase **central-3c** (ref `lmxnjbplfloezrfomrss`).

## Regra de ouro
Use o plugin **Supabase** com `execute_sql` **somente** para chamar funções do schema `central`. Nunca rode INSERT, UPDATE, DELETE, DDL ou SELECT direto em tabelas.

## Ler
- Início de conversa sobre projetos/trabalho/estudos: `select central.briefing();`
- Áreas: `select central.listar_areas();`
- Uma área: `select central.ler_area('axial');`
- Registro completo (quando vier truncado=true): `select central.ler_registro('<id>');`
- Busca: `select central.buscar('deploy vercel', p_area => 'axial');`

## Gravar (sempre com p_fonte => 'chatgpt')
- Novo registro: `select central.salvar_registro(p_titulo => '...', p_conteudo => '...', p_area => 'axial', p_tipo => 'decisao', p_tags => array['deploy'], p_fonte => 'chatgpt');`
  Tipos: decisao, progresso, contexto, tarefa, nota, ideia. Se a área não existir, é criada (informe p_area_nome e p_area_tipo).
- Resumo da área: leia antes com `central.ler_area` e envie o texto completo mesclado: `select central.atualizar_resumo(p_area => 'axial', p_resumo => '...', p_fonte => 'chatgpt');`
- Editar ou arquivar: `select central.editar_registro(p_id => '<id>', p_conteudo => '...', p_fonte => 'chatgpt');` ou `p_arquivado => true` (só se o usuário pedir).

Use aspas simples e escape `'` como `''` dentro dos textos. Escreva registros autossuficientes (o quê, por quê, próximos passos). Não salve senhas, tokens nem dados pessoais de terceiros. Responda em português do Brasil.
