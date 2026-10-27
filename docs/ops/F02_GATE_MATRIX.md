# F02 — Matriz de controles e gates

BRUNO · 2026-10-27 · [runbook/evidências](NEON_AUTH_ROLLOUT_F02.md) · [issue #2](https://github.com/leon337/vital-familia-pwa/issues/2). **Estado global: NO-GO para dados reais.** “Preparado” significa código inspecionado; nenhum teste OAuth/SQL/restore foi executado nesta auditoria. Severidades abaixo são propostas para revisão independente de EMILY.

## Controles de acesso e ingresso

| Controle | Evidência atual | Critério verificável para fechar | Responsável / risco |
|---|---|---|---|
| Google como método autorizado | Provider Google shared configurado | Login real, callback exato, logout e revogação; ADR sobre shared/próprio e Console | SOFIA/RAFAEL; P1 pendente |
| Bloquear email/senha e ingresso livre | enabled=true, allow_sign_up=true, verificação de e-mail=false | Método recusado na API do provedor; signup não admitido recusado mesmo com chamada direta | RAFAEL/operador; P1 |
| Admissão server-side | actor() só exige sessão | Conta Google não admitida não lê/grava/consente/compartilha; convite não concede acesso a outro paciente | SOFIA/RAFAEL; P1 |
| Origens/callbacks | trusted_origins=[], allow_localhost=true | Origem HTTPS exata aceita; origem hostil, redirect externo e localhost remoto recusados | Operador/EMILY; P1 |
| Identidade da sessão | getSession server-side, sessionDataTtl=0 | Cookie inválido/expirado/revogado recusado; user id nunca vem do corpo | RAFAEL/EMILY; P1 sem prova real |
| RLS e menor privilégio | 001 + teste 002 preparados | SQL cloud e conexão runtime passam, sem ownership/membership privilegiado | RAFAEL/BRUNO; P1 |
| Consentimento/grant | Policies e definer preparados | Retirada/revogação bloqueiam próxima requisição; novo consentimento não ressuscita grant | RAFAEL/EMILY; P1 |
| Cache/telemetria | CSV no-store; JSON records sem header explícito | Nenhuma resposta privada/foto/token em cache, SW, logs, artifacts; validar headers reais | RAFAEL/EMILY; P1 |
| Recuperação | history_retention_seconds=21600 | Restore isolado com revogações reconciliadas, RPO/RTO medidos | SOFIA/BRUNO/EMILY; P1 |

## Fixture e validação de três contas

Usar três contas Google de teste controladas, sem nomes/e-mails reais no relatório. Mapeamento privado entre conta e subject Neon; relatório só aliases A/B/C. `fixture-patient-a`, `fixture-patient-b`, `fixture-caregiver` são identidades **SQL sintéticas**, não subjects OAuth inventados. Para HTTP, usar os subjects reais das contas controladas em ambiente isolado e não publicá-los. Nenhum token, cookie, senha ou imagem pessoal em evidência.

A = paciente sintético; B = outro paciente independente; C = cuidador somente leitura de A quando concedido. A e B consentem separadamente. Fixture artificial de glicemia 100 mg/dL em `2026-10-01T10:00:00Z`, contexto jejum, conforme `db/002_security_test.sql`; pressão pode usar sistólica 120/diastólica 80, mesma data, contexto repouso. Nunca usar dados da mãe. Criar contas e fixtures é execução futura autorizada separadamente.

| ID | Cenário / ação | Resultado esperado | Evidência necessária / estado |
|---|---|---|---|
| T01 | Sem sessão, backend privado ativo | records 401; origem inválida nas escritas 403 | HTTP sanitizado; pendente |
| T02 | A/B/C fazem login Google admitido; conta externa tenta ingresso (reutilizar C antes da admissão) | Apenas admitidos alcançam APIs; negar senha/signup alternativo e callback hostil | Provedor + HTTP, sem tokens; pendente |
| T03 | A tenta ler/gravar antes de consentir | 403; zero persistência | HTTP + assertion SQL; pendente |
| T04 | A consente e grava fixture; B consente/grava outra | Cada um vê somente seus registros; POST válido 201 | Contagens/assertions sem payload pessoal; pendente |
| T05 | B força patient=A em GET e CSV; tenta actor/patient no POST | Leitura/exportação 403; campos extras 400; zero escrita cruzada | HTTP e teste SQL; pendente |
| T06 | C sem grant tenta ler A e B | 403; SQL zero linhas | pendente |
| T07 | A concede C; C lê/exporta A | 200 com fixture A apenas; B continua inacessível | pendente |
| T08 | C tenta escrever para A, alterar grant de A, UPDATE/DELETE/TRUNCATE SQL | Sem permissão; payload forjado 400 ou grant recusado/sem efeito conforme endpoint; nunca mutação de A | Assertions de estado, não aceitar qualquer erro como PASS; pendente |
| T09 | A revoga C, então C repete leitura/CSV | 403/zero linhas; não recupera CSV anterior | pendente |
| T10 | A concede novamente, retira consentimento, depois reconsente | A fica bloqueado enquanto retirado; grant antigo de C continua inválido após reconsentir; novo grant explícito libera | 002 cobre parte SQL; execução pendente |
| T11 | Logout/revogação/expiração; nova requisição usa cookie anterior | Sessão recusada; medir latência de revogação | pendente |
| T12 | Pool reutilizado A→B→C, contexto ausente, erro com rollback, acessos concorrentes com retirada | Nenhum contexto vaza; requisição após revogação negada; sem bypass | Teste integração cloud pendente |
| T13 | Login SQL real runtime, grants transitivos e tentativa de DDL/role privilegiada | Não owner/superuser/BYPASSRLS; sem CREATE/role escalation; tabelas/policies corretas | Catálogo sanitizado e assertions; pendente |
| T14 | Restore isolado de snapshot anterior a revogação | Acesso continua negado após reconciliação; RPO/RTO aprovados satisfeitos | Relatório do drill; pendente |
| T15 | Demo público / manifest / records / education / auth | 200 / 200 / 503 / 503 / 503; texto AMBIENTE DEMONSTRATIVO | CD atual cobre primeiros três; smoke adicional pendente |
| T16 | Privado no browser mobile, cache/logout/offline, OCR/upload | Sem PHI em cache; confirmação explícita antes de salvar; nenhuma foto em telemetria/CI | RAFAEL + EMILY; pendente A1–A4/A7 |

`002_security_test.sql` cobre consentimento ausente, isolamento B, falsificação de paciente, leitura concedida a C, escrita de C negada, UPDATE/DELETE/TRUNCATE negados, revogação e reconsentimento sem grant antigo. Não cobre OAuth, admissão, role LOGIN real, pool/concurrency, cache ou restore. CI existente executa Vitest com mock de Auth e **não** executa 002. Checklist não equivale a resultado PASS.

## Gates de promoção

| Gate | Estado nesta entrega | Evidência exigida / decisão |
|---|---|---|
| A0 arquitetura | Não verificado | ADR de SOFIA aprovado com origens, ingresso e recuperação |
| A1–A4 OCR/UX | Fora do escopo; não verificados | RAFAEL entrega fluxo câmera→extração→confirmação/fallback com fixtures sintéticas |
| A5 CI cloud | Pipeline existente; run deste documento não comprovado | URL run/SHA, lint/types/tests/build/audit SUCCESS; nunca notebook |
| A6 OAuth/Neon/RLS | **BLOQUEADO** | T01–T14, migração versionada e backup/restore; SQL real cloud |
| A7 privacidade/segurança | **BLOQUEADO** | EMILY sem P0/P1 abertos, retenção, eliminação/correção, auditoria, consentimento específico para imagens/terceiros |
| A8 entrega | Gate Vercel já opera segundo fonte inicial e docs; deployment READY observado | Review independente, gate LÉO, checks mesmo SHA, alias/deployment correlacionado e smoke demo + privado separado |
| A9 dados reais | **NÃO AUTORIZADO / NO-GO** | A6/A7 comprovados e aceites específicos; flag sintética não autoriza dados médicos |

## Pacote de evidência e continuidade

Cada execução futura registra UTC, alias ambiente, SHA, ID branch Neon, migration checksum, URL run/job e deployment, origem testada, assertions esperadas/obtidas e responsável. Artifacts contêm somente contagens/booleans/status HTTP; mascarar não basta para justificar upload de logs brutos. Falha de negação, mistura de branch, drift, owner no runtime ou revogação/restore inconsistente interrompe promoção e vai para EMILY/LÉO.

Handoff: **SOFIA** fecha decisões de admissão/domínios/OAuth e RPO/RTO; **RAFAEL** implementa controles faltantes e testes de integração cloud; **EMILY** audita resultados independentemente e confirma riscos. BRUNO entrega documentação e diagnóstico, sem reivindicar aprovação de outro agente. Commit/push não significam deploy nem fechamento dos gates.
