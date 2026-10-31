# ADR-UI-001 — Integração do design Stitch (proposta de SOFIA, executada por MESTRE)

**Data:** 2026-10-31 · **Status:** CANDIDATA, aguardando revisão independente · **Issue:** #26

## Contexto
O projeto Google Stitch contém 12 telas de Vital Família, mas o `main` de Next.js expõe quatro áreas demonstrativas no arquivo `app/page.tsx`. A missão F02 mantém OCR, Google Auth e Neon em PRs separados e pendentes. A interface nova deve permitir revisão de design sem ativar nenhum serviço de saúde nem quebrar a demonstração existente.

## Decisão candidata
- Preservar **literalmente** a demonstração anterior em `/demo`, com código isolado da nova interface.
- Implementar a experiência de 12 telas no `/` com componente client-side, estado de navegação local, visual mobile-first e layout desktop.
- Centralizar o catálogo das 12 telas em `lib/vital-ui.ts` e reutilizar o tipo, a validação Zod, os registros fictícios e CSV do `lib/domain.ts`. Não duplicar políticas de backend.
- **Modo escuro** é uma variação do dashboard, não um sistema de dados separado.
- Usar tokens CSS sem dependências adicionais e estados de interface demonstrativos explícitos.
- Manter avisos de **dados 100% sintéticos; não destinado ao uso clínico** em todas as telas.
- Não introduzir persistência local, autenticação falsa, notificações reais, compartilhamento externo, OCR ativo ou chamadas a IA.

## Alternativas e trade-offs
- **12 rotas App Router:** bom para URLs e deep links, mas aumenta o acoplamento inicial às permissões/autenticação F02, ainda não aceitas. Adiar rotas reais para fase pós-ADR/UX.
- **Export HTML Stitch direto:** fidelidade alta potencial, mas código de terceiros pode introduzir scripts/solicitações e não preservar contratos de domínio. Preferimos reconstrução React declarativa e auditável.
- **Reescrever `app/page.tsx` sem fallback:** risco desnecessário de regressão; preservar em `/demo`.

## Critérios para considerar a implementação
1. Doze destinos navegáveis em uma única experiência; reuso de navegação e componentes.
2. Dados fictícios em todos os exemplos; novos registros de demo são mantidos **somente na memória da aba**.
3. Nenhum botão ativo promete login, WhatsApp, biometria, sincronização, diagnóstico ou alarme real.
4. Labels, foco e operação por teclado; testagem futura com leitor de tela e contraste.
5. Build, lint, typecheck, testes, audit e browser smoke apenas no GitHub Actions no SHA da branch.
6. Auditoria externa de qualidade/segurança e gate LÉO antes de integração à main. Sem deploy por inferência.

## Limite de evidência
Esta ADR é uma **proposta técnica produzida pelo mesmo assistente exercendo o papel SOFIA**. Não constitui parecer independente da agente SOFIA real. A revisão autônoma externa deve ser registrada antes de aprovação.
