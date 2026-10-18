# Executor técnico

`npm run runner:inspect` verifica a autenticação oficial ChatGPT e a configuração, sem executar um modelo. `runner:once` exige `CENTRAL_RUNNER_ENABLED=1`, cliente próprio, raiz explícita no PC pessoal e ação `code` no trabalho. Nenhum serviço persistente é instalado. Não ativar no PC do trabalho por inferência.

O runner usa worktree, lê instruções locais, pede testes e preserva relatório/checkpoint. Ambiente filho não recebe tokens da Central, service_role, chaves de API ou segredos de deploy. A comunicação com a Central fica no supervisor. Relatório em caminho local não é entrega acessível: requer revisão/upload antes de concluir.

Não executar a especificação como comando shell. O único programa aceito é o CLI oficial configurado e autenticado pelo ChatGPT; nenhum fallback de API paga. Validar quota da assinatura e adicional desligado antes de ativar. Pausa, revogação ou perda de posse interrompem heartbeat/novos efeitos.

Cursor permanece assistido na assinatura existente até comprovar Cloud Agents oficial com limite de gasto extra zero. OpenCode é opcional: servidor loopback, autenticação e modelo sem gasto novo; não expor porta à internet. OpenDesign/Blender não fazem parte do caminho obrigatório.
