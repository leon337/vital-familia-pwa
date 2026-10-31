# ADR-003 — Visão multimodal nativa com Gemini para captura de medições

**Decisão de produto:** LEANDRO, 31/10/2026.  
**Estado:** DIRETRIZ DE PRODUTO APROVADA; ARQUITETURA CANDIDATA À REVISÃO CLASSE C; IMPLEMENTAÇÃO NÃO HABILITADA.  
**Missão:** MCF-VITAL-FAMILIA-001 / F02 [#2](https://github.com/leon337/vital-familia-pwa/issues/2), [#24](https://github.com/leon337/vital-familia-pwa/issues/24), [#26](https://github.com/leon337/vital-familia-pwa/issues/26).  
**Substitui como direção técnica:** ADR-002 (Tesseract/OCR local como caminho primário). A ADR-002 permanece como registro histórico. A adoção de um provedor externo para imagens médicas reais **não** está autorizada.

## 1. Objetivo explícito
O próprio modelo **multimodal da família Gemini** interpreta a fotografia do display do glicosímetro ou medidor de pressão e extrai a leitura. Não haverá um estágio principal obrigatório de Tesseract, OCR clássico ou outro reconhecedor especializado. O Gemini já possui capacidade de visão e saída estruturada, sem necessidade de treinar OCR próprio.

**A visão é para transcrição assistida de visor, nunca para diagnóstico, classificação de risco, recomendações de tratamento ou aferição física da glicemia/pressão.** A medição vem do aparelho; Gemini apenas tenta transcrever números visíveis.

## 2. Fluxo alvo

```text
Usuário solicita câmera/galeria
  → imagem é capturada localmente
  → validação local MIME/magic bytes/tamanho/qualidade básica
  → orientação e decodificação/re-encode para remover EXIF e reduzir dados alheios
  → consentimento específico e verificação de elegibilidade da operação
  → API Next.js server-side com validação de sessão, origem, rate limit e cota
  → Gemini multimodal (modelo configurável, somente ambiente/serviço autorizado)
  → resposta JSON estruturada com tipo de equipamento e campos **visíveis**
  → validação Zod independente da resposta + checagem de unidade e de integridade
  → revisão visual da foto e dos números (editar/corrigir/descartar)
  → CONFIRMAÇÃO HUMANA EXPLÍCITA
  → persistência de **apenas dados estruturados confirmados** após Auth/Neon/RLS/consentimento efetivos
```

A fotografia não é persistida no servidor nem enviada ao banco por padrão; uso de transmissão em ambiente governado exige revisão e aceite legal/privacidade antes de fotos reais. Câmera e foto permanecem opcionais; digitação manual é alternativa sempre disponível.

## 3. Contrato semântico de saída

Exigir saída em esquema JSON, *sujeita a nova validação no servidor*. Campos de domínio sugeridos:

- `status`: `readable | ambiguous | unreadable`.
- `device_type`: `glucose_meter | blood_pressure_monitor | unknown`.
- `glucose`: `{ value: number | null, unit: "mg/dL" | "mmol/L" | null }` ou `null`.
- `blood_pressure`: `{ systolic: number | null, diastolic: number | null, pulse: number | null, pressure_unit: "mmHg" | null, pulse_unit: "bpm" | null }` ou `null`.
- `uncertain_fields`: identificadores de campos ilegíveis/ambíguos.
- `notes_for_review`: observações curtas **sem identidade pessoal e sem interpretação clínica**.

**Invariantes:** campos ilegíveis → `null`; unidade não visível → `null`; nada de completar dígitos, corrigir leituras, trocar SYS/DIA, converter mmol/L↔mg/dL ou inventar pulso. `status=ambiguous/unreadable` obriga correção manual ou novo enquadramento. JSON estruturado **não** garante veracidade visual; saída do modelo é um candidato, não uma medição confirmada.

Evitar confiar em “confidence” gerada pelo modelo como probabilidade calibrada. Critérios de qualidade medidos em fixtures sintéticas, por campo, e com taxa de abstenção.

## 4. Governança e segurança

1. **Fail-closed:** `VISION_ENABLED=false` e `VISION_REAL_DATA_ENABLED=false` por padrão. Sem provedor, chave, política, cota ou aprovação → o serviço não chama Gemini e oferece entrada manual.
2. **Chave exclusivamente server-side:** nunca incluir credenciais no PWA, JS cliente, GitHub, prompts, logs, browser, telemetria ou screenshots.
3. **Proibição de API gratuita para dados reais de saúde:** termos de Gemini API para serviços não pagos proíbem o envio de informação sensível/pessoal segundo orientações do próprio fornecedor; suas entradas/saídas podem alimentar melhoria de serviços e revisão humana.
4. Mesmo em serviço pago, exigir verificação contratual e jurídica de LGPD, finalidade, operador/suboperador, região, retenção, possíveis revisores, segurança, elegibilidade dos termos e restrições de uso clínico/medical device; **não presumir** que “pago = liberado”.
5. **Sem imagens reais no repositório/CI/benchmarks.** Apenas fixtures sintéticas. Proibir dados reais da mãe, familiares ou pacientes nos testes. Não persistir JPEG, base64, EXIF, tokens, prompt bruto ou resposta bruta em logs, objetos, banco, caches, analytics ou trace.
6. Integridade de origem e usuário: OAuth/Neon/autorizações reais, proteção CSRF, controle de tamanho e concorrência, cota por usuário, rate limit, timeout/cancel, prevenção de IDOR, RLS e consentimento distinto do ato de confirmação.
7. **Prompt injection em displays:** textos, QR, etiquetas ou instruções presentes na fotografia são dados não confiáveis, nunca comandos para o backend/modelo; não executar URLs/instruções encontradas na imagem.
8. **Saída do Gemini não grava automaticamente.** Sempre mostrar foto e campos editáveis, unidades, indicadores de incerteza, opção de refazer, confirmar ou cancelar.
9. **Offline:** sem inferência em nuvem. Fallback para entrada manual. Não criar fila persistente de foto para envio futuro automático.
10. Não apresentar leitura do display como interpretação médica; proibir diagnósticos, alertas terapêuticos ou sugestões de medicamento.

## 5. Métricas e teste sintético

- Glicemia: `mg/dL`, `mmol/L`, separador decimal, unidade ausente, reflexos e visor invertido.
- Pressão: `SYS/DIA/PUL` com posições variadas; campos omitidos; ambiguidade; fotos de outros equipamentos.
- Segurança: foto com nome/etiqueta/EXIF e imagem com instruções adversariais; verificar sanitização e ausência de logs.
- Integridade: comparação com gabarito de fixtures **sintéticas**, erro por campo, taxa de abstenção, falso preenchimento, p95 de latência, custo por foto, disponibilidade e quotas.
- Privacidade e UI: nenhum upload de foto real antes dos gates; confirmação/cancelamento sem persistência; fluxo câmera/galeria e leitor de tela no Android.
- Testes em GH Actions apenas com saída JSON sintética/mock; **nenhuma chamada de modelo ou upload de dados de saúde** em CI público.

Critério mínimo: nenhum caso de campo ausente pode virar gravação automática. Um valor errado não é “salvo” porque o modelo mostrou alta confiança.

## 6. Separação de responsabilidades

- **SOFIA (arquitetura):** revisar esta ADR e o contrato de saída; aprovar modelo/configurações e fronteira de dados.
- **RAFAEL (engenharia):** implementar *adapter* server-side com feature flag desligada e contrato testável por mocks, isolado em branch F02.
- **BEATRIZ (modelos/avaliação):** projetar prompts e avaliação de desempenho/robustez sem PHI.
- **JÚLIA (governança/privacidade):** avaliar legalidade, termos, tratamento de dados de saúde e provedores.
- **RENATO:** testes sintéticos de câmera/visão/revisão e regressão de segurança; CI por SHA.
- **EMILY:** auditoria independente de privacidade, integridade e falhas.
- **LÉO:** gate operacional; **LEANDRO:** autoridade humana final.
- **MESTRE:** reconciliar [F02 #2](https://github.com/leon337/vital-familia-pwa/issues/2), aprendizado [#24](https://github.com/leon337/vital-familia-pwa/issues/24) e UI [#26](https://github.com/leon337/vital-familia-pwa/issues/26).

## 7. Dependências e estado verificável

A F02 possui gates de autenticação, Neon/RLS e vulnerabilidades de dependências ainda abertos ([#17](https://github.com/leon337/vital-familia-pwa/issues/17), [#22](https://github.com/leon337/vital-familia-pwa/issues/22)). A frente UI [PR #28](https://github.com/leon337/vital-familia-pwa/pull/28) não constitui implementação de visão.

**Estado operacional:** `PLANEJADO / BLOQUEADO_POR_RISCO` para qualquer foto ou medição real. Esta ADR documenta a nova decisão **sem afirmar que API, modelo, custos ou autorização jurídica já estão configurados**.

## Fontes oficiais
- [Gemini — compreensão multimodal de imagens](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Gemini — JSON estruturado](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini API — termos adicionais (2026)](https://ai.google.dev/gemini-api/terms)
