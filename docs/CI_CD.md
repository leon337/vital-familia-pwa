# CI/CD canônico — Vital Família

## Plataforma e responsabilidades
- **GitHub Actions** executa ESLint, TypeScript, Vitest, build Next.js e auditoria de dependências. Não execute tais comandos no notebook para as próximas entregas.
- **Vercel Git Integration** está vinculada ao repositório GitHub privado `leon337/vital-familia-pwa`, branch `main`. Commits na `main` disparam deploy nos servidores de build da Vercel (não no notebook).
- **GitHub Actions CD** observa a conclusão do CI, verifica o status de implantação na Vercel correspondente ao mesmo commit e executa smoke HTTP remoto contra `https://vital-familia-pwa.vercel.app`.
- CI: [workflow](../.github/workflows/ci.yml). CD: [workflow](../.github/workflows/cd.yml). Status: [Actions](https://github.com/leon337/vital-familia-pwa/actions).

## Limitação importante
A integração Git nativa da Vercel começa a implantação em paralelo ao CI, não aguarda os gates do GitHub Actions. O job CD do GitHub verifica após o CI, mas **não é um gate anterior à publicação**. Antes de liberar registros reais, tornar obrigatório PR com CI aprovado/branch protection e configurar deploy condicionado a sucesso de CI; jamais expor dados médicos sem validação de Auth/RLS, auditoria e consentimento.

## Políticas atuais
- Publicação demonstração SINTÉTICA (sem API com dados reais e Gemini desligado).
- Endereço público responde sem Vercel SSO; acesso clínico permanece bloqueado por padrão.
- Repositório privado, sem credenciais em código ou workflow; `GITHUB_TOKEN` somente leitura.
- Não utilizar a sessão ou o token pessoal da Vercel como segredo de GitHub Actions.
- Nenhuma execução de lint/test/build no notebook como caminho de entrega a partir desta correção.
- Não chamar o estado de “aplicação clínica pronta” até conclusão dos gates do roadmap.
