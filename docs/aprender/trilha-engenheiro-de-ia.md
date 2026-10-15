# Trilha: de dev full stack a engenheiro de IA

Para quem já programa (C#/.NET, Angular, React, TypeScript, SQL) e quer trabalhar construindo produtos com IA. Cada etapa tem o que estudar, um projeto prático e como ele vira portfólio no próprio 3C OS.

Ritmo sugerido: 1 etapa a cada 3 ou 4 semanas, umas 5 horas por semana.

## Etapa 1. Fundamentos de LLM e prompts

- **Estudar:** o que é token, janela de contexto, temperatura, por que modelos "alucinam"; engenharia de prompts ([aula do 3C OS](engenharia-de-prompts.md)).
- **Recursos grátis:** curso "ChatGPT Prompt Engineering for Developers" (DeepLearning.AI); documentação de prompts da Anthropic e da OpenAI.
- **Projeto:** melhorar as regras e os prompts da Chloe com 20 casos reais seus, medindo quantos ela acerta antes e depois.
- **Portfólio:** um post no Mural com a tabela de acertos e o que mudou.

## Etapa 2. Chamar modelos pela API e usar ferramentas

- **Estudar:** API compatível com OpenAI, streaming, tool calling, saída estruturada (JSON Schema), limites e custos.
- **Recursos grátis:** docs do Groq e do OpenRouter (modelos abertos sem custo); cookbook da OpenAI; docs de tool use da Anthropic.
- **Projeto:** ativar a Chloe com uma chave grátis (`docs/setup.md`, seção 8) e comparar 3 modelos em 15 pedidos: acerto da ferramenta, tempo e limite diário.
- **Portfólio:** `docs/chloe-comparacao-modelos.md` com a metodologia e o resultado.

## Etapa 3. RAG: o modelo lendo os seus dados

- **Estudar:** embeddings, busca vetorial, chunking, re-ranking, avaliação de respostas com fonte.
- **Recursos grátis:** Supabase `pgvector` (já está no seu banco), curso "Building Systems with the ChatGPT API" (DeepLearning.AI).
- **Projeto:** busca semântica no 3C OS: gerar embeddings dos registros e permitir perguntas como "o que decidimos sobre o deploy do Axial?" com a resposta citando os registros.
- **Portfólio:** nova ferramenta `perguntar` para Vega e Nox, com testes.

## Etapa 4. Agentes e MCP

- **Estudar:** loop de agente (planejar, agir, observar), limites de passos, quando NÃO usar agente, Model Context Protocol.
- **Recursos grátis:** especificação do MCP (modelcontextprotocol.io), guia "Building effective agents" da Anthropic.
- **Projeto:** o servidor MCP do 3C OS já existe; crie uma ferramenta nova (por exemplo, `planejar_semana`) e uma tarefa agendada que a use.
- **Portfólio:** vídeo curto mostrando a Vega planejando sua semana pelo 3C OS.

## Etapa 5. Avaliação, custo e segurança

- **Estudar:** evals (conjuntos de teste para IA), LLM como juiz, prompt injection, dados sensíveis, observabilidade (logs de chamadas, latência, custo).
- **Recursos grátis:** OWASP Top 10 for LLM Applications; docs de evals da OpenAI e da Anthropic.
- **Projeto:** um conjunto de 50 casos para a Chloe rodando no `vitest` com provedor falso, mais um script que roda os mesmos casos contra o modelo real e gera um relatório.
- **Portfólio:** badge no README com a taxa de acerto atual.

## Etapa 6. Ajuste fino e modelos locais (opcional)

- **Estudar:** quando fine-tuning vale a pena (quase sempre depois de esgotar prompt + RAG), LoRA, modelos pequenos rodando local (Ollama).
- **Recursos grátis:** cursos da Hugging Face; Google Colab com GPU gratuita.
- **Projeto:** ajustar um modelo pequeno para classificar pedidos da Chloe com os exemplos coletados nas etapas anteriores e comparar com as regras.
- **Portfólio:** relatório de custo e acerto (regras x modelo pequeno x modelo grande).

## Como o 3C OS vira portfólio

- Ele é um produto real, usado todo dia, com MCP, API REST, banco com RLS, PWA, testes e deploy contínuo.
- Cada etapa acima adiciona algo mensurável. Registre no README (seção "Decisões técnicas") o porquê de cada escolha: é isso que entrevistador quer ouvir.
- Mantenha o repositório privado com dados reais; para mostrar, use o modo demo (`npm run dev:demo`) e os prints de `docs/prints/`.

## Vagas: o que costuma aparecer

"Engenheiro de IA", "AI Engineer", "LLM Engineer" e "Desenvolvedor full stack com IA" pedem, quase sempre: Python ou TypeScript, APIs de LLM, RAG, tool calling/agentes, avaliação e boas práticas de produção. Você já tem a parte de produção; a trilha cobre o resto.
