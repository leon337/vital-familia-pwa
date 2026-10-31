> **NOTA DE GOVERNANÇA — 31/10/2026:** Esta é a matriz **histórica** de OCR local. Para a diretriz atual de LEANDRO (Gemini multimodal como leitor principal), usar a [matriz VISION-GEMINI](./VISION-GEMINI-ACCEPTANCE-MATRIX.md) e [ADR-003](./ADR-003-gemini-native-vision.md). Cenários de legibilidade e revisão humana permanecem úteis, mas gates específicos de Tesseract/worker não autorizam implantação Gemini nem envio de dados reais.

# Matriz de aceitação — captura e OCR

Estado: critérios definidos; **nenhum teste executado por este documento**. Referências: ADR-002 e `docs/ROADMAP.md`. Usar somente imagens geradas e identidades/medições sintéticas nesta etapa, sem fotografias de pacientes.

P0 bloqueia integração com dados reais e liberação do fluxo. P1 bloqueia publicação da captura foto como funcionalidade suportada. Qualquer violação de privacidade, autorização ou integridade encontrada em P1 passa a P0. Entrada manual não contorna gates de segurança do backend.

| ID | Gate | Cenário sintético | Resultado obrigatório |
| --- | --- | --- | --- |
| OCR-01 | P0 | Glicemia `108 mg/dL`, `5,6 mmol/L`, `5.6 mmol/L` | Rascunho com valor e unidade corretos; decimal inequívoco normalizado; sem conversão; confirmação obrigatória. |
| OCR-02 | P0 | Dígito apagado, `I08`, unidade ausente, decimal ambíguo, múltiplos valores | Nenhum número/unidade inferido; campo vazio ou ambiguidade explícita, resolvida manualmente antes do envio. |
| OCR-03 | P0 | Display `SYS 120 DIA 80 PUL 72`, ordens e posições variadas | Associação pelos rótulos; SYS/DIA em mmHg e PUL em bpm; nenhum embaralhamento. |
| OCR-04 | P0 | SYS/DIA/PUL ausente, duplicado ou conflitante; SYS menor que DIA | Não completar, trocar ou corrigir automaticamente; revisão manual e validação dos campos exigidos. |
| OCR-05 | P0 | Revisar, editar, cancelar, confirmar; valor malformado/incompleto | Zero gravações antes de confirmação válida; cancelamento descarta rascunho; payload corresponde exatamente ao conjunto confirmado. |
| PRIV-01 | P0 | Foto com EXIF GPS/identidade; concluir, cancelar, sair e recarregar | Nenhuma imagem, EXIF ou OCR bruto em rede, armazenamento, cache, logs ou telemetria; recursos liberados; somente dados estruturados confirmados podem seguir à API. |
| PRIV-02 | P0 | Modo offline seguido de reconexão e atualização do service worker | Sem persistência de foto/rascunho sensível, fila de upload ou envio automático; nova ação explícita para envio com autorização vigente. |
| SEC-01 | P0 | CSP em produção; tentativa de worker/script externo, embed e conexão não autorizada | Tesseract local funciona sob política restrita; destinos e frames não autorizados bloqueados; sem relaxamento genérico de eval. |
| SEC-02 | P0 | Permissão negada, iframe de outra origem, início/fim da câmera | Política camera=(self); microfone/geolocalização proibidos; gesto explícito; tracks encerradas; fallback manual disponível. |
| AUTH-01 | P0 | Google válido/inválido, callback adulterado, sessão expirada/revogada, usuário não admitido | Apenas sessão validada de usuário admitido acessa backend; demais casos negados sem escrita; CSRF/origem rejeitados. |
| DB-01 | P0 | PostgreSQL Neon real com dois pacientes, sem sessão, patient_id forjado | RLS isola leitura/escrita; sem sessão falha fechado; identidade vem da sessão; role não é owner/BYPASSRLS. |
| DB-02 | P0 | Grant/revoke/reconsentimento; cuidador escreve; UPDATE/DELETE/TRUNCATE | Compartilhamento exige consentimento atual; cuidador sem escrita; mutações proibidas negadas; correções append-only autorizadas. |
| DB-03 | P0 | Revogação concorrente com leitura/exportação, em conexões separadas | Nenhum acesso autorizado após revogação efetiva; sem vazamento por contexto de conexão reutilizada; semântica transacional documentada e verificada. |
| API-01 | P0 | Repetição de POST, corpo excessivo, abuso e exportação >1.000 itens | Idempotência, limites de corpo/rate limit, paginação e sinalização de truncamento conforme roadmap; auditoria mínima sem conteúdo sensível. |
| AI-01 | P0 | Fluxo completo com Gemini desligado; eventual opt-in separado | Nenhuma chamada Gemini no fluxo; futura educação geral exige opt-in e bloqueia todo PHI, inclusive medições e OCR. |
| LEGAL-01 | P0 | Revisão documental de finalidade, base legal, retenção e direitos | Responsáveis aprovam requisitos RGPD/LGPD e tratamento de dados de saúde antes de dados reais; uso clínico mantém gates próprios do roadmap. |
| UX-01 | P1 | Android/iOS suportados, câmera/galeria, permissão negada e browser incompatível | Captura e revisão utilizáveis; falha mantém entrada manual; suporte e limitações documentados. |
| OCR-06 | P1 | Rotação, reflexo, baixo contraste, corte, desfoque e fundo com números | Acerto quando inequívoco ou recusa segura; nenhum candidato incorreto tratado como confirmado. Registrar acertos/recusas por tipo de display e unidade. |
| RES-01 | P1 | Arquivo inválido/enorme, timeout, worker indisponível, memória limitada | Limites atuam sem travar interface; erro compreensível; cancelamento e preenchimento manual funcionam. |
| A11Y-01 | P1 | Teclado, leitor de tela, zoom, contraste e edição de decimal/unidade | Rótulos, foco, erros e confirmação acessíveis; usuário identifica e corrige todos os campos. |

## Evidências e saída dos gates

Para cada caso, registrar fixture sintética, versão do app/Tesseract/idioma, browser/dispositivo, resultado esperado/observado e evidência sem dados sensíveis. Verificar payload, tráfego, armazenamento e headers; testes RLS exigem PostgreSQL real, não mocks. Casos ainda não executados ficam pendentes, nunca aprovados por inspeção documental.

- **P0:** todos os casos P0 aprovados, zero inferências silenciosas, zero gravações sem confirmação/consentimento/autorização e zero vazamentos; cumprir staging sintético do roadmap antes de integrar dados.
- **P1:** todos os casos P1 aprovados na matriz de suporte declarada, com limites de tamanho/tempo e metas de desempenho definidos antes da execução. Falha segura e fallback são obrigatórios mesmo quando OCR não reconhece o display.
- **Uso clínico:** exige ainda estudos controlados consentidos, validação clínica/usabilidade, revisão de segurança e jurídica, operação/backup e aprovação explícita descritos no roadmap. A aprovação desta matriz sintética não substitui esses requisitos.
