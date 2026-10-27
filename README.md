# Vital Família — MCF-VITAL-FAMILIA-001

RAFAEL · Protótipo Next.js 16 para paciente/cuidador. **Somente dados sintéticos. Não usar clinicamente.** Criado nesta pasta vazia; nenhum projeto externo alterado.

## Executar

Node 22+; `npm ci`, `npm run dev`. Para validar: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`. `.env.example` documenta configuração; não adicionar segredos ao Git. O demo funciona sem credenciais, usa apenas memória React e é reiniciado ao recarregar. CSV baixa somente fixtures e exemplos da sessão. Cuidador é uma simulação somente leitura. Não há login falso apresentado como autenticação real.

## Implementação

- Histórico, formulário validado, gráficos, filtro e CSV com unidades e neutralização de fórmulas.
- Consentimento e compartilhamento revogáveis na simulação e endpoints reais preparados separadamente.
- Manifest, ícone e service worker: somente tela offline genérica em cache; nenhuma medição, sessão, API ou resposta autenticada é armazenada pelo worker. Sem escrita offline.
- Gemini não tem SDK, chave nem chamada de rede. Endpoint responde 503. Uso futuro estritamente educativo, sem dados individuais ou recomendações clínicas.
- Backend fica desligado por padrão. `SYNTHETIC_BACKEND_ENABLED=true` é exclusivamente para staging sintético. A interface atual usa somente o demo; a conexão completa entre UI autenticada e API é uma etapa pendente explícita.

## Preparação Neon PostgreSQL + Managed Better Auth / Google

1. Criar um **novo branch de staging sintético**, sem acessar bases/projetos existentes. Habilitar Neon Managed Auth (baseado em Better Auth), Google e apenas os domínios/callbacks exatos do staging. Desabilitar outros métodos de login no painel.
2. Aplicar `db/001_schema.sql` como proprietário de migração. Criar LOGIN exclusivo e atribuir `vital_app`; configurar DATABASE_URL com TLS verificado e esse LOGIN. **Não usar a URL do proprietário Neon.** A aplicação recusa roles superuser/BYPASSRLS; a revisão de grants deve confirmar ausência de propriedade/membership de owner.
3. Configurar NEON_AUTH_BASE_URL, secret aleatório com 32+ caracteres e APP_ORIGIN exata. Auth usa SDK oficial, handler proxy e sessão consultada no servidor sem cache de sessão local. Validar revogação no provedor antes de qualquer lançamento.
4. Endpoints: `/api/consent` POST aceita `{accepted,version:"2026-10-27.v1"}`; `/api/sharing` GET/POST recebe `{caregiverId,active}`; `/api/records` GET aceita patient e format=csv; POST recebe união glucose/pressure (ver `lib/domain.ts`). Identidade vem da sessão, nunca do corpo. Cuidador só lê/exporta após grant atual. Escrita é exclusiva do paciente. Não há endpoint público de cadastro em nome de outra pessoa.
5. Consentimento é exigido para leitura/escrita; retirada impede acesso e invalida grants anteriores, mesmo após novo consentimento. Nova autorização é obrigatória. Revogação é serializada com acessos pela trava transacional por paciente; não recupera CSV já baixado ou resposta já concluída. Metadados de consentimento/compartilhamento usam definer com search_path fixo para evitar recursão RLS. Apenas a role de migração, que não pode ser a role da aplicação, possui essas tabelas. Medições usam FORCE RLS. UPDATE/DELETE proibidos por grants, políticas e triggers.
6. Append-only não significa retenção eterna: política de retenção, eliminação legal, correções por eventos de substituição e auditoria de leitura/exportação ainda precisam de implementação/revisão antes de dados reais. Não incluir dados sensíveis em logs.

Documentação técnica consultada: [Neon Auth Next.js](https://github.com/neondatabase/neon-js/blob/main/packages/auth/NEXT-JS.md), [autorização Next.js](https://nextjs.org/docs/app/guides/authentication), [manifest](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest).

## Entrega e implantação

Nenhuma publicação clínica autorizada por este artefato. Projeto informado pelo usuário: `vital-familia-pwa`, equipe `predix-ai-br`; não foi vinculado ou alterado automaticamente. Preview fictício é opcional, apenas depois de build validado, com backend e Gemini desligados e sem credenciais. Não fazer deploy de produção por inferência.

Veja [roadmap e checklist](docs/ROADMAP.md) e [resultados reais](docs/VALIDATION.md).
