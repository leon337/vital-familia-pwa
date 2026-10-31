# Vital Família — solicitação de design para Google Stitch

## Objetivo
Criar ou aprimorar, **em um único projeto**, 12 interfaces **móveis, editáveis e consistentes** para o aplicativo Vital Família. O produto acompanha registros de glicemia e pressão arterial e compartilha informações com familiares/cuidadores autorizados. Não é um dispositivo médico.

## Fontes públicas de referência
- Prancha visual original (prioridade estética): https://github.com/leon337/vital-familia-pwa/blob/main/docs/design/vital-familia-12-telas.png
- Imagem PNG direta: https://raw.githubusercontent.com/leon337/vital-familia-pwa/main/docs/design/vital-familia-12-telas.png
- Código do projeto existente: https://github.com/leon337/vital-familia-pwa
- Visão técnica: https://github.com/leon337/vital-familia-pwa/blob/main/README.md
- Roadmap: https://github.com/leon337/vital-familia-pwa/blob/main/docs/ROADMAP.md

O código já usa Next.js 16, React 19 e TypeScript; **não inventar integrações clínicas ou de IA que ainda não existem**. Se a plataforma não puder abrir URLs externas, baseie-se na descrição a seguir e no PNG que for anexado.

## Telas a gerar
1. Abertura e login com Google
2. Tela inicial / dashboard de saúde
3. Registro de glicemia (mg/dL, contexto de medição, data/hora, notas)
4. Registro de pressão arterial (sistólica/diastólica mmHg, pulso bpm, notas)
5. Histórico de medições e filtros
6. Gráficos e tendências (sem interpretação clínica automática)
7. Assistente Vital IA (interface demonstrativa, sem diagnóstico)
8. Relatórios e exportação
9. Compartilhamento com familiares/cuidadores e permissões
10. Lembretes de medições
11. Perfil e configurações
12. Dashboard no modo escuro e recursos de acessibilidade

## Design system
Manter identidade original da prancha: verde e branco, tons pastel, formas arredondadas, sombras discretas, iconografia simples e linguagem acolhedora sem infantilização. Interfaces em português do Brasil. Navegação inferior consistente, estados vazios, loading, erro, sucesso e confirmação. Fontes legíveis, alvos de toque adequados, alto contraste, letras grandes e layout responsivo. Tokens e componentes reutilizáveis.

## Regras de entrega
- Criar 12 telas individuais dentro de **um único projeto**, não uma nova imagem colada.
- Elementos e componentes devem ser editáveis e organizados.
- Preservar a fidelidade visual do PNG e sinalizar qualquer alteração relevante.
- Usar apenas dados sintéticos de demonstração.
- Não afirmar login, integração Gemini, notifications ou compartilhamento como operacionais se forem somente mockups.
- Não indicar valores de referência clínica, diagnóstico, alarmes médicos ou recomendações de tratamento.
- Preferir fluxo de navegação que possa ser prototipado e exportado para engenharia frontend.
- Gerar primeiro o conjunto completo e depois validar a consistência das 12 telas.
