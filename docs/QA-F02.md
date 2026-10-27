# QA F02 — RENATO / PR14

**NO-GO.** Base inspecionada: `cd3bbdaf937ebd89f152c1af4bacac9a1ced050c`, branch `fix/f02-csp-startup-timing`. MESTRE somente governa; GABRIEL integra. Nenhum npm, teste, lint ou build local; sem secrets/.env, SQL/Neon, web/MCP, staging, commit ou push. Revisão estática e `git diff --check` apenas.

## Achado da EMILY e decisão

Achados fornecidos pelo solicitante para o exact HEAD: run `40523017876` verde sem artefatos de browser; upload aceitava ausência com warn; exceção de eval em qualquer chunk Next entre 0 e 1500 ms sem autenticação; array CSP mutável na página; correlação CDP apenas por prefixo/fonte; GET/HEAD com valores e failedRequests sem asserção. Não existe relatório independente da EMILY identificado neste checkout; estes achados são tratados como relato fornecido, sem consulta remota.

Não há prova revisada de linha/coluna, callsite e fingerprint que autentique a causa do eval. Portanto **nenhum eval é dispensado**, mesmo no chunk anteriormente relatado `564-fa507fbd158e5a3c.js`, mesmo em 293,3 ms e mesmo com isTrusted true. Mudança de hash não herda exceção. Nenhum diagnóstico console/CDP é filtrado. A suíte pode continuar vermelha por uma tentativa legítima do framework: isso exige investigação do runtime em escopo próprio; não autoriza afrouxar o teste, unsafe-eval ou bypassCSP.

## Evidência e gate remoto

Workflow `.github/workflows/f02-browser-ocr.yml`: runner Ubuntu 24.04, Node 24, Playwright 1.56.1 e Chromium real, um worker, zero retries. Build remoto obrigatório antes do browser; recibo registra HEAD, BUILD_ID e SHA-256 de todos os arquivos `.next/static` e `public/ocr`. Reporter verifica o mesmo recibo antes da suíte e finalizador compara novamente depois dela. Respostas de assets observadas no contexto são verificadas contra esse recibo. Hashes diferentes entre builds são explicitamente registrados; alteração durante o mesmo run reprova. Esta é integridade relativa ao build, não autenticação independente de uma cadeia de fornecimento.

Reporter JSON próprio, JSON Playwright, HTML, anexos de auditoria/baseline e PNGs, screenshots e traces em sucesso e falha. Finalizador exige suíte passada, exatamente os quatro cenários OCR e as duas fixtures de segurança, sem skip/falha ou erro de persistência e evidências não vazias, gera `test-results/f02/manifest.json` com paths e SHA-256, incluindo checksum do recibo externo à pasta que o Playwright limpa. Ausência do recibo, evidência ou diretório reprova. Upload sempre executado, `if-no-files-found: error`, retenção de 14 dias. Finalizador só em verde: falhas ainda retêm evidência parcial, sem manifesto verde. Verificação explícita anterior ao upload impede que um único diretório existente mas incompleto satisfaça o gate.

## CSP e rede

Listener instalado antes de navegação entrega eventos por binding para array em Node, sem `window.__f02Csp`. Registros são congelados e acrescentados com sequência e fase; não há mutação posterior dos registros. Handshake do listener obrigatório. Baseline capturado após UI inicial e antes de qualquer imagem; eventos iniciais já reprovam. Ao final, exige contagem inalterada desde o baseline, nenhum evento CSP e isTrusted true para qualquer registro. CDP security log, console de todos os níveis e pageerror são independentes e têm tolerância zero. Linha/coluna e policy dos eventos ficam retidas para investigação, sem tolerância por tempo ou prefixo.

Binding é observabilidade, não fronteira de segurança contra um runtime completamente comprometido: um script pode chamar o binding com payload forjado ou interferir em APIs DOM. isTrusted no payload não autentica sozinho o emissor em Node. Não se usa esse payload para aceitar qualquer violação. Ausência de eventos não prova por si só ausência de ataque; logs CDP, handshake, header exato, rede e evidências complementam o gate. Não há alegação de coletor infalível nem de causa do eval autenticada. Essa limitação mantém NO-GO para a aprovação de segurança solicitada.

Rotas rejeitam qualquer origem diferente de `http://127.0.0.1:3000`, método além de GET/HEAD, corpo, query, fragmento, credenciais e paths não constantes do build (exceto raiz e favicon). Isso impede valores de medição ou bytes de imagem em URLs arbitrárias, inclusive mesma origem. WebSocket, requests rejeitados, failedRequests, cookies/Set-Cookie e persistência local/session/IndexedDB reprovam. Assets OCR reais não são mockados. APIRequestContext é separado: os quatro WASMs usam URLs fixas, sem redirect, HTTP 200, sem Set-Cookie e hash local obrigatório. Worker/SW e canais de sistema têm limites: SW bloqueado; observação CDP desta página não cobre logs de todos os targets worker.

## Pixels e fixtures adversariais

Preservados os casos reais Tesseract de PNG sintético Canvas: `123 mg/dL`, SYS `120 mmHg`, DIA `80 mmHg`, PUL `72 bpm`; edição para `124 mg/dL` e `121/80 mmHg · 72 bpm`, reconfirmação, registro em memória, saída sem salvar, PNG branco e PNG corrompido. Nenhum parser/worker/resultado OCR mockado. Fixtures do helper rejeitam evento supostamente conhecido, evento não confiável, duplicatas, fonte externa, linha/coluna/fingerprint diferentes e qualquer janela temporal; também rejeitam URLs com valores/imagem, corpos, métodos e origens adversariais. São fixtures de classificação, não prova de resistência do browser a comprometimento total.

Somente imagens e valores fictícios gerados no runner isolado. Manifesto declara synthetic-only como contrato de entrada, não como detector automático de PHI. Não conectar backend/dados reais. Cobertura não mede acurácia clínica, câmera física, Android, reflexos, sete segmentos ou PHI. Nenhuma aprovação clínica.

## Relay para GABRIEL

Integrar somente `tests/browser/**`, `.github/workflows/f02-browser-ocr.yml` e este documento. Rodar exclusivamente o workflow remoto no novo exact HEAD; conferir recibo, manifesto e anexos por teste, hashes e ausência de skips. Repassar SHA/run e resultados à EMILY; MESTRE governa. Não declarar GO apenas por CI/OCR verde. Se o eval reaparecer, preservar logs e investigar callsite/runtime em trabalho separado: a exceção anterior foi revogada e a origem permanece não autenticada. Nenhum envio de mensagem externa foi realizado nesta sessão.

## Correção P1 após revisão GABRIEL — novo review obrigatório

Patch anterior não aprovado para commit. Corrigida dependência de attachments com body e busca por substring global. `writeEvidence` grava primeiro um arquivo físico exclusivo (`wx`) em `test-results/f02/evidence/<SHA-256(testInfo.testId)>/`, depois anexa por path. O mesmo ID do reporter associa cenário e recibo; nomes são fixos e validados. Arquivos existentes não são sobrescritos silenciosamente.

| Cenário exato | Arquivos exigidos além de receipt.json |
| --- | --- |
| glucose | navigation-baseline.json, browser-audit.json, glucose.png, wasm-http-checksums.json, screenshot.png, trace.zip |
| pressure | navigation-baseline.json, browser-audit.json, pressure.png, wasm-http-checksums.json, screenshot.png, trace.zip |
| unreadable | navigation-baseline.json, browser-audit.json, blank-invalid-display.png, screenshot.png, trace.zip |
| corrupt | navigation-baseline.json, browser-audit.json, corrupt.png, screenshot.png, trace.zip |

`corrupt.png` contém deliberadamente os bytes inválidos efetivamente enviados ao input, não é PNG válido. Cada recibo contém ID original, ID seguro, cenário, título, status, erros de selagem e inventário de arquivos com tamanho e SHA-256. Screenshot/trace vêm dos attachments nativos daquele resultado, com nome exato e sem ambiguidade, copiados para o diretório determinístico. O finalizador verifica inventário físico exato, arquivos regulares não vazios, checksum/tamanho individual, identidade/status do cenário e quatro provas WASM únicas comparadas ao recibo de build para cada positivo. PNG/ZIP de outro cenário não satisfazem a matriz. Manifesto inclui matriz e hashes dos recibos e arquivos. As duas fixtures de segurança também precisam estar presentes por título/arquivo exatos e IDs distintos.

`afterEach` persiste browser-audit em finally mesmo quando networkidle/CDP/cookies/asserções lançam erro. Auditoria registra erro de coleta e erros do teste; erro original é relançado. Falha adicional de persistência é relançada com o erro original em AggregateError. Falha do corpo do teste permanece no resultado. Dados incompletos não ganham status verde. O reporter acumula tarefas assíncronas de onBegin/onTestEnd e aguarda todas em onEnd antes de gravar o relatório; falha de selagem/recibo retorna status failed ao Playwright, também registrado e rejeitado pelo finalizador.

Limite explícito: encerramento abrupto do processo, timeout que encerre o hook ou falha de disco podem impedir finally/gravação. Não há garantia de artefato contra esses casos; ausência é reprovação, nunca prova de sucesso. Upload continua `if-no-files-found: error` e 14 dias, com evidência parcial em falha. Nenhum runtime/CSP de produção alterado, sem relaxamento de CSP/rede. Nenhum npm/test/lint/build local executado; somente inspeção estática e git diff --check. Sem commit/push.

**Handoff GABRIEL:** revisar novamente os quatro arquivos desta correção (`tests/browser/ocr-real.e2e.mjs`, `tests/browser/audit-artifacts.mjs`, `tests/browser/audit-reporter.mjs`, `docs/QA-F02.md`) junto do patch anterior ainda não aprovado. Workflow mantém upload obrigatório. Após novo review, validar exclusivamente em run remoto no exact HEAD integrado, verificando a matriz e checksums. **NO-GO permanece**: esta revisão estática não garante execução e não autentica a causa do eval. Nenhuma mensagem externa enviada por esta sessão.
