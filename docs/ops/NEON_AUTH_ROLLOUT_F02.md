# F02 — Runbook Neon, Google Auth e implantação

BRUNO · Plataforma/DevOps/SRE · diagnóstico em 2026-10-27. **NO-GO para dados reais; staging somente sintético.** Este documento não autoriza execução das mudanças propostas.

## Escopo e fontes

Contrato [BRUNO](https://github.com/leon337/multiagent-collaboration-framework/blob/main/docs/agentes/BRUNO.md), lido pelo connector GitHub (blob `0988d67fb793792a578d0b069283b6e22f09f520`); [issue F02 #2](https://github.com/leon337/vital-familia-pwa/issues/2), aberta, A6–A9 pendentes. Baseline local `0ea480e8c0d08b20ae4b3abc8723d4b47873f433`. Inspecionados `lib/auth.ts`, `lib/backend.ts`, handlers `app/api`, `db/001_schema.sql`, `db/002_security_test.sql`, `tests/security.test.ts`, `.env.example`, `.github/workflows/{ci,cd}.yml` e [CI/CD](../CI_CD.md).

Somente os dois documentos `docs/ops/NEON_AUTH_ROLLOUT_F02.md` e `docs/ops/F02_GATE_MATRIX.md` são alterados na branch `feat/f02-infra-neon-auth-audit`. Nenhuma alteração Neon/Google/Vercel/main, leitura de valores de segredos, execução SQL ou npm/lint/test/build local. Consultas externas foram somente de leitura; configuração Auth vem do endpoint explicitamente redigido pelo provedor. Não foram consultados usuários, sessões ou dados clínicos.

## Evidência externa e diagnóstico

| Fonte consultada | Resultado observado | Implicação / limite |
|---|---|---|
| Neon `describe_project` | `patient-band-35892280`, PostgreSQL 17, `aws-sa-east-1`; histórico `21600` segundos | Janela configurada de 6h, não prova backup recuperável ou RPO/RTO |
| Neon `list_branches` | main `br-gentle-scene-b6cnurj2`; staging `br-polished-recipe-b6yh4cw2`, nome real `dev-vital-familia-20261027`, ambos ready e `protected=false` | Staging é filho de main, `init_source=parent-data`: clones podem copiar dados; nunca presumir base vazia |
| Neon `get_neon_auth_config` redigido, staging | Managed Better Auth; base URL `https://ep-shy-leaf-b6dt67xj.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth`; Google `type=shared` | Confirma a evidência inicial do MESTRE; não prova login/callback ou elegibilidade para produção |
| Mesma configuração | `trusted_origins=[]`, `allow_localhost=true` | Origem HTTPS staging ainda não explicitada; lista vazia não prova wildcard nem fluxo funcional |
| Mesma configuração | `email_password.enabled=true`, `allow_sign_up=true`; verificações de e-mail no ingresso/login e `require_email_verification=false` | Caminho de ingresso por senha permanece habilitado, contrário à intenção Google-only; precisa fechamento e testes negativos |
| Neon settings | `allowed_ips.ips=[]`, `block_public_connections=false` | Não há bloqueio público configurado; validar política de rede/TLS e credenciais mínimas. Não inferir conformidade de região isoladamente |
| Vercel `list_deployments(app=vital-familia-pwa, limit=2)` | Production READY `dpl_HrBB1ccW5VqvZUpRFQpbbwKmCpSF`, SHA baseline | [Inspeção](https://vercel.com/predix-ai-br/vital-familia-pwa/HrBB1ccW5VqvZUpRFQpbbwKmCpSF); READY não prova smoke, RLS ou gate A6 |
| GitHub connector runs do SHA | Lista vazia | Wrapper filtra eventos pull_request; não contradiz CI/CD em main. CLI `gh run list` falhou por conectividade; não há run ID/conclusão independente nesta auditoria |

O gate Vercel já opera conforme evidência fornecida e `docs/CI_CD.md`: check `chk_7af79b64-a318-4089-80b7-55d9794d2dc0`, production/deployment-alias, exige `Lint, tipos, testes, build e dependências` SUCCESS, timeout 600s. Não recriar nem substituir esse gate. Não foi revalidada sua configuração via API nesta execução.

## Bloqueios técnicos concretos

1. `actor()` exige sessão, mas não convite/allowlist de admissão. Com backend sintético ligado, qualquer usuário autenticado pode tentar consentir e gravar para si. Google-only também não resolve admissão: identidade Google não equivale a autorização MCF. SOFIA define política e RAFAEL implementa negação no servidor, inclusive APIs diretas; ocultar botão de signup é insuficiente.
2. CI atual executa Vitest com sessão mockada, lint/tipos/build/audit; não provisiona PostgreSQL nem executa `db/002_security_test.sql`. RLS existe no código, **não há evidência de RLS testado em CI cloud**. Não declarar A6 concluído.
3. `001` cria role/schema/tabelas sem mecanismo de versão; não é idempotente. Nenhuma aplicação no Neon foi comprovada. Login real, ownership, grants, TLS, migrations ledger e catálogo remoto não foram inspecionados.
4. `transaction()` rejeita superuser/BYPASSRLS, mas não ownership nem memberships perigosos. `app.actor` é variável definida pelo servidor, não identidade criptograficamente vinculada pelo banco: credencial SQL comprometida pode forjar contexto. Não expor DB ao cliente; verificar papel efetivo e privilégios herdados.
5. UI atual é demo em memória; integração UI autenticada/API permanece pendente. JSON autenticado de records não explicita `Cache-Control: no-store` como CSV; revisar headers/cache/CDN/browser e PWA. Não há auditoria de leitura/exportação persistente demonstrada.
6. Revogar grant/consentimento não recupera CSV ou resposta já concluída. Restauração de snapshot pode ressuscitar consentimentos/grants antigos; reconciliação de revogações é gate obrigatório.

## Sequência futura de ativação (não executada)

1. SOFIA fecha ADR: convite/allowlist server-side, Google shared versus cliente próprio, origens HTTPS exatas, domínio privado, papéis A/B/C, consentimento e retenção. LÉO recebe bloqueios; EMILY revisa. Nenhum dado real antes de A6/A7 e aceites específicos A9.
2. Operador autorizado confirma branch por ID, origem dos dados e ambiente Vercel. Reservar domínio estável de staging; rejeitar origens arbitrárias, wildcard de previews e redirects abertos. Configurar trusted origin exata e desabilitar localhost em ambiente remoto, após validação do mecanismo suportado.
3. Fechar ingresso email/senha e signup não autorizado no provedor conforme capacidades reais; implementar admissão no servidor independentemente do provedor. Testar login, callback, state/CSRF, logout, expiração/revogação, conta não admitida, métodos alternativos e acesso direto ao endpoint Auth. Não inferir callback concatenando URL: operador registra URI exata fornecida pelo Neon/Google. Google Console, consent screen, audiência/test users, scopes, redirect URIs, termos e propriedade do cliente shared não foram investigados; lacuna aberta.
4. Preparar branch Neon descartável **com fixtures somente**, derivada de baseline previamente verificada sem PHI. Não clonar produção real para CI. Registrar projeto/branch/parent/SHA/checksum SQL; denylist explícita dos IDs main e staging para jobs destrutivos. Branch Git não é branch Neon e nenhuma faz merge automático de schema/dados.
5. Em runner GitHub protegido, aplicar `001` uma única vez como migration owner; credencial separada da aplicação. Criar login mínimo com membership `vital_app`, sem ownership, CREATE, superuser, BYPASSRLS ou membership de owner. Separar migrações versionadas futuras em expand/backfill/validate/contract; drift ou versão já aplicada falham antes da alteração. Não reexecutar `001` às cegas, nem resetar branch compartilhada.
6. Executar testes SQL e HTTP da matriz. Aprovar somente com run URL + SHA + branch ID + assertions sanitizadas. Cleanup apenas da branch efêmera identificada, inclusive em falha; nunca excluir staging/main. Credencial de migração não entra no runtime Vercel e jobs de PR não confiável não recebem secrets.
7. Após gates, operador configura Preview/staging no Vercel com secrets isolados e domínio privado. Executa smoke remoto A/B/C. Mudanças em main, migração do alvo ou promoção production exigem fluxo governado separado; esta entrega não as executa.

### Execução SQL planejada exclusivamente no CI cloud

Exemplo para runner autorizado, com variáveis já injetadas pelo secret store; não imprimir URL, não usar `set -x`. Conexão migration aponta somente para branch efêmera; testar também a conexão real da aplicação em job separado. TLS deve validar certificado/hostname (`verify-full` ou configuração equivalente validada no driver), sem desabilitar verificação.

```sh
psql "$MIGRATION_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f db/001_schema.sql
psql "$MIGRATION_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f db/002_security_test.sql
```

`002` faz `BEGIN`, `SET LOCAL ROLE vital_app`, fixture `fixture-patient-a`, `fixture-patient-b`, `fixture-caregiver`, e `ROLLBACK`. Não testa login SQL efetivo nem OAuth. Criar job adicional com login runtime, testar contexto ausente, isolamento entre conexões do pool, spoof de actor/patient, revogação concorrente e owner memberships. Fixture SQL já contém medição artificial sem pessoa real; não adicionar fotos ou PHI aos logs/artifacts.

Consulta proposta de inspeção de metadados, sem linhas de usuários, a executar futuramente no CI:

```sql
SELECT current_user, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb
FROM pg_roles WHERE rolname = current_user;
SELECT c.relname, pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='app' AND c.relkind='r';
SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname='app';
SELECT r.rolname AS granted_role, m.rolname AS member
FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid
JOIN pg_roles m ON m.oid=a.member;
```

Revisar memberships transitivos e privilégios efetivos, não somente a saída direta. Esperado: três tabelas com RLS, FORCE em measurements; metadata sem FORCE deliberadamente para definer evitar recursão. Funções definer com search_path fixo e EXECUTE revogado de PUBLIC; runtime não é owner. Não usar owner como prova de isolamento RLS.

## Secrets: inventário sem valores

| Nome | Escopo planejado | Verificação permitida / responsabilidade |
|---|---|---|
| `DATABASE_URL` | Runtime staging sintético, login mínimo por branch | BRUNO/operador registra presença, ambiente e branch por metadados; nunca ler/exibir URI |
| `MIGRATION_DATABASE_URL` | GitHub Environment protegido, job de migração | Owner separado, aprovação de ambiente e auditoria de uso; nunca Vercel/browser |
| `NEON_AUTH_BASE_URL` | Runtime da mesma branch do banco | URL pública acima, não token; confirmar correspondência e ambiente |
| `NEON_AUTH_COOKIE_SECRET` | Runtime privado por ambiente | Secret aleatório 32+ caracteres conforme contrato atual; registrar somente presença/rotação/responsável |
| `APP_ORIGIN` | Origem HTTPS exata do staging | Alinhar backend, browser e trusted origins |
| `SYNTHETIC_BACKEND_ENABLED` | false no demo público; true só staging sintético autorizado | Não é flag de autorização clínica |
| Credenciais OAuth próprias, se aprovadas | Secret store do provedor | Operador configura sem leitura de valores pelo agente; shared atual não comprova necessidade de client secret na aplicação |

Presença/configuração efetiva dos secrets Vercel/GitHub não foi consultada. Não usar listagem que retorne valores, env pull, export de configuração, URL de conexão ou logs de headers/cookies/tokens. Não criar `NEXT_PUBLIC_*` para segredo. Rotação exige revalidar sessões/branch; não executar nesta entrega. Token pessoal Vercel não deve virar secret de Actions.

## Demo público e área privada

`https://vital-familia-pwa.vercel.app` permanece demo sem SSO, somente fixture/memória, backend desligado, Auth e records 503, Gemini 503. Área privada usa origem estável distinta, sessão server-side e admissão explícita antes de qualquer acesso; URLs definitivas ainda pendentes. Autenticação da Vercel pode proteger preview, mas não substitui autorização/RLS da aplicação.

Não relaxar o smoke público para ativar staging. CD atual valida status Vercel do SHA e depois domínio público fixo; smoke não amarra resposta HTTP ao SHA e modo workflow_dispatch pula confirmação do commit. Evolução futura deve anexar evidência de deployment/alias/SHA e smoke privado separado, preservando check existente. CI dispara em PR, push main ou dispatch; push só nesta feature branch não dispara CI automaticamente. Não disparar deploy manual.

## Backup, restauração e rollback

Histórico Neon observado: 6h; nenhum exercício de restore realizado, nenhuma garantia de RPO/RTO. SOFIA define RPO/RTO e retenção; BRUNO registra capacidade/plano efetivo antes de qualquer dado real. Janela de histórico não substitui backup independente; definir export criptografado, retenção, acesso mínimo, região e teste de recuperação sem incluir secrets/PHI em artifacts CI.

Procedimento futuro: registrar branch/LSN ou timestamp UTC pré-migração; confirmar ponto recuperável; restaurar em **nova branch isolada**, sem sobrescrever main/staging; verificar schema/checksums, contagens sintéticas, grants/RLS, identidades/Auth e todas as negações A/B/C. Medir duração e perda de eventos contra RTO/RPO aprovados. Reaplicar revogações/retiradas posteriores ao snapshot por trilha confiável; sem trilha suficiente, manter acesso privado desligado e grants negados. Não presumir que rollback DB restaure OAuth, cookies, secrets, endpoints ou config Vercel.

Em falha: congelar escritas privadas, manter demo disponível, desabilitar backend privado por operador autorizado; preservar evidência sanitizada. Rollback de app para deployment compatível com schema e secrets atuais; verificar elegibilidade do deployment (o último observado tem `isRollbackCandidate=false`). Não prometer rollback automático. Preferir correção forward para schema append-only; DROP/reset não é rollback seguro. Troca para branch restaurada exige aprovação e smoke novo; não reabrir acesso só porque deployment está READY.

## Handoff

- **SOFIA:** decidir admissão, Google shared/cliente próprio, topologia/domínios, modelo de backup e reconciliação de revogações. Risco P1 proposto: ingresso aberto; schema/role sem prova remota; restore que reativa grants.
- **RAFAEL:** implementar admissão no servidor e UI privada; fechar métodos alternativos; job SQL cloud + login real + pool/concorrência, migrações versionadas, cache no-store e auditoria de acesso/exportação. Não alterar gate demo para acomodar backend ativo.
- **EMILY:** revisar independentemente evidências por SHA e branch, cadastro não admitido, grants transitivos/definer, RLS real, revogação e restore; confirmar severidades P0/P1. Nenhum PASS A6/A7 por inferência.
- **LÉO/MESTRE:** receber lacunas e decidir gates com artefatos; alterações de serviços e ativação continuam fora desta entrega. Handoff documental, sem envio externo de mensagens aos agentes.
