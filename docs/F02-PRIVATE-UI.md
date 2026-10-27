# F02 — UI privada / HELENA

Entrega local em `feat/f02-private-google-neon-ux`, para integração por GABRIEL. Sem add/commit/push, alterações de banco/migrations, secrets ou dados reais. Contrato HELENA lido em `/home/leo/MCF MISSIONS/mcf-chatgpt-workspace/docs/agentes/HELENA.md`. Implementação baseada no código local e na [fonte oficial Neon indicada](https://github.com/neondatabase/neon-js/blob/main/skills/neon-auth-nextjs/SKILL.md).

## Comportamento entregue

- `/` preserva a demo em memória e os textos/controles padrão de PhotoCapture. Não busca registros reais.
- `/minha-saude` é dinâmica, sem cache. `privateAccess()` chama `actor()` no servidor: flags fechadas, erro, ausência de admissão ou indisponibilidade bloqueiam. Sessão ausente oferece login sem registros. Nenhuma medição é serializada pelo Server Component.
- `createAuthClient()` de `@neondatabase/auth/next` usa o proxy same-origin `/api/auth` já existente: social Google, callback privado, getSession e signOut. O guard existente do proxy continua Google-only/login-only; OAuth não cria admissão.
- O navegador verifica sessão antes de habilitar a interface. Dados aparecem apenas após GET autorizado; APIs/RLS continuam decidindo consentimento e grants em cada operação. Selecionar cuidador ou informar paciente não concede acesso. Cuidador recebe interface de consulta/exportação, sem captura/escrita.
- Consentimento explícito versionado e retirada usam `/api/consent`. Compartilhamento separado, explícito e revogável usa `/api/sharing`. O controle de consentimento pertence à própria conta, não ao paciente informado para consulta.
- OCR permanece local, assets same-origin, canvas sem metadata, preview blob não otimizado. Modo privado opcional preserva default demo; câmera/galeria e fallback manual exigem revisão, unidade e Contexto. Callback passa por schema confirmado e retira o id temporário. API recebe apenas JSON de medição, nunca imagem/OCR bruto.
- Escrita gera chave aleatória independente dos valores. Falha ambígua de rede/5xx permite reenviar o mesmo payload/chave enquanto a página fica ativa. Erros definitivos limpam estado; fechar/ocultar página descarta pendência. Não há persistência entre sessões.
- Histórico JSON não trunca silenciosamente: o backend existente retorna 409 acima de 1000. CSV é buscado diretamente com `format=csv`, sem depender da lista renderizada ou filtrar seus registros. Falhas não geram arquivo parcial.
- Estado, preview e autorização são descartados ao ocultar a página; nova consulta é necessária. Logout limpa a tela antes da requisição. Respostas tardias do histórico/CSV são invalidadas por geração. Sem localStorage, logs de PHI ou armazenamento de registros no service worker existente. Exportações já baixadas permanecem sob responsabilidade do usuário.

## Verificação e limites

Adicionados testes Vitest com mocks do guard, adapter Neon e fetch: flags, sessão ausente, admissão negada/erro, JSON confirmado, chave de retry, no-store, status de negação e rota de CSV completo. A suíte existente cobre autorização de APIs, revogação e CSV 999/1000/1001. CI existente roda lint, tipos, Vitest e build em GitHub Actions para PR/dispatch. **Nenhum npm/test/lint/typecheck/build foi executado localmente.** Revisão estática não equivale a checks aprovados; nenhum run cloud desta alteração foi iniciado/comprovado.

Não há evidência de E2E OAuth, revisão mobile por navegador, Playwright, sessão real, RLS real ou persistência remota nesta entrega. Preservar a suíte Playwright externa ao integrar; nenhum teste Playwright foi encontrado no checkout. A política de conteúdo atual permite apenas conexões same-origin: validar no staging se o SDK redireciona corretamente para Google e se o callback/login-only é compatível com a configuração Neon instalada.

## Estado do gate / passagem

| Gate | Estado |
| --- | --- |
| UI F02 | Implementada localmente; pronta para revisão/integração após checks cloud |
| A1–A4 UX/OCR | Implementação disponível; aceite independente/mobile pendente |
| A5 CI | PENDENTE GitHub Actions no SHA integrado |
| A6 Neon/OAuth/RLS | BLOQUEADO; nenhuma configuração ou validação remota executada |
| A7 Privacidade/segurança | BLOQUEADO; revisão independente e políticas pendentes |
| A8 Entrega | PENDENTE integração por GABRIEL e evidências de deployment |
| A9 Dados reais | NO-GO / NÃO AUTORIZADO |

Backend mantém `SYNTHETIC_BACKEND_ENABLED`, `AUTH_SECURITY_VALIDATED` e `REAL_DATA_APPROVED` como exigências cumulativas existentes. Nenhuma flag foi ativada ou relaxada. GABRIEL integra e abre/atualiza PR para checks cloud; responsáveis de AUTH/Neon e segurança apresentam as evidências da matriz `docs/ops/F02_GATE_MATRIX.md`. MESTRE recebe estado para orquestração, sem aceite presumido dos especialistas. Nenhuma mensagem externa foi enviada.
