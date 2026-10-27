# QA F02 — RENATO

Branch inspecionada: `test/f02-real-ocr-cloud`, feature foto já presente. Trabalho limitado ao teste de navegador, configuração, workflow e esta documentação; backend não alterado. MESTRE governa; integração/commit/push ficam com GABRIEL.

## Estado e rastreabilidade

**OCR funcional ainda NÃO demonstrado.** Nenhum npm, teste, lint ou build foi executado neste notebook. O gate obrigatório é um run verde do job `pixel-ocr` no GitHub Actions, associado ao SHA integrado. Não há URL de run nem resultado aprovado nesta entrega. Código de teste escrito não equivale a evidência de execução.

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
- Assets `/ocr/tesseract.esm.min.js`, worker, modelo eng e WASM precisam responder 200 na mesma origem durante os cenários positivos. Nenhum asset é servido por mock do teste.
- Rotas do contexto bloqueiam e tornam falha qualquer tentativa HTTP(S) fora da origem localhost, e qualquer método de escrita HTTP, inclusive para a origem local. Imagens só entram por file input; não há upload HTTP esperado. Requests iniciados por worker também são abrangidos pelo contexto. Service worker é bloqueado para garantir observabilidade das rotas.
- Verificar headers CSP (`connect-src`/`worker-src` self) e Permissions-Policy câmera self; falhar com violações CSP, erros de console/page ou mensagens de câmera/política coletadas. Verificar atributo `capture=environment` no input de câmera e fallback de arquivo corrompido.

Artefatos por 7 dias: relatório HTML, PNGs sintéticos efetivamente enviados, auditoria de rede/assets/console/CSP; screenshot e trace em falha. A execução não aprova se houver timeout ou OCR conservador recusando fixture. Não baixar o limiar de confiança nem afrouxar o parser para fazer o gate passar.

## Fixtures e limites

Fixtures geradas durante o teste por Canvas do Chromium: fundo branco, texto preto Liberation Sans 64px, largura 1200px, margem 100px horizontal/70px vertical, linhas com passo 130px; altura mínima 300px. Casos positivos: uma linha `123 mg/dL`; três linhas `SYS: 120 mmHg`, `DIA: 80 mmHg`, `PUL: 72 bpm`. PNG vazio usa o mesmo canvas sem texto. Bytes PNG são enviados ao input, não strings de reconhecimento. Fonte instalada no runner. Não há pessoas, PHI, EXIF ou dados de produção.

Os PNGs existentes em `tests/fixtures/displays` não foram considerados prova de acurácia: o conjunto novo controla tipografia, margens e conteúdo para testar a gramática estrita da feature. Ainda precisa ser validado no primeiro run remoto. Se Tesseract não reconhecer esses pixels com confiança suficiente, o gate falha; revisar os PNGs anexados e ajustar apenas fixtures/teste de forma fundamentada, mantendo valores exatos e documentando alterações.

Cobertura restrita a visores tipográficos sintéticos frontais de alto contraste. Não mede acurácia clínica, visores de sete segmentos, reflexo, rotação, JPEG/WebP, mmol/L, layouts variados, EXIF, limites de memória, acessibilidade ou Android. Câmera física, prompt/permissão do sistema e captura móvel não são exercitados: `capture` em desktop não prova câmera funcional. Rede observada/bloqueada no navegador não é auditoria de todos os canais do sistema; downloads de npm/Chromium/assets no build usam terceiros antes de qualquer fixture, sem imagem. Service worker real e navegação offline ficam fora desta suíte. Necessário gate verde remoto antes de afirmar funcionalidade OCR, e validação adicional antes de qualquer uso real.
