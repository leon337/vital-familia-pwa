# F02 — entrega de engenharia RAFAEL

Escopo: Vital Família #2 / MCF #477. LEANDRO é autoridade humana; MESTRE governa. Contrato lido: `leon337/multiagent-collaboration-framework/docs/agentes/RAFAEL.md` (SHA de conteúdo ebdb3d2317b61c6bb81335885867c1d22aa1cb3e).

## Implementação

Foto de visor sintético como entrada principal; câmera traseira ou galeria. Consentimento da sessão precede seleção. Revisão da imagem sem EXIF e valores editáveis, confirmação explícita antes de registrar, somente memória. Ao alterar campos a confirmação é retirada. Cuidador não registra. Cancelar, revogar a declaração, sair da aba ou concluir libera imagem e interrompe OCR. Nenhum upload, localStorage, IndexedDB clínico ou cache PWA foi acrescentado. Backend e autenticação existentes não foram habilitados ou apresentados como concluídos.

Tesseract.js 6.0.1 é importado dinamicamente de `/ocr/tesseract.esm.min.js`, worker/core 6.0.0 e idioma eng 1.0.0 servidos pela mesma origem. `prebuild` copia os assets estáticos versionados para `public/ocr` no runner remoto; nenhum script upstream é executado. Build falha se faltar asset. Não há dependência npm adicional nem alteração no lockfile. O download ocorre durante a preparação do app, nunca com foto ou dado de usuário. Runtime sem fallback CDN e cache de idioma desativado. Referências: https://github.com/naptha/tesseract.js/blob/v6.0.1/docs/api.md e https://github.com/naptha/tessdata/tree/gh-pages.

Aceita JPEG/PNG/WebP com MIME e assinatura compatíveis, 8 MiB, 24 MP, mínimo 80px; canvas limita a 1800px, remove metadados. Timeout de 45s e cancelamento terminam worker. A decodificação original ainda pode consumir memória antes da verificação de dimensões: validar em Android modesto.

Parser exige confiança global >=85, unidade explícita, dígitos exatos e estrutura simples. Sem correção O→0, inferência de unidade, conversão mmol/L, estimativa de pulso, interpretação médica ou gravação automática. Pressão exige SYS/DIA; pulso somente se visível e rotulado. Datas, memória do aparelho e linhas extras tornam leitura indeterminada. Limites são técnicos do formulário, não orientação clínica. Rejeições conservadoras são esperadas; digitação manual permanece disponível. Glicemia mmol/L é preservada com unidade no histórico/CSV e excluída do gráfico mg/dL; pulso integra histórico/CSV.

## Evidência e pendências

`tests/photo-parser.test.ts` contém apenas strings sintéticas: ambos os aparelhos, mmol/L, ausência de pulso, rótulos/unidades ausentes, múltiplos candidatos, números ambíguos, visor invertido/reflexo/ilegível, limites, confiança e assinatura. Seis PNGs de visores foram desenhados por código em `tests/fixtures/displays` (glicemia, pressão, inversão, reflexo, ilegível, candidatos conflitantes). Não são testes executados de acurácia OCR com imagens. Testes E2E com raster sintético e Android/câmera/a11y continuam necessários; o código não certifica acurácia clínica.

Nenhum teste, lint, typecheck, build, CI ou audit foi executado no notebook. Validação fica para GitHub Actions. Sem alteração em infraestrutura, banco, credenciais ou outras aplicações. `npm install --package-lock-only --ignore-scripts ...` foi tentado e falhou por DNS; solução final usa assets estáticos sem pacote novo.

Riscos abertos: assets versionados ainda sem hashes de integridade individuais; disponibilidade CDN durante build; bundle WASM/modelo volumoso; timeout e uso de memória em aparelhos modestos; confiança global não garante exatidão por dígito; permissões/HEIC e imagens com layouts fora da gramática caem em falha/manual. Aprovação arquitetural de SOFIA, revisão independente EMILY, gates LÉO e qualquer liberação clínica permanecem pendentes. No momento da consulta, o worktree de SOFIA ainda não continha ADR F02; nenhum aceite foi inferido.

Push pelo shell falhou por resolução de github.com. Escrita via conector GitHub foi recusada por exigir aprovação, indisponível nesta sessão. O commit local também foi impedido: `.git/index.lock` não pode ser criado porque `.git` está montado somente leitura. Portanto não existe SHA novo, publicação remota ou CI aprovado nesta entrega. Os arquivos permanecem no workspace para revisão e commit em ambiente autorizado.
