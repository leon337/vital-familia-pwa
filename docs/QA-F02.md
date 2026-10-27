# QA F02 — RENATO

Branch inspecionada: `test/f02-real-ocr-cloud`, feature foto já presente. Nesta recuperação, alterações limitadas aos testes browser, helper/fixtures de auditoria CSP e esta documentação; backend não alterado. MESTRE governa; integração/commit/push ficam com GABRIEL.

## Estado e rastreabilidade

**Gate remoto ainda pendente.** Nenhum npm, teste, lint ou build foi executado neste notebook. Conforme o relato/log fornecido do run `40516964936`, o job falhou 4/4, mas os cenários positivos chegaram à extração dos valores exatos, revisão, confirmação e registro. A asserção final de WASM dependia de `context.on('response')`, que pode não observar requests iniciados pelo worker. Esse é um defeito de observabilidade do teste, não evidência de que OCR tenha falhado. O run também registrou um eval bloqueado pela CSP no bundle Next, nos primeiros ~250 ms. As mudanças desta entrega ainda precisam de execução pelo relay no GitHub Actions; não há gate verde nem alegação de segurança clínica.

O contrato solicitado `docs/agentes/RENATO.md` não existe neste checkout nem foi localizado nos diretórios de trabalho sob `/home/leo/agent-sandbox`. A issue https://github.com/leon337/vital-familia-pwa/issues/2 não tem cópia local identificada. A instrução de não usar web/MCP impede consultá-los remotamente: contrato e conteúdo da issue não foram lidos, nem se declara conformidade com requisitos desconhecidos. Escopo aplicado: requisitos explícitos desta solicitação e implementação local, incluindo `docs/F02-ENGINEERING.md`.

## Execução exclusivamente remota

Workflow: `.github/workflows/f02-browser-ocr.yml`. Ubuntu 24.04, Node 24, Playwright 1.56.1, Chromium real headless (renderização e UI reais), um worker, sem retries. Instala dependências, Chromium com dependências de sistema, fonte Liberation Sans, faz `npm run build` (inclui prebuild de assets Tesseract) e inicia `next start` em `127.0.0.1:3000`. Não usa servidor externo, autenticação, banco, segredos de aplicação ou imagens reais. Backend sintético desabilitado, telemetria Next desabilitada.

GABRIEL deve integrar os arquivos e publicar a branch/PR; não houve commit ou push nesta sessão. O workflow roda em PR destinado a `main` e aceita `workflow_dispatch` com a ref escolhida. GitHub exige que um workflow com `workflow_dispatch` exista também na branch padrão para disponibilizar esse disparo; enquanto ele só existir na feature, validar pelo evento PR. Após disponibilização na branch padrão, selecionar `test/f02-real-ocr-cloud` em “Run workflow”, ou disparar com a ref da branch publicada. Não substituir por execução local.

Teste: `tests/browser/ocr-real.e2e.mjs`; configuração: `tests/browser/playwright.config.mjs`. Sufixo `.e2e.mjs` deliberado: não entra na descoberta padrão do Vitest existente nem exige tipos Playwright no build TypeScript dos demais jobs. O runner Playwright é instalado apenas neste job, sem alterar package.json/lockfile do projeto.

## Critérios obrigatórios do gate

- Enviar PNG pelo file input da galeria; reconhecer realmente com Tesseract/WASM, sem mock, interceptação de resultado ou chamada direta ao parser.
- Glicemia extrai exatamente `123 mg/dL`; pressão extrai exatamente SYS `120`, DIA `80`, PUL `72`. São valores fictícios plausíveis, com unidade/rótulos explícitos. Não aceitar apenas “um número qualquer”.
- Revisão aparece como ainda não registrada, confirmação começa desmarcada, botão de registro desabilitado. Sair da revisão sem confirmar preserva contagem do histórico.
- Repetir upload, confirmar, editar glicemia para `124` ou sistólica para `121`: confirmação é retirada e botão volta a desabilitar. Reconfirmar e registrar adiciona exatamente um registro com valor editado e descarta a foto.
- PNG válido em branco passa por OCR, resulta em leitura indeterminada e permite fallback manual vazio, sem novo registro. Arquivo corrompido com MIME PNG é rejeitado e também permite fallback sem registro.
- Módulo, worker e modelo eng mantêm asserções de resposta 200 observada. Os quatro WASMs são consultados diretamente por `context.request.get`, sem redirect e com HTTP 200 obrigatório. SHA-256 dos bytes HTTP deve coincidir com o arquivo local em `public/ocr/core`, produzido pelo build com o pin explícito `tesseract.js-core@6.0.0` em `scripts/prepare-ocr.mjs` (também verificado pelo teste). A referência local deve ter bytes e magic WASM válidos. Prova anexada em `wasm-http-checksums`. Isso comprova disponibilidade/integridade relativa ao build local fixado; não afirma qual variante o worker selecionou nem constitui hash independente da distribuição. Nenhum asset é mockado. A requisição API não depende dos eventos de rede do worker, usa somente origem local e exige ausência de Set-Cookie.
- Rotas do contexto bloqueiam e tornam falha qualquer tentativa HTTP(S) fora da origem localhost, e qualquer método de escrita HTTP, inclusive para a origem local. Imagens só entram por file input; não há upload HTTP esperado. Requests iniciados por worker também são abrangidos pelo contexto. Service worker é bloqueado para garantir observabilidade das rotas.
- Verificar headers CSP (`connect-src`/`worker-src` self) e Permissions-Policy câmera self; falhar com toda violação CSP fora da exceção estrita abaixo, erros de console/page ou mensagens de câmera/política não correlacionadas. Verificar atributo `capture=environment` no input de câmera e fallback de arquivo corrompido.

Artefatos por 7 dias: relatório HTML, PNGs sintéticos efetivamente enviados, auditoria de rede/assets/console/CSP; screenshot e trace em falha. A execução não aprova se houver timeout ou OCR conservador recusando fixture. Não baixar o limiar de confiança nem afrouxar o parser para fazer o gate passar.

## Fixtures e limites

Fixtures geradas durante o teste por Canvas do Chromium: fundo branco, texto preto Liberation Sans 64px, largura 1200px, margem 100px horizontal/70px vertical, linhas com passo 130px; altura mínima 300px. Casos positivos: uma linha `123 mg/dL`; três linhas `SYS: 120 mmHg`, `DIA: 80 mmHg`, `PUL: 72 bpm`. PNG vazio usa o mesmo canvas sem texto. Bytes PNG são enviados ao input, não strings de reconhecimento. Fonte instalada no runner. Não há pessoas, PHI, EXIF ou dados de produção.

Os PNGs existentes em `tests/fixtures/displays` não foram considerados prova de acurácia: o conjunto novo controla tipografia, margens e conteúdo para testar a gramática estrita da feature. Ainda precisa ser validado no primeiro run remoto. Se Tesseract não reconhecer esses pixels com confiança suficiente, o gate falha; revisar os PNGs anexados e ajustar apenas fixtures/teste de forma fundamentada, mantendo valores exatos e documentando alterações.

Cobertura restrita a visores tipográficos sintéticos frontais de alto contraste. Não mede acurácia clínica, visores de sete segmentos, reflexo, rotação, JPEG/WebP, mmol/L, layouts variados, EXIF, limites de memória, acessibilidade ou Android. Câmera física, prompt/permissão do sistema e captura móvel não são exercitados: `capture` em desktop não prova câmera funcional. Rede observada/bloqueada no navegador não é auditoria de todos os canais do sistema; downloads de npm/Chromium/assets no build usam terceiros antes de qualquer fixture, sem imagem. Service worker real e navegação offline ficam fora desta suíte. Necessário gate verde remoto antes de afirmar funcionalidade OCR, e validação adicional antes de qualquer uso real.

## Recuperação e exceção CSP explícita

O run anterior `40515709536` falhou antes do upload por ambiguidade de botão; o seletor limitado a `main` permanece. A hipótese anterior de sondagem UtilityScript não explica o novo evento atribuído ao bundle Next no relato do run `40516964936`. CDP continua com `allowUnsafeEvalBlockedByCSP: false`; não há bypassCSP, alteração de header, liberação de eval ou relaxamento do parser.

O helper `tests/browser/helpers/csp-audit.mjs` classifica **exatamente um** evento conhecido como tentativa benigna de framework que permaneceu bloqueada: `blockedURI=eval`, ambas directives `script-src`, disposition `enforce`, sourceFile da mesma origem `http://127.0.0.1:3000/_next/static/chunks/*.js` (sem query/hash) e tempo entre 0 e 250 ms. A policy do evento deve conter script-src e não conter `'unsafe-eval'`; o header real também continua verificado. Ausência do evento esperado, duplicata, evento tardio, origem diferente, inline/XSS, worker, connect-src ou qualquer outra violação faz o gate falhar. O hash do chunk pode variar a cada build; a exceção não se estende a outros caminhos do app.

A auditoria retém todos os eventos crus e a classificação. Diagnósticos console/CDP só são correlacionados se forem a mensagem específica de eval bloqueado por CSP e tiverem exatamente o mesmo sourceFile do evento conhecido; mensagens sem localização ou outros erros continuam falhando. Erros não capturados de página também continuam falhando. Não se elimina genericamente erro CSP ou toda ocorrência de eval.

As fixtures em `tests/browser/csp-audit.e2e.mjs` exercitam o classificador com evento conhecido, duplicata, origem externa, arquivo do app, inline, URI externa, directives diferentes, report-only, evento tardio, tempo inválido e policy insegura. Também verificam que diagnósticos não relacionados são rejeitados. São testes do classificador, sem injetar exceções no navegador nem simular resultados OCR. Os cenários positivos exigem a presença do bloqueio conhecido **depois** de comprovar OCR real, edição, reconfirmação e registro em memória; isso liga a prova de funcionalidade ao mesmo documento que sofreu o bloqueio.

Rede externa, WebSocket, métodos/corpos de escrita, cookies/headers e armazenamento local/session/IndexedDB continuam com tolerância zero. Os assets não são servidos por mocks. Asserções HTTP diretas não provam visibilidade de requests do worker; a prova de execução vem dos pixels e valores exatos da UI.

Hardening futuro: localizar e remover na origem/dependência a tentativa de eval do framework para retornar a zero violações esperadas; revisar a exceção a cada atualização Next. Essa dívida técnica não autoriza `unsafe-eval` ou tolerância a outras violações. A cobertura sintética não demonstra acurácia ou segurança clínica.

Entrega sem staging, commit ou push e sem execução local de npm/test/lint/build. Relay deve integrar/revisar e executar o gate remoto, incluindo as novas fixtures. Inspeção estática não equivale a execução aprovada.
