# F02 — EMILY recheck independente, MCF classe C

2026-10-27. Revisão estática; EMILY revisa, MESTRE governa. **NO-GO clínico/dados reais; NO-GO demo F02 anunciada com OCR funcional; GO restrito à manutenção da demo sintética existente em main, em memória e backend desligado.** Não autoriza deployment ou ativação. Nenhum P0/exploit crítico demonstrado; gates chamados P0 na matriz de aceite continuam abertos e não equivalem a vulnerabilidades P0 comprovadas.

## Escopo e evidência

Refs locais conferidas, sem fetch:

| Ref | SHA |
|---|---|
| origin/main | `0ea480e8c0d08b20ae4b3abc8723d4b47873f433` |
| origin/feat/f02-integrated-rc | `daf07eaa042cc7af2c3d43919e30ca409f266f85` |
| origin/feat/f02-neon-staging-ci | `88daec36e22fc9117c49b26bdb1aca1521e20ef3` |
| origin/test/f02-real-ocr-cloud | `fa7790749e8920b218bf239bd47532914fa4b91b` |

Comparados à base e entre si por objetos/diffs Git. Linhas abaixo são do SHA indicado: **I** = daf07ea, **B** = 88daec3, **R** = fa77907. B e R são entregas separadas: seu conteúdo não está automaticamente no candidato I. O diff 7fdfa8e→I contém dez arquivos, incluindo UI privada, adaptador Auth e CSP; verde anterior não valida essas mudanças.

Estados GH **informados pelo solicitante, não consultados nem revalidados**: integrado pré-privado `7fdfa8e` conhecido verde; CI do novo SHA em andamento; E2E real OCR run **40516964936 FAILED 4/4**, com Next chunk bloqueado por eval e observação falsa/insuficiente da resposta WASM. Patch R mais recente permanece sem sucesso comprovado. Link de rastreio fornecido pelo número do run: https://github.com/leon337/vital-familia-pwa/actions/runs/40516964936 . Sem logs baixados, a atribuição causal exata do eval ao app/harness permanece não estabelecida nesta revisão.

## Achados e correções mínimas

### F01 — P1: OCR em navegador continua reprovado/sem receipt válido (E01/E05)

**Evidência:** I `next.config.ts:2` agora permite img blob, worker self e wasm-unsafe-eval, mantendo ausência de unsafe-eval genérico. Corrige a incompatibilidade textual anterior, mas não prova execução. I `lib/photo-ocr.ts:23–28` depende de import dinâmico, worker, core e modelo locais. O run informado falhou 4/4. R `tests/browser/ocr-real.e2e.mjs:5–11` troca avaliação por CDP com `allowUnsafeEvalBlockedByCSP:false`; isso não corrige por si um chunk Next. Linhas 88–95 observam respostas em BrowserContext e 186 exige resposta `.wasm` observada ali: fetch de worker pode escapar dessa observação; ausência nesse array não prova WASM ausente. Não descartar um erro real de CSP como mero problema do observador.

**Fix mínimo:** identificar request/chunk e stack originais; corrigir incompatibilidade efetiva sem liberar unsafe-eval genérico; observar rede do worker por mecanismo que cubra seu target e sincronizar coleta antes de assert/attach. Manter reconhecimento de pixels reais como prova funcional independente da lista de assets. Não filtrar violações para produzir verde.

**Reteste cloud:** mesmo SHA integrado, build/headers de produção, quatro casos verdes, preview visível, valores/unidades exatos, edição desmarca confirmação, cancelamento não grava, fallback funciona; comprovar worker/core/modelo locais e zero tentativas externas. Acrescentar mmol/L, pulso ausente, imagem ambígua/reflexo/rotacionada, mobile e acessibilidade. R `playwright.config.mjs:17` bloqueia SW e só usa Chromium; não cobre PWA/offline/iOS nem área privada. CI verde genérico não substitui esses receipts.

### F02 — P1: Auth/admissão/IDOR sem prova operacional do conjunto privado (E03/E05)

**Evidência:** I `lib/backend.ts:8–14,18–40` deriva identidade da sessão, assina txid/ator e revalida admissão por transação. I `db/003_admission.sql:11–39` nega ator não admitido e paciente revogado; locks FOR SHARE coordenam UPDATE administrativo da admissão. I `app/api/auth/[...path]/route.ts:8–20` limita endpoints e força disableSignUp; não configura diretamente o provedor. I `lib/auth.ts:5–7` fixa host e caminho de **uma** branch Auth, sem validar correspondência com DATABASE_URL. I `lib/backend.ts:7` exige inclusive REAL_DATA_APPROVED para staging sintético: nome/uso de flag não é aprovação clínica nem prova de ambiente. Relatos de signup/senha upstream e origens permissivas em `docs/ops/F02_GATE_MATRIX.md:9–13` são pendências documentais, não catálogo atual observado.

**Impacto/gate:** não há IDOR demonstrado no código revisado; também não há evidência suficiente de login Google, revogação da sessão, upstream fechado ou mapeamento Auth/DB correto. Host fixo falha fechado em outro Auth legítimo, mas não prova que DB e Auth pertencem ao mesmo ambiente. Não trocar host silenciosamente para liberar restore/staging.

**Fix/reteste:** contrato aprovado por ambiente para origem, Auth e DB, com correspondência comprovada por metadados e callbacks exatos; separar habilitação sintética de aceite real. Provar diretamente no provedor senha/signup negados e política de provisionamento por convite compatível com login-only. A/B/C por OAuth real: não admitido e admissão retirada negados em consent/records/sharing; B força patient=A em JSON/CSV; C lê só com grant e nunca escreve A; callback/origem hostil negados; logout, cookie expirado/revogado e latência medidos. Testar duas conexões, pool A→B→C, rollback e revoke concorrente. `tests/private-ui.test.ts:3–6` e `tests/transaction.test.ts:3–6` usam mocks; não homologam SDK/pool/HTTP.

### F03 — P1: scripts antigos não constituem fronteira segura de migração/restore

**Evidência:** I `scripts/staging-migrate.sh:4–7` confia em nome declarado e flags, sem verificar host/projeto/branch real nem vazio completo. I `db/001_schema.sql:100–105` confirma baseline antes de incluir 003: falha de 003 deixa instalação parcial. I `scripts/staging-recovery.sh:5–9` aceita declaração de descartável e ausência de dois schemas como proteção suficiente para escrever no destino PG*. Não são seguros como guard contra alvo errado.

**Fix mínimo:** retirar esses entrypoints do procedimento autorizado ou fazê-los delegar a guard equivalente ao novo runner; migrações futuras forward versionadas, checksum/drift e transação aplicável, sem reaplicar baseline. **Não usar os scripts antigos para dados reais.** Testes negativos de alvo produtivo/nome falso, DB inesperado, erro em 003 e repetição devem abortar antes de escrita ou reverter integralmente.

**Recheck B:** `scripts/ops/F02-neon-staging.sh:5–8,16–53` exige runner/repo/ref/owner e identifica projeto/branch/endpoint por GET, host exato e TLS verify-full; `:66–81` exige baseline vazio e runtime mínimo; `:89–105` reúne 001/003 e grant numa transação. É avanço concreto. `.github/workflows/f02-neon-staging.yml:15–18,33–51` aceita apenas main/integration, Environment staging e checkout github.sha. Portanto **não executa a feature branch atual por design**; integrar/revisar antes do dispatch. Não remover guard para conseguir run. Environment/reviewers/proteções existem fora do YAML e não foram verificados. Variáveis GITHUB_* em shell não são sandbox contra operador que controla código/secrets; a fronteira é Actions/Environment e seus administradores.

### F04 — P1: recuperação clínica e revogações não demonstradas (E05)

**Evidência:** B runner `:82–86,126–145` restaura banco inicialmente vazio/schema e repete fixtures revertidas; dumps são temporários e removidos. Não é backup durável populado, restore de Auth ou reconciliação de revogações. I `docs/ops/NEON_AUTH_ROLLOUT_F02.md:94–100` registra janela observada de 6h, sem RPO/RTO comprovados. Não se reafirma esse número como limite atual do plano Neon Free: sem consulta externa autorizada, capacidade/quota/retention efetiva permanece não verificada. Plano gratuito/histórico curto não garante recuperação independente.

**Fix/reteste:** receipt do runner B no SHA integrado, depois plano de backup cifrado durável, retenção e responsáveis aprovados; restore sintético populado em alvo isolado, medindo RPO/RTO e preservando RLS/grants. Snapshot anterior a consent withdrawal/admission/grant revoke deve continuar negando após reconciliação; sem trilha confiável, manter acesso desligado. Não restaurar chave/estado Auth cegamente nem prometer recolher CSV já entregue.

### F05 — P2: disponibilidade, limites e observabilidade ainda incompletos

**Evidência:** I `app/api/records/route.ts:12–16` remove truncamento silencioso: JSON >1000 retorna 409 e CSV busca tudo em memória. Isso corrige E04 quanto à integridade, mas não entrega paginação exigida na matriz; export grande pode esgotar memória fora do timeout SQL. I `lib/backend.ts:23,31–32` limita pool/statement, mas advisory lock não tem lock_timeout explícito menor; não há circuit breaker de dependência, orçamento global de fila/HTTP ou limite de export em bytes. `db/003_admission.sql:43–52` impõe quota distribuída 120/min por ator, depois de sessão/conexão, sem conter abuso pré-auth. I `lib/photo-ocr.ts:12–14,27–30` checa megapixels após decode e só pode terminar worker após createWorker resolver: timer não interrompe imediatamente todas as alocações. `scripts/prepare-ocr.mjs:20–25` baixa assets versionados sem hash de bytes.

**Fix/reteste:** paginação estável (measured_at,id), export com orçamento/streaming ou falha explícita sem arquivo parcial, fila e timeouts limitados, circuit breaker ou justificativa de controle equivalente; não sugerir retry automático ilimitado. Hash manifest dos assets. Fixtures 999/1000/1001+, horários iguais, volume alto, DB/Auth indisponíveis, contenção de lock, quota concorrente e imagem comprimida de dimensão extrema em aparelho modesto. Elevar severidade se medições demonstrarem negação de serviço incompatível com o uso pretendido.

### F06 — P2: documentação e CD podem induzir fechamento incorreto de gate

**Evidência:** I `docs/ops/F02_GATE_MATRIX.md:11,16,44` ainda descreve ausência de admissão/no-store/SQL CI, já alterados no código; I `docs/ops/NEON_AUTH_ROLLOUT_F02.md:31–32` ainda descreve ator não assinado e UI pendente. I `.github/workflows/cd.yml:29–31,45–49,61–67` aceita um status Vercel e testa alias fixo sem ligar resposta ao SHA; dispatch pula conferência de commit. Workflow backend usa Postgres real e 001/002, mas apenas presença do YAML não comprova run. R workflow `:5–6` não dispara automaticamente para todo PR cujo destino seja integrated-rc/integration.

**Fix/reteste:** atualizar matriz preservando distinção implementação/evidência; recibos por workflow/job/SHA, deployment e alias correlacionados; tornar testes requeridos no caminho real de integração. Exercitar alias apontado a SHA antigo e impedir PASS de promoção. Não atribuir o verde de 7fdfa8e ao privado de daf07ea.

## E01–E05 e fronteiras verificadas

| Original | Estado do recheck |
|---|---|
| E01 CSP | Correção estática de blob/worker/WASM; F01 permanece bloqueante por runtime falho/não comprovado. |
| E02 contrato | Resolvido estaticamente: I domain:5–12, SQL 001:36–44 e PhotoCapture:26–31 alinham unidades e pulso opcional/null, faixas 30–220. UI privada usa confirmedPayload após save revisado (private-health:24–25; private-api:9). Persistência E2E pendente. |
| E03 admissão | Implementada com assinatura e admissão revogável; F02 exige prova de sessão/provedor/ambiente. |
| E04 truncamento | Corrigido para 409/CSV completo; idempotência e quota implementadas. Escala/paginação F05 pendentes. |
| E05 receipts | Aberto: verde pré-privado insuficiente, OCR falhou e runner preparado não é executado/aprovado. |

**IDOR/RLS/ator:** I records:5–9 autoriza paciente antes da leitura e SQL RLS reforça; POST estrito não aceita actor/patient arbitrários. SQL 001:14–20 e 003:11–15 não aceita GUC unsigned: exige HMAC(txid:ator) e admissão. Runtime sem chave não pode fabricar assinatura só mudando GUC. Assinatura não protege contra servidor/HMAC key comprometidos; servidor é autoridade para afirmar qualquer ator admitido. `backend.ts:26–27` rejeita vários privilégios perigosos, porém não prova todos (CREATEROLE/CREATEDB/REPLICATION, ownership de funções ou roles com grants indiretos de objetos merecem catálogo efetivo); B preflight é mais estrito. Credencial runtime não pode ser owner/administrador; não alegar resistência ao migration owner. Nenhum bypass concreto demonstrado.

**Consentimento/revoke:** ordem seq invalida grants anteriores à retirada/reaceite; API serializa por paciente e admissão trava linha. Leitura/export já autorizada em voo pode terminar antes de revoke adquirir/confirmar locks: definir ponto de efetividade por commit, sem prometer apagar bytes entregues. SQL direto que ignora o protocolo de locks não herda todas as garantias de concorrência da API. Retestes devem verificar estado, não aceitar qualquer erro como isolamento. Consentimento e sharing guardam idempotência em write_requests; records revalida consentimento antes de replay. Repetir chave/corpo = um efeito; corpo diferente = 409; testar chave de outro ator, concorrência, timeout após commit e replay após revogação. UI mantém chave de retry de records (private-health:24–25); consent/sharing geram nova chave por ação (private-api:4), logo não garantem deduplicação entre cliques separados. Auditoria SQL cobre escritas, não leitura/export: completar requisito de rastreabilidade sem conteúdo clínico antes de uso real.

**Foto/privacidade:** PhotoCapture:18,38 usa blob de canvas sem otimizador/upload; lib/photo-ocr:15–22 remove metadados do preview/OCR, não prova apagamento físico do original na memória. Parser usa gramática ancorada e confiança global >=85; confiança não é certeza por dígito. Edição desmarca confirmação (PhotoCapture:41–45), save valida novamente; boolean confirmed é declaração do cliente, não atestado de que a pessoa viu a tela. Sem envio de imagem/OCR bruto, analytics ou persistência clínica identificados nesses caminhos. SW:1–5 cacheia somente offline.html; APIs e página privada têm no-store. UI privada limpa histórico ao ocultar/sair e evita aplicar respostas de geração antiga (private-health:14–25); foto é desmontada quando autorização local cai. Não há atualização automática que recolha histórico já visto quando sessão/grant é revogado externamente: provar comportamento de sessão expirada e definir política de revalidação. Cache/logout/bfcache, logs de plataforma e SDK não foram medidos. Gemini/education continua indisponível; não há fronteira LLM a homologar aqui. Executar R somente com fixtures: traces/artifacts de browser seriam vazamento se reutilizados com pacientes reais.

## Saída exigida

Correções mínimas e receipts acima no **mesmo candidato integrado**, com URL/run/job/SHA, browser/headers, branch/deployment e assertions sanitizadas. F01 bloqueia demo OCR suportada; F02–F04 e gates clínicos/jurídicos/privacidade bloqueiam dados reais. Sem aprovação clínica por inferência de flags, teste SQL ou merge. MESTRE decide gates após evidência; EMILY não altera aplicação nem opera serviços.

Independência: parecer separado da autoria, mas agente no mesmo ecossistema cognitivo; não certifica segregação organizacional/cognitiva. Se exigida independência real, requer outro revisor/executor com evidência própria.

Execução: somente leitura de Git/arquivos e criação deste relatório no worktree `audit/f02-emily-recheck`. Nenhum npm/lint/test/build, SQL, Neon, browser/web/MCP, credencial ou .env lido; nenhum código de aplicação substituído, commit ou push. Nenhum teste foi executado nesta sessão.
