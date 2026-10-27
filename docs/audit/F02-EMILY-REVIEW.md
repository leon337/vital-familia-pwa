# F02 — Parecer EMILY, auditoria independente MCF classe C

Data: 2026-10-27. Destinatário: GABRIEL, para integração; decisões reservadas a LÉO e responsáveis permanecem reservadas. Revisão estática, sem homologação operacional.

## Parecer

- **Demo sintética existente em main: GO restrito para manutenção do escopo demonstrativo em memória**, com backend desligado e proibição de inserir dados reais. Não é aprovação de novo deployment nem certificação dos checks existentes.
- **Demo F02 com captura/OCR anunciada como funcional: NO-GO**, pelos achados E01/E02 e ausência de evidência de runtime no SHA integrado. Código pode seguir para correção e revisão; merge não equivale a liberação.
- **Backend privado e quaisquer dados reais: NO-GO**, por E03–E05 e gates de segurança, privacidade, operação, jurídico e clínico ainda sem evidência suficiente.
- Nenhum P0/crítico demonstrado nesta inspeção. Há P1/altos concretos e lacunas bloqueantes. Ausência de exploração demonstrada não prova ausência de vulnerabilidade.

P1 significa correção antes da liberação do componente afetado; os gates P0 da matriz arquitetural são critérios de aceite, não afirmações de que uma exploração crítica foi observada.

## Autoridade, fontes e integridade

Contrato lido: `/home/leo/MCF MISSIONS/mcf-chatgpt-workspace/docs/agentes/EMILY.md`, contrato normativo local. Aplicados: evidência vinculada a artefato, classificação, remediação, reteste e parecer explícito; nenhuma correção silenciosa no artefato auditado.

Missão indicada pelo solicitante: https://github.com/leon337/vital-familia-pwa/issues/2. **O corpo da issue não foi acessado**, pois web/MCP foram proibidos. Não há cópia integral identificada na documentação desta clone. Referências a A0–A9 provêm dos documentos locais de SOFIA/BRUNO/EDUARDO e não constituem conferência independente da issue. A cobertura final dos critérios da missão precisa ser reconciliada com seu texto por GABRIEL.

Refs locais examinadas por `git diff origin/main..origin/<branch>`, sem fetch, checkout ou merge:

| PR informado | Ref | SHA auditado |
| --- | --- | --- |
| base | origin/main | `0ea480e8c0d08b20ae4b3abc8723d4b47873f433` |
| #4 | origin/feat/f02-photo-capture | `01f62a4dfe6fe5f7d57ac66734e68a0312d8499f` |
| #6 | origin/feat/f02-neon-backend-secure | `88da405e83060f835719010661a795de9dc5f6ee` |
| #5 | origin/feat/f02-adr-vision-privacy | `6e0fb9899e59f791274387076a51b96e7b53d62d` |
| #3 | origin/feat/f02-infra-neon-auth-audit | `562c739dd282f57fa98dc7d1528dc320b129690c` |

SHAs conferidos com o Git local. Números de PR são os fornecidos pelo solicitante; vínculo e atualização remota não foram consultados.

Referências de linhas abaixo são relativas ao arquivo na ref especificada, não ao checkout main. Foram examinados diffs de implementação, SQL, testes e workflows, ADR/matriz OCR, runbook/matriz de gates, roadmap, auth/consent/education e service worker. Arquivos de imagem sintética foram identificados pelo diff binário; seus pixels não foram usados para inferir acurácia.

## Achados que exigem remediação

### E01 — P1/alto: CSP impede a revisão visual da foto e não admite compilação WASM

**Evidência:** #4 `lib/photo-ocr.ts:21–24` cria preview com `URL.createObjectURL(blob)`; `app/photo-capture.tsx:37` usa esse URL em `<img>`. `next.config.ts:2`, herdado da base, permite somente `img-src 'self' data:`. `blob:` não está autorizado. O usuário precisa conferir a foto para confirmar, mas o preview é bloqueado pela política. A mesma política restringe `script-src` a self/unsafe-inline sem `wasm-unsafe-eval`; o motor configurado em `photo-ocr.ts:27` usa core WASM. Em browsers que aplicam esse controle, compilação WASM é bloqueada. Não há teste de navegador que detecte isso nos testes entregues.

**Impacto:** o fluxo central de OCR/revisão não está pronto para demo funcional. Falha de OCR oferece manual, porém não satisfaz a promessa de captura e conferência com imagem.

**Correção:** permitir explicitamente `blob:` só em `img-src`; definir `worker-src 'self'` e a permissão mínima de WASM necessária, sem `unsafe-eval` genérico. Revisar política conforme ADR #5, mantendo conexões restritas. `camera=()` também diverge de `camera=(self)` do ADR: alinhar ou documentar formalmente a escolha de captura por file input. Esse input delega ao seletor/câmera do sistema; não se afirma que Permissions-Policy necessariamente o bloqueia como bloquearia getUserMedia.

**Reteste:** build em runner autorizado e navegador real com headers de produção: preview visível, worker/core/modelo locais carregam, OCR de raster sintético funciona, sem violações CSP necessárias ao fluxo; script/worker/conexão externos continuam bloqueados. Testar Android/iOS, permissão negada e fallback manual. Registrar SHA, headers, browser e resultado sanitizado.

### E02 — P1/alto: contratos incompatíveis entre foto e persistência em lib/domain.ts

**Evidência:** #4 `lib/domain.ts:4–8` aceita `unit` e pulso opcional no `measurementSchema`; `app/photo-capture.tsx:25–30` usa esse schema e entrega registro sem `confirmed`. #6 `lib/domain.ts:4–13` mantém schema legado estrito sem unit/pulse, cria outro schema confirmado e exige pulso em pressão. #6 `app/api/records/route.ts:4` exige o schema confirmado. #6 `db/001_schema.sql:36–38` também exige `confirmed:true` e pulso numérico. #4 aceita pressão sem pulso em `lib/photo-parser.ts:29–31` e na UI; #5 ADR exige não inventar campo ausente. Faixas de pulso divergem: foto 30–220, backend/SQL 20–250. CSV também é alterado de formas diferentes nas duas branches.

**Impacto concreto de integração:** escolher a versão backend do schema legado faz a UI de foto rejeitar glicemia com `unit` e pressão com pulso; escolher somente a versão foto elimina o export `confirmedMeasurementSchema` importado pela API. Mesmo preservando ambos, transcrição válida sem pulso não pode ser persistida. Não há integração UI/API entregue: #4 `app/page.tsx` grava apenas estado React. Não se afirma que uma requisição atual da UI falha, pois ela nem envia à API.

**Correção:** GABRIEL deve resolver semanticamente os contratos, unificando unidade/pulso/faixas e formato CSV; distinguir rascunho e envio confirmado e manter pulso ausente sem inventá-lo, conforme decisão arquitetural. Levar a mesma decisão ao SQL. Manter confirmação humana separada do consentimento; não acrescentar `confirmed:true` automaticamente antes da revisão.

**Reteste:** no SHA integrado, validar foto→edição→confirmação→payload→API→SQL→GET/CSV com 103 mg/dL, 5,6 mmol/L, pressão com e sem pulso e limites acordados. Edição posterior deve retirar confirmação. Recusar foto/OCR bruto/IDs extras e payload sem confirmação. Typecheck e testes cloud do conjunto integrado precisam passar; não basta CI separado por branch.

### E03 — P1/alto para backend ativo: sessão Google não é admissão autorizada

**Evidência:** #6 `lib/backend.ts:7–12` exige três flags e sessão com ID, sem allowlist/convite/status de admissão. Consentimento e sharing usam esse `actor()`; usuário autenticado pode consentir e inserir dados próprios quando flags ligadas. #6 `app/api/auth/[...path]/route.ts:8–17` filtra endpoints locais, mas não restringe conta admitida. #5 ADR exige admissão server-side fail-closed. #3 runbook relata email/password e signup upstream habilitados; isso é relato de outro autor, não configuração cloud revalidada por EMILY.

**Impacto:** ativar flags não torna a política de ingresso verdadeira. Filtrar o proxy não impede acesso direto ao provedor. Não foi demonstrado acesso cruzado entre pacientes por esse defeito.

**Correção:** verificar admissão revogável no servidor em cada operação privada; fechar métodos alternativos/ingresso livre no provedor conforme política aprovada e configurar origens/callbacks exatos. Flags não substituem esses controles.

**Reteste:** conta Google não admitida e conta com admissão retirada devem ser negadas inclusive em consent/records/sharing diretos; testar upstream, senha/signup, callbacks hostis, CSRF/state, cookie expirado/revogado, logout e latência de revogação. Somente contas controladas de teste; evidência sem tokens ou identidade pessoal.

### E04 — P1/alto de integridade para backend: exportação trunca sem aviso

**Evidência:** #6 `app/api/records/route.ts:3` seleciona `ORDER BY measured_at DESC LIMIT 1000` e devolve array ou CSV sem total/cursor/indicador de truncamento. `docs/ROADMAP.md` exige paginação e aviso acima de 1.000 antes de liberar backend; #5 API-01 repete o gate.

**Impacto:** usuário recebe diário/exportação incompleto com aparência de completo. Problema herdado e ainda presente em #6; não é regressão criada pela branch.

**Correção/reteste:** paginação estável e exportação completa ou aviso inequívoco de limite; fixtures 999/1000/1001 e empates de horário, sem perda/duplicação, com autorização por página. Incluir idempotência de POST e rate limiting distribuído, também ainda ausentes nas rotas examinadas e exigidos no roadmap; repetição do mesmo POST hoje gera novo ID sem chave idempotente.

### E05 — P1/alto de suficiência: gates de segurança e release sem receipts do conjunto integrado

**Evidência:** #4 `tests/photo-parser.test.ts` testa strings/assinaturas/schema, não executa OCR dos PNGs nem componente/browser; `tests/fixtures/displays/README.md` reconhece isso. #6 `tests/transaction.test.ts` usa pool mockado; `db/002_security_test.sql:3–56` exercita cenário em uma transação com função fixture SECURITY DEFINER, não OAuth, login runtime ou duas conexões concorrentes. #6 adiciona `.github/workflows/backend-security.yml` com PostgreSQL 17 real no runner — avanço sobre base, mas definição de job não é execução comprovada. Nenhum receipt de run, catálogo Neon, OAuth ou restore foi obtido nesta revisão.

**Correção/reteste:** executar CI no SHA integrado e colher URL/run/job/SHA; SQL no PostgreSQL e Neon isolado sintético com login runtime mínimo, memberships efetivas, pool A→B→C, rollback, contexto ausente/adulterado, concorrência de revoke/exportação e restore que preserve revogações. Registrar negações e estado, não aceitar qualquer erro como isolamento aprovado. Fechar matriz OCR/UX/a11y em browsers suportados. Segredos e PHI não entram em logs/artifacts.

## Cobertura e observações que não constituem exploração comprovada

**Parser, unidades e confirmação:** #4 usa gramática ancorada, confiança global mínima 85, rejeição de extras/duplicatas e validação de faixas. Não corrige O→0 nem converte mmol/L: preservação de unidade é a decisão do ADR, não defeito. Gráfico exclui mmol/L em vez de rotular como mg/dL; CSV separa valor/unidade. Confiança global não garante cada dígito; só teste OCR de pixels e revisão humana podem sustentar o aceite. Confirmação é desmarcada em mudanças de campos; save valida novamente. Booleano confirmado no backend é declaração do cliente, não prova de que uma tela foi vista. Sem evidência de bypass concreto dessa confirmação na UI examinada.

**Imagens/PHI/prompt injection:** arquivo tem limite de bytes e assinatura; bitmap vira canvas, preview e OCR recebem pixels rasterizados, sem envio do arquivo original. Não foi identificado fetch/upload de imagem, armazenamento clínico em localStorage/IndexedDB ou analytics no fluxo. URLs são revogadas e worker encerrado em conclusão/cancelamento/unmount. SW cacheia só offline.html; não adiciona cache de API/fotos. Limites de megapixels ocorrem após decode, podendo consumir memória antes de rejeitar; timeout não cancela createImageBitmap nem garante interrupção imediata de createWorker pendente. Exigir RES-01 em aparelho modesto, sem afirmar apagamento físico da memória.

`app/api/education/route.ts` retorna 503; não há encaminhamento de OCR para LLM. Texto OCR é submetido à gramática, não tratado como instrução executável. Nenhum vetor concreto de prompt injection foi demonstrado. Isso não autoriza Gemini futuro: opt-in separado e proibição de PHI continuam obrigatórios. Ausência de vazamento no código inspecionado não certifica telemetria/configuração do deployment.

**Assets Tesseract:** #4 `scripts/prepare-ocr.mjs:5–26` baixa versões fixas do CDN somente no build; runtime usa caminhos locais, `workerBlobURL:false`, `cacheMethod:'none'`. Assets não estão no lock npm, não têm hashes individuais e podem escapar do inventário de npm audit; conferir hashes/origem/licenças em CI e guardar manifesto verificável antes de uso real. Não há evidência de asset adulterado, portanto isso não foi promovido a vazamento/P0. #3 workflow de refresh de lock apenas roda npm sobre package.json: não fixa os bytes desses assets e não substitui esse controle. Ele também não executa checks antes do push automatizado; deve permanecer sujeito aos gates normais do PR.

**SQL actor/RLS:** #6 melhora a base: HMAC vincula ator e txid, chave em schema privado, verificação antes da query, RLS, grants de coluna, auditoria append-only e sequência compartilhada para invalidar grants anteriores à retirada. Não foi encontrado bypass demonstrável da assinatura apenas mudando GUC. A credencial runtime não deve herdar owner/superuser/BYPASSRLS ou capacidade de SET ROLE privilegiado: verificação em `backend.ts:21–22` cobre atributos/ownership direto, não todos os memberships. Provar catálogo efetivo é gate, não declarar configuração insegura sem vê-la. `pgcrypto` preexistente fora de vital_private exige revisão; baseline 001 é instalação nova, não migração incremental.

**Consentimento e revogação:** SQL consulta consentimento atual e invalida grant antigo após retirada/reaceite por ordem seq. APIs usam advisory lock por paciente, mas prova de concorrência/pool é pendente; SQL direto que não segue esse protocolo não ganha automaticamente a mesma garantia. Não é possível recolher CSV já entregue. Auditoria cobre escritas, não leitura/exportação; retenção/direitos/recuperação e reconciliação de revogações precisam fechar antes de dados reais. Checkbox sintético da UI não equivale a consentimento legal nem consentimento persistido no servidor.

**CI/cloud e documentos:** #3 e #5 oferecem critérios/runbooks, não implementação de auth/RLS nem evidência de execução. Observações de #3 sobre actor GUC sem assinatura e CI sem SQL descrevem base; #6 modifica esses pontos, portanto não devem ser repetidas como estado final integrado. CD base verifica demo/manifest/backend 503, não OCR/OAuth/RLS nem equivalência do HTML servido com o SHA; correlação de deployment/alias e checks exige receipt próprio. Scripts staging/recovery dependem de declarações de ambiente, não comprovam por si a identidade do destino. Nenhum deles foi executado aqui.

## Critério de encerramento e independência

Fechar E01–E04 com diffs revisados e E05 com evidências do SHA integrado, reconciliar o texto integral da issue #2 e obter decisão dos responsáveis. Dados reais continuam bloqueados até segurança/privacidade/operação e aceites jurídico/clínico aplicáveis. Relatório não substitui aprovação de LÉO, nem transforma documentação em PASS.

Esta é uma auditoria por agente no mesmo ecossistema cognitivo de agentes autores; identidade nominal EMILY e classe C não provam independência cognitiva, organizacional ou segregação de executor. Não houve outro auditor independente nem segunda execução. Se independência real for critério do gate, exigir revalidação por revisor/executor realmente independente com evidências próprias.

**Execução nesta sessão:** leitura estática de arquivos e objetos/diffs Git; criação somente deste relatório. Nenhum npm, lint, test, typecheck, build, SQL, browser, web/MCP, alteração de serviço, commit ou push. Nenhum arquivo .env (inclusive exemplo) ou dado clínico real foi lido. Nenhum teste foi executado; todos os retestes propostos permanecem pendentes.
