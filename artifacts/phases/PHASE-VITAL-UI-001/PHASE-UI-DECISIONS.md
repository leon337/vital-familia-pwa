# Decisões verificáveis — VITAL-UI-001
1. LEANDRO solicitou execução real de papéis técnicos, não teatro de roleplay.
2. MESTRE reconciliou repo e abriu PR #28 isolado, sem merge.
3. SOFIA (papel exercido pelo mesmo assistente) produziu ADR candidata; revisão externa ainda não ocorreu.
4. RAFAEL (mesmo assistente) implementou 12 telas React e preservou a demonstração antiga em /demo.
5. RENATO (mesmo assistente) acompanhou GitHub Actions, corrigiu dois testes de cópia e confirmou PASS em lint/types/Vitest/build no SHA 6de6ff5.
6. Auditoria npm de produção no CI encontrou 9 vulnerabilidades, inclusive uma crítica. A issue #17 de F02 permanece aberta. Não aplicar --force nem dispensar audit.
7. EMILY (checagem interna, não independente): código novo não adiciona rede, sessão real ou PHI; conclusão: NO-GO por criticidade das dependências e E2E/auditoria externos ausentes.
8. LÉO: gate interno NÃO EXECUTADO — não emitir decisão em seu nome.
9. LEANDRO: autoridade final; nenhum merge, deploy ou dado médico real por inferência.
