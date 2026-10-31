> **NOTA DE GOVERNANÇA — 31/10/2026:** A decisão de produto de LEANDRO substitui Tesseract/OCR local como abordagem principal por **visão multimodal nativa Gemini**. Este documento é mantido como **histórico de arquitetura**; a proposta sucessora está em [ADR-003](./ADR-003-gemini-native-vision.md). Não usar esta ADR-002 para iniciar novas implementações de OCR local como pipeline padrão. O uso de fotos reais com Gemini segue bloqueado por gates de privacidade e segurança.

# ADR-002 — Captura prioritária por foto

- Estado: decisão de arquitetura; implementação e validação pendentes.
- Responsável: SOFIA, arquiteta MCF. Integração: GABRIEL.
- Contexto: `docs/ROADMAP.md`; missão #2 não encontrada nos caminhos locais convencionais consultados.

## Decisão

PWA: **câmera ou galeria → OCR Tesseract local no browser → parser conservador → edição e confirmação explícita → backend somente com consentimento vigente**. Entrada manual permanece disponível desde o início e em qualquer falha. OCR auxilia a transcrição; não diagnostica nem interpreta resultados.

- Câmera por ação do usuário, em HTTPS, com permissão contextual; galeria como alternativa. Negativa, incompatibilidade, timeout ou erro permitem preenchimento manual sem bloqueio.
- Tesseract, worker, WASM e idiomas são versionados e hospedados na mesma origem. Processamento em worker com limites de tamanho, resolução e tempo; cancelar encerra processamento e libera recursos.
- Parser aceita glicemia com unidade explícita `mg/dL` ou `mmol/L`, preservando valor e unidade. Vírgula decimal é normalizada apenas quando inequívoca. Não converter unidades automaticamente.
- Pressão exige associação inequívoca de rótulos `SYS`, `DIA`, `PUL` aos valores; SYS/DIA em mmHg e PUL em bpm. Campo ausente fica vazio. Não trocar SYS/DIA para corrigir resultados.
- Nunca inferir, completar ou corrigir dígitos, unidade, separador, sinal, data ou horário ausentes/ambíguos. Confiança OCR não autoriza preenchimento incerto. Múltiplas leituras, rótulos conflitantes e formato ambíguo exigem entrada/seleção humana explícita.
- Mostrar candidatos como rascunho editável, unidade e campos não reconhecidos. Exigir revisão e confirmação do conjunto final; valores inválidos ou incompletos não podem ser enviados. Limites de formato e plausibilidade serão aprovados pela equipe clínica antes de uso clínico; não produzir alertas terapêuticos.
- Confirmar não equivale a consentir: verificar separadamente identidade admitida, autorização, finalidade e consentimento vigente no servidor em cada gravação. Payload contém somente medições estruturadas confirmadas e metadados mínimos necessários; nunca foto, EXIF, texto OCR bruto ou candidatos descartados.

## Privacidade e segurança

- **Não salvar imagens**: foto, pixels e OCR bruto existem somente em memória durante a captura. Proibir upload, persistência em IndexedDB/localStorage/Cache API, cache do service worker, logs, analytics e relatórios de erro. Revogar object URLs, parar tracks da câmera e liberar buffers ao concluir, cancelar ou sair. Não prometer apagamento físico garantido da memória do browser.
- EXIF: não extrair nem usar localização/identidade; decodificar e rasterizar para pixels antes do OCR, descartando metadados. Orientação pode ser aplicada apenas para renderização local. Não serializar nem transmitir o arquivo original ou derivados.
- CSP restritiva, validada com o runtime escolhido: `default-src 'self'`, `worker-src 'self'`, `script-src 'self' 'wasm-unsafe-eval'` somente se necessário para WASM, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`; conexões apenas para API e autenticação explicitamente autorizadas. Sem CDN, `unsafe-eval` genérico ou ampliação para contornar falhas. Blob workers somente se indispensáveis, documentados e revisados antes da liberação.
- Enviar `Permissions-Policy: camera=(self), microphone=(), geolocation=()` e impedir captura em frames não autorizados. Câmera somente após gesto explícito; nunca solicitar áudio.
- OAuth Google via Managed Auth: validar callback, issuer, audience, state/nonce e sessão no servidor; cookies seguros, HttpOnly e SameSite adequado, proteção CSRF e origem de escrita. Login Google não admite automaticamente usuários: admissão explícita no servidor, fail-closed para não admitidos, sessão expirada/revogada ou configuração ausente.
- Neon PostgreSQL: RLS obrigatória, contexto de identidade por transação derivado da sessão verificada; role da aplicação sem owner/BYPASSRLS e com grants mínimos. Isolar pacientes, compartilhar apenas com consentimento vigente, cuidador sem escrita e revogação efetiva inclusive em concorrência. Não confiar em patient_id enviado pelo cliente. SQL parametrizado e correções append-only.
- RGPD/LGPD: documentar base legal aplicável a dados de saúde, finalidade, minimização, retenção, direitos do titular, operadores/transferências e resposta a incidentes. Consentimento de compartilhamento e eventual consentimento legal devem ser específicos, informados e revogáveis; revisão jurídica e clínica precede uso real.
- Gemini permanece desligado. Qualquer avaliação futura requer opt-in separado, revogável, restrito a educação geral e sem PHI: nenhuma imagem, OCR, medição, identidade, diagnóstico ou tratamento; sem encaminhamento automático do fluxo de captura.

## Consequências e liberação

Maior privacidade e operação local, com custo de download/processamento e revisão humana obrigatória. Offline permite captura/edição em memória, sem fila persistente nem envio automático ao reconectar. Falha ou recarga pode perder o rascunho.

Aplicam-se os gates de `OCR-ACCEPTANCE-MATRIX.md` e todos os bloqueios do roadmap. Testes sintéticos não autorizam uso clínico; publicação clínica exige validação controlada, revisão independente e aprovação explícita dos responsáveis.
