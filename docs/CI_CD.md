# CI/CD canônico — Vital Família

## Plataforma e responsabilidades
- **GitHub Actions** executa ESLint, TypeScript, Vitest, build Next.js e auditoria de dependências. Não execute tais comandos no notebook para as próximas entregas.
- **Vercel Git Integration** está vinculada ao repositório GitHub privado `leon337/vital-familia-pwa`, branch `main`. Commits na `main` disparam deploy nos servidores de build da Vercel (não no notebook).
- **GitHub Actions CD** observa a conclusão do CI, verifica o status de implantação na Vercel correspondente ao mesmo commit e executa smoke HTTP remoto contra `https://vital-familia-pwa.vercel.app`.
- CI: [workflow](../.github/workflows/ci.yml). CD: [workflow](../.github/workflows/cd.yml). Status: [Actions](https://github.com/leon337/vital-familia-pwa/actions).

## Gate real de promoção em produção
O projeto Vercel possui o Deployment Check `chk_7af79b64-a318-4089-80b7-55d9794d2dc0`, configurado com `source.kind=git-provider`, `provider=github` e `externalCheckName=Lint, tipos, testes, build e dependências`. Esse check bloqueia a atribuição do domínio de produção (`deployment-alias`) até GitHub Actions confirmar o resultado **SUCCESS** do mesmo commit. Timeout 600 segundos, ambiente production. Build ocorre exclusivamente nos servidores da Vercel; qualidade e gates de entrega são executados em runners GitHub. Não utilizar notebook para CI, lint, testes ou builds.

O job CD em GitHub, disparado após CI na `main`, também verifica a implantação do SHA na Vercel e realiza smoke HTTP remoto da demonstração pública, exigindo `/ => 200`, `/manifest.webmanifest => 200` e `/api/records => 503`. O status clínico continua bloqueado até testes Neon/RLS/OAuth, Gemini e governança LGPD.

## Políticas atuais
- Publicação demonstração SINTÉTICA (sem API com dados reais e Gemini desligado).
- Endereço público responde sem Vercel SSO; acesso clínico permanece bloqueado por padrão.
- Repositório privado, sem credenciais em código ou workflow; `GITHUB_TOKEN` somente leitura.
- Não utilizar a sessão ou o token pessoal da Vercel como segredo de GitHub Actions.
- Nenhuma execução de lint/test/build no notebook como caminho de entrega a partir desta correção.
- Não chamar o estado de “aplicação clínica pronta” até conclusão dos gates do roadmap.
