# F02 — proveniência CSP — RAFAEL

Data: 2026-10-27. Branch de trabalho: `fix/f02-csp-provenance`.
Base local confirmada: `f23c99be1a1cd0964db0681e41f82b2a99adbccd` (PR13 incorporado).

**NO-GO mantido; auditoria independente de EMILY pendente. Causa ainda não atribuída.**
Não foi demonstrada a viabilidade de uma correção do runtime nesta sessão.
Isso não significa que a causa seja incorrigível: faltam bytes e mapeamento do
artefato executado. Nenhuma alteração especulativa de dependência foi aplicada.

## Evidência remota verificada

- [Run 40519230279](https://github.com/leon337/vital-familia-pwa/actions/runs/40519230279),
  job `122241423208`, `pixel-ocr`: build passou; browser terminou com 4 testes
  aprovados e 2 reprovados. Logs consultados pelo conector GitHub.
- O checkout efetivamente executado foi o merge sintético
  `0afee4dcdc6bd0855518c93190d5277a202a3b66`, merge de
  `5897379585804800861d99b510b9ff11dddfdfd9` em
  `bb1565fa4ccad9b8302b25c745a8e0d6f2071b56`. Não confundir head do PR,
  SHA de integração atual e SHA executado pelo runner.
- Nos cenários de PNG ilegível e PNG corrompido, o log contém
  `blockedURI: eval`, `directive/effectiveDirective: script-src`,
  `disposition: enforce`, `sample: ""`, linha **57**, coluna **37243**, fonte
  `http://127.0.0.1:3000/_next/static/chunks/564-fa507fbd158e5a3c.js`.
  Tempos observados: **293.29999999998836 ms** e **383.5 ms**.
  A policy registrada não contém `unsafe-eval`; contém as permissões existentes
  `unsafe-inline` e `wasm-unsafe-eval`. Nenhuma ampliação é autorizada.
- [Artefato 12740244655](https://github.com/leon337/vital-familia-pwa/actions/runs/40519230279/artifacts/12740244655):
  `f02-chromium-ocr-40519230279`, 5.125.447 bytes,
  digest ZIP `sha256:cb6b42437322c69e646c8b3036387b1386c2e11fbd966dd1745bf5a7a90c1118`.
  O log informa seis arquivos publicados de `playwright-report/` e
  `test-results/f02/`, incluindo traces dos cenários reprovados. Não há publicação
  explícita de `.next/static` ou sourcemaps no workflow inspecionado.
- [PR14](https://github.com/leon337/vital-familia-pwa/pull/14) tem head
  `cd3bbdaf937ebd89f152c1af4bacac9a1ced050c`.
  [Run 40523017876](https://github.com/leon337/vital-familia-pwa/actions/runs/40523017876)
  aparece concluído com sucesso na consulta por esse commit. O diff consultado
  aceita zero ou um evento até 1500 ms por caminho genérico de chunk.
  Esse resultado não atribui callsite, dependência ou método e não supera o NO-GO.

## Limite da investigação

Na primeira sessão, o download foi impedido por DNS. Na retomada, GABRIEL
forneceu os dois `trace.zip` no diretório local abaixo, fora do Git. Ambos foram
lidos integralmente com `python3`/stdlib (`zipfile`, `json`, `hashlib`), sem extrair
ou executar recursos. O bloqueio atual é **ausência de conteúdo/stack de origem
nos traces**, não acesso ao ZIP.

Raiz relativa ao workspace:
`.qa-evidence/f02-chromium-ocr-40519230279/test-results/f02/`.

| Caso / subdiretório | Entradas ZIP | SHA256 do trace.zip |
| --- | --- | --- |
| `ocr-real.e2e.mjs-valid-PNG-19921-s-back-without-registration` | 23 | `d21bb154eb48d1e3620e8c198de3abfadcfcbff780a962b32e202cb8cd5edcd9` |
| `ocr-real.e2e.mjs-corrupt-P-8cf2e-on-and-permits-manual-entry` | 20 | `4e4cf2798c6ec94f46cadc32867b021a18f5fd2ca9dfd3a8e800ddd49c038027` |

Esses hashes identificam os ZIPs internos fornecidos pelo relay; não equivalem a
uma nova verificação do digest do ZIP externo do artefato GH.

### Conteúdo efetivamente preservado

- Em ambos, `0-trace.network` registra GET 200 de
  `/_next/static/chunks/564-fa507fbd158e5a3c.js`, MIME JavaScript, gzip,
  `bodySize: 35075`, ETag `W/"1bfd5-1a17db865a8"`. Entretanto,
  `response.content` contém `size: -1`, sem `_sha1`, `text` ou corpo associado.
  Nenhum recurso no ZIP contém esse bundle. `fa507fbd158e5a3c` é o hash no nome
  emitido pelo build; **SHA256 dos bytes do chunk não disponível**.
- Não há entrada sourcemap nem request `.map` nos dois networks. O único `.js`
  de runtime preservado é o core Tesseract do caso ilegível, recurso
  `resources/5429cf7b3f68dede7328abe6620424f573853dbc.js`, que não é o chunk alvo.
- O evento estruturado aparece nos recursos de auditoria
  `resources/8c4fe34c50b9c5b9b41138f73c0217983dced60d` (ilegível) e
  `resources/45a5493d84a0ba51a2c1ade7792effd131384e91` (corrompido), além da
  asserção em `test.trace`: exatamente um evento por caso, `57:37243`, tempos
  293,3 e 383,5 ms, policy enforced. `known` vazio, evento em `unexpected`.
  `errors`, `security`, `unexpectedErrors` e `unexpectedSecurity` estão vazios.
  Portanto não há stack de console/CDP da operação bloqueada nesses recursos.
- `0-trace.stacks` aponta apenas para `tests/browser/ocr-real.e2e.mjs`.
  A stack da falha em `test.trace` aponta à asserção `152:75`; ela não é a
  stack do eval. O arquivo `resources/src@8cb603fdd72ed0d53fcf47173206cef2f90f20d8.txt`
  é fonte do teste, não fonte original do bundle.
- O RSC preservado em
  `resources/024b451ffcff194f505bfa7fc56ba615493280ec.htc` associa a referência
  cliente `6919`, export `default`, aos chunks `564`, `77` e `app/page`:
  `b:I[6919,["564","$8","77","$9","974","$a"],"default"]`, com `$8` igual ao
  chunk alvo. Isso demonstra participação no carregamento da página cliente,
  não qual módulo interno do chunk executou eval.
- Os contextos e os dois `test-failed-1.png` foram lidos/inspecionados visualmente,
  sem OCR. Mostram o histórico da demo com 14 registros fictícios; não mostram
  callsite ou erro JavaScript. As opções do contexto incluem `bypassCSP: false`
  e `serviceWorkers: block`. As auditorias registram ausência de escritas,
  conexões externas, cookies e armazenamento persistente nos cenários capturados.

Um URL `_next/static/chunks` indica o empacotamento, não autoria pelo Next.
Pode incluir código de aplicação e dependências. **Dependência e método reais:
indeterminados**. Não há evidência suficiente para culpar Next, Zod, Tesseract ou
o runner, nem para chamar a operação de simples probe inofensivo.

## Por que pode acontecer antes da seleção da foto

Inspeção estática da base atual: `app/page.tsx` importa `PhotoCapture`;
`app/photo-capture.tsx` importa `measurementSchema` de `lib/domain.ts`, que importa
Zod. Esses módulos podem ser avaliados no carregamento do cliente, antes de
`capture()`. Isso é uma cadeia candidata de investigação, não atribuição do eval.
O import de `/ocr/tesseract.esm.min.js` em `lib/photo-ocr.ts` só ocorre dentro de
`readPhoto()`, após validação e criação do canvas; sua localização não demonstra
que Tesseract seja responsável pelo evento inicial.

Em `0-trace.trace`, o `goto` começa em 12710,076 ms (ilegível) e
17861,464 ms (corrompido); `setInputFiles` começa em 13349,765 e 18676,257 ms,
respectivamente. O evento CSP registra `performance.now()` de 293,3/383,5 ms.
Sem captura de `performance.timeOrigin`, não há alinhamento demonstrado entre
esses relógios. A anterioridade do bloqueio à seleção/OCR é somente hipótese
temporal, não prova de ordem ou de causalidade; o início do request do documento
não substitui `timeOrigin`.

Como observação independente, no cenário PNG corrompido há eval bloqueado em
`57:37243`, nenhum request `/ocr/` no network e `assets` vazio. Essa coexistência
não atribui o método responsável nem demonstra por si só a causa do bloqueio.
O teste bloqueia escritas
de rede e audita uploads; escolher arquivo local não equivale a upload HTTP.
Não há prova de exfiltração nesses traces, nem base para isentar o callsite de XSS.

## Handoff RAFAEL → GABRIEL / RENATO / EMILY

GABRIEL integra este relatório; não houve commit/push neste sandbox. Para remover
o bloqueio, produzir diagnóstico **somente em GitHub Actions**, sem secrets,
environment de produção, DB, autenticação real, Vercel ou PHI:

1. A inspeção dos dois traces confirmou que o corpo do chunk alvo está ausente.
   Próxima alteração mínima é de observabilidade no workflow Actions: publicar
   `.next/static/chunks`, manifests e SHA256 dos arquivos do build sintético,
   com retenção curta e sem secrets. Reconstruir no Actions o
   SHA executado `0afee4d…`, com lockfile e versões do runner registrados. Registrar
   explicitamente se o hash do chunk mudou; coordenadas antigas não podem ser
   aplicadas silenciosamente a um bundle novo.
2. Preservar chunk, manifests e lockfile do build normal. Em build diagnóstico
   separado, habilitar sourcemaps de cliente apenas no runner, sem publicação de
   site. Mapear linha 57/coluna 37243 (ajustar coluna para API de mapas zero-based),
   registrar trecho gerado, arquivo original, método, versão da dependência e
   cadeia de importação. Mapas de outro build exigem nova captura das coordenadas.
3. Capturar stack via CDP antes da navegação, mantendo CSP enforced e
   `allowUnsafeEvalBlockedByCSP: false`; não substituir `eval`/`Function` por stub
   e não dispensar diagnósticos. Registrar se o modo debugger altera timing.
   Bloquear rede fora de localhost, cookies, escritas e WebSocket; usar só a demo
   sintética. Capturar navegação ociosa sem arquivo e depois seleção sintética.
4. Só após atribuição, avaliar API/configuração oficial sem geração dinâmica de
   código ou substituição mínima da dependência. Não mudar CSP, auth ou DB.
   O fallback deve recusar resultado inválido e impedir registro sem confirmação;
   não engolir exceção de segurança como sucesso.
5. RENATO deve exigir zero violações CSP no runtime corrigido e zero diagnósticos
   dispensados. Testes negativos remotos devem reprovar eval/Function deliberado
   em fixture isolada, inclusive mesma origem/chunk e tempos 0, 293, 1500 e após
   1500 ms; inline, fonte externa, worker, connect-src, duplicata e alteração da
   policy também não podem ser classificados como sucesso. A fixture hostil deve
   comprovar bloqueio e reprovação do auditor, sem contaminar o cenário positivo.
6. Reexecutar OCR de pixels, ilegível/corrompido, edição, reconfirmação e ausência
   de escrita/persistência. Entregar receipt com SHA efetivamente executado,
   run/job/attempt, versões, digest dos artefatos, mapeamento e resultados negativos
   a EMILY. Run verde com exceção temporal não é receipt de correção.

Não foi criado ou disparado workflow novo: as alterações locais não estão
publicadas e commit/push cabem a GABRIEL. Não há receipt novo nem alegação de
correção/testes aprovados. A viabilidade permanece pendente da atribuição acima.

## Escopo e verificação desta entrega

Somente este documento foi adicionado/atualizado. Os artefatos locais foram apenas
lidos; nenhum recurso foi executado ou alterado. Nenhum npm, instalação, lint, typecheck,
teste ou build local foi executado. Nenhuma alteração em DB, auth, main, Vercel
ou política CSP; nenhum dado clínico liberado. Verificação local limitada a
leitura estática e `git diff --check`. MESTRE governa; EMILY audita
independentemente; LÉO decide gates internos; GABRIEL integra; LEANDRO é a
autoridade humana final.

## Checkpoint ESEV — somente este documento

- Evidências: run GH `40519230279`, artefato `12740244655` e dois ZIPs sintéticos;
  caminhos e hashes SHA256 registrados acima. Bundle alvo, sourcemap e stack de
  origem ausentes; causa não atribuída e hipótese temporal sem prova causal.
- Estado: **NO-GO mantido**; nenhum runtime ou política CSP alterado.
- Handoff: RENATO recebe os limites para QA; EMILY recebe para auditoria
  independente; GABRIEL recebe este ajuste documental para re-revisão e integração.
- Verificação do ajuste: leitura do diff e `git diff --check`; nenhum
  npm/test/build local, commit ou push.
