# Roadmap / checklist de liberação

## Entregue localmente
- [x] Demo sintético em memória, paciente e cuidador simulado.
- [x] Histórico, validação de entrada, gráfico, filtro, CSV e layout responsivo.
- [x] Manifest e fallback offline sem cache de dados sensíveis.
- [x] API fail-closed, origem em escrita, identidade da sessão, SQL parametrizado.
- [x] Migração com RLS, grants mínimos, consentimento e compartilhamento append-only.
- [x] Gemini desligado sem credenciais ou cliente de rede.

## Staging sintético — obrigatório antes de integrar dados
- [ ] Provisionar novo branch Neon, role dedicada e aplicar migração com owner isolado.
- [ ] Testar RLS em PostgreSQL real: sem sessão, isolamento de dois pacientes, grant/revoke, reconsentimento, cuidador sem escrita, UPDATE/DELETE/TRUNCATE, owner/BYPASSRLS proibidos.
- [ ] Testar concorrência de revogação e exportação em conexões separadas.
- [ ] Configurar Managed Auth Google e testar callback, logout, sessão expirada e revogada, CSRF e domínios permitidos.
- [ ] Integrar UI autenticada com API (o demo deliberadamente não a utiliza).
- [ ] Paginação/exportação acima de 1.000 registros; sinalizar truncamento antes de liberar backend.
- [ ] Idempotência para repetição de POST, rate limiting distribuído e limite de corpo no gateway.
- [ ] Auditoria mínima de leitura/exportação, retenção e correções append-only.
- [ ] Validação dos ícones PNG 192/512 e maskable e da instalação real Android/iOS, atualização do service worker e testes offline.
- [ ] E2E com navegador, acessibilidade assistiva, contraste, dispositivos e fusos horários.

## Antes de qualquer uso clínico
- [ ] Testes reais controlados com consentimento apropriado e equipe responsável.
- [ ] Revisão de segurança independente, LGPD, base legal, direitos do titular, retenção e incidentes.
- [ ] Validação clínica e de usabilidade; não gerar alvos, alertas ou interpretações sem aprovação clínica.
- [ ] Backup/restauração, monitoramento sem dados sensíveis e plano de suporte.
- [ ] Aprovação explícita de responsáveis antes de publicação clínica.

Gemini só poderá ser avaliado como educação geral, por opt-in separado e sem envio de medições, identidade, diagnóstico ou tratamento. Permanece desabilitado neste projeto.
