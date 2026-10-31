# Vital Família — checkpoint do Google Stitch

## Identidade
- Projeto: **Vital Família Mobile UI**
- Conta Google do projeto: `potiguaradm23@gmail.com`
- URL: https://stitch.withgoogle.com/u/2/projects/10079289154118155401
- Última reconciliação por MESTRE: **31/10/2026**, inspeção somente leitura via MESTRE Browser Control.
- Issue de integração: [VITAL-UI-001 #26](https://github.com/leon337/vital-familia-pwa/issues/26).
- Situação: **12 telas geradas no Stitch; aceitação visual, correções de texto e integração Next.js pendentes**.

## Fontes públicas
- Prancha visual: [`vital-familia-12-telas.png`](./vital-familia-12-telas.png)
- Briefing: [`stitch-briefing.md`](./stitch-briefing.md)
- Design system: [`../../DESIGN.md`](../../DESIGN.md)
- Código existente: https://github.com/leon337/vital-familia-pwa

## Evidência de 12 telas distintas no canvas do Stitch
A consulta ao snapshot de acessibilidade retornou estas 12 interfaces separadas, com conteúdo dentro de iframes de tela (não apenas títulos em relatório):

1. Abertura e Login Google
2. Dashboard Principal
3. Registrar Glicemia
4. Registrar Pressão e Pulso
5. Histórico de Medições
6. Gráficos e Tendências
7. Assistente Vital IA
8. Relatórios de Saúde
9. Familiares e Cuidadores
10. Gerenciador de Lembretes
11. Perfil e Acessibilidade
12. Dashboard Modo Escuro

O sistema de design gerado no canvas foi denominado **Serene Hearth Health** e utiliza a cor primária `#145C4D`. A presença de telas **não comprova** implementação funcional nem que cada elemento já tenha passado por inspeção visual, WCAG ou teste de exportação. 

## Achados que impedem aceite sem ressalvas
- Na interface **Registrar Pressão e Pulso** aparece: `Esta anotação será sincronizada instantaneamente no caderno de saúde compartilhado com os filhos e o Dr. Carlos.`. **Não há integração operacional comprovada; substituir por informação de demonstração.**
- Na interface **Relatórios** aparece: `Gera um link seguro com validação biométrica de 7 dias`. **Não há validação biométrica operacional comprovada; remover promessa.**
- A interface de relatórios também menciona compartilhamento direto por WhatsApp. Validar implementação antes de qualquer linguagem de disponibilidade.
- Algumas telas exibem informações ou ações com aparência de uso clínico/medicamentos; todos os dados e fluxos devem ser explicitamente fictícios até revisão independente e gate médico-jurídico quando aplicável.
- A integração com `app/page.tsx` ainda não foi executada: a `main` mantém demo sintética em memória com quatro áreas.

## Riscos e limites
**Uso clínico: NO-GO.** Não adicionar fotos, valores reais de saúde, credenciais ou identidade pessoal aos exemplos, código público, ferramentas de IA ou CI. Não ativar Google OAuth, Neon/RLS, Gemini, alertas clínicos ou compartilhamento real por inferência. A fonte da F02 continua em [Issue #2](https://github.com/leon337/vital-familia-pwa/issues/2), com dependências em [#22](https://github.com/leon337/vital-familia-pwa/issues/22) e [#17](https://github.com/leon337/vital-familia-pwa/issues/17).

## Próximo handoff governado
MESTRE → SOFIA/Produto-UX: mapear as 12 telas para rotas, estados e componentes React, revisar contrastes e cópias que sugerem integrações inexistentes. Entregar mapa e especificação **revisáveis**, sem alterar backend. Depois, RAFAEL poderá implementar em branch separada, sujeito a CI por SHA, QA RENATO, revisão EMILY e gate LÉO. LEANDRO segue como autoridade humana final.

**Estado do checkpoint:** `AGUARDANDO_DEPENDENCIA_EXTERNA` para revisão/execução das etapas; a geração das 12 telas está `CONCLUIDA`, mas a entrega do app não.
