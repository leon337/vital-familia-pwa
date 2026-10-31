# VITAL-UI-001 — contrato de integração visual Stitch → Next.js

**Fase:** UI-01 (planejamento, Classe C por contexto de saúde)  
**Coordenador:** MESTRE | **Autoridade humana:** LEANDRO | **Gate interno:** LÉO  
**Repositório:** `leon337/vital-familia-pwa` | **Issue:** [#26](https://github.com/leon337/vital-familia-pwa/issues/26)  
**Design:** [12 telas Google Stitch](https://stitch.withgoogle.com/u/2/projects/10079289154118155401)  
**Baseline:** `main@0d5bfa0afc42b33b79968d4b5b70c6534640797d` (31/10/2026; reconfirmar antes de implementar).

## 1. Diagnóstico inicial
- `app/page.tsx` atual concentra quatro áreas: **Visão geral, Nova medição, Histórico, Privacidade**; usa estado React e `syntheticRecords`.
- O Stitch dispõe de 12 interfaces, mas **não há prova de integração** com o Next.js, backend, autenticação ou armazenamento.
- O `README.md` estabelece dados 100% sintéticos, backend desligado por padrão e Gemini sem SDK/chaves/chamadas.
- F02 tem PRs de OCR/Auth/Neon separados; **não integrar ou mesclar** suas mudanças como efeito lateral desta frente.

## 2. Matriz de interface → implementação proposta (a validar por SOFIA)
| Tela Stitch | Rota/cenário candidato | Componente e comportamento em demo sintética |
| --- | --- | --- |
| 01 Login | `/entrar` | Apresentação visual de entrada; indicar que Google OAuth real ainda não foi habilitado |
| 02 Dashboard | `/` | `HealthSummary`, `QuickActions`, dados sintéticos |
| 03 Glicemia | `/registros/glicemia/novo` | `GlucoseForm`, mg/dL, data/contexto, validação local |
| 04 Pressão | `/registros/pressao/novo` | `BloodPressureForm`, SIS/DIA, pulso opcional, revisão de texto |
| 05 Histórico | `/registros` | Filtros, lista, estados vazios, CSV sintético |
| 06 Gráficos | `/tendencias` | Tendências sem interpretação clínica |
| 07 Assistente | `/assistente` | Interface demonstrativa, disclaimer e Gemini desligado |
| 08 Relatórios | `/relatorios` | Preview/CSV sintético; exportação PDF/WhatsApp só se realmente implementada |
| 09 Familiares | `/familia` | `CaregiverCard`, permissões **apenas simuladas** |
| 10 Lembretes | `/lembretes` | `ReminderList` com controles locais fictícios; sem notificações reais |
| 11 Perfil | `/perfil` | Contraste/fonte/tema, sem dados pessoais reais |
| 12 Dashboard dark | variação temática de `/` | **Mesma rota e estrutura**, tema escuro acessível; não duplicar regra de negócio |

**Nota de arquitetura:** rotas são proposta, não decisão final. SOFIA deve escolher entre App Router ou navegação interna considerando acessibilidade, PWA, SEO e compatibilidade da F02.

## 3. Componentes compartilhados propostos
- `AppShell`, `BottomNavigation`, `ScreenHeader`, `PageNotice`, `MetricCard`.
- `GlucoseForm`, `PressureForm`, `MeasurementHistory`, `TrendChart`, `ReportPreview`.
- `CaregiverPermissionCard`, `ReminderRow`, `AccessibilitySettings`, `DemoOnlyNotice`.
- Tokens semânticos para cor, tipografia, raio, espaçamento, contraste e temas light/dark. Preservar primária `#145C4D`, **sujeita a contraste real**.

## 4. Prioridade de correção — cópias e UX
1. Remover promessa de sincronização instantânea com familiares/médicos.
2. Remover promessa de link biométrico de sete dias e compartilhamento por WhatsApp quando não implementados.
3. Garantir rótulo claro **Exemplo fictício / sem uso clínico** antes e após ações relevantes.
4. Não confundir assistência informativa de IA com chat com capacidade diagnóstica.
5. Manter alvos grandes, foco visível, teclado e leitores de tela; testar 390×844, 1366×768 e tela ampliada.
6. Preferir formulário de OCR futuro apenas como entrada condicionada à F02; a UI atual continua com inputs sintéticos.

## 5. Entregáveis e gates
- **SOFIA:** aprovar mapa de rotas, acessibilidade e separação de fronteiras, registrar ADR se necessário.
- **RAFAEL:** PR isolado com componentes/telas e testes, sem tocar DB/Auth/OCR de F02.
- **RENATO:** E2E 12 telas, teclado, semântica, contraste, mobile/desktop e não regressão do demo.
- **EMILY:** análise independente de textos enganosos, superfícies sensíveis, scripts e controles de acesso.
- **LÉO:** gate interno exato SHA; sem aprovação para dados reais ou deploy clínico.
- **MESTRE:** controlar dependências, evidências, checkpoint e retorno ao pai MCF #477.

A atribuição nominal **não é recibo de execução**: só mudar estado quando houver entrega de ferramenta/PR/review verificável.

## 6. Aceite
- [ ] Design revisado por tela; 12/12 com fidelidade à prancha e identidade consistente.
- [ ] 12/12 interfaces navegáveis na aplicação React; modo escuro como variação de tema.
- [ ] Nenhuma alegação de serviço real inexistente, nem uso de dados de saúde reais.
- [ ] Responsividade, WCAG, E2E, lint, types, testes, build e audit aprovados em CI para SHA exato.
- [ ] QA e auditoria independentes, com ausência de P0/P1.
- [ ] PR aprovado pelo gate LÉO e, quando aplicável, autorização de LEANDRO.
- [ ] PRF/checkpoint MCF produzido para esta fase Classe C antes de declarar `ENTREGUE`.

## 7. Estado e próximo passo
`PLANEJADO / NO-GO para produção clínica`. Próxima ação: obter aprovação arquitetural e checklist visual da SOFIA; depois abrir PR de implementação UI em branch isolada. Nenhum deploy ou merge foi autorizado por este documento.
