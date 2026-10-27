# EDUARDO — entrega backend F02 / issue #2

Escopo: branch `feat/f02-neon-backend-secure`. Contrato canônico consultado: `leon337/multiagent-collaboration-framework/docs/agentes/EDUARDO.md` (main, blob `7a992aea07f9d659509b03d9016ca19110f12efc`). MESTRE governa; implementação restrita ao backend. Sem alterações em página, estilos ou ADR da SOFIA.

## Estado e bloqueios

Implementação preparada, não homologada para produção. Nenhuma consulta de credencial, execução npm local, migração remota ou alteração Neon/Vercel/main nesta entrega. Google shared, trusted_origins vazio e email/password aberto são informações fornecidas pelo solicitante, não evidências de homologação obtidas nesta execução.

A branch Neon autorizada para planejamento é `br-polished-recipe-b6yh4cw2`. Auth URL fixada à origem/path fornecidos. Backend e proxy auth exigem simultaneamente `SYNTHETIC_BACKEND_ENABLED=true`, `AUTH_SECURITY_VALIDATED=true` e `REAL_DATA_APPROVED=true`; devem permanecer desligados. Flags são controles de operação, não substituem aceite. O proxy só admite Google social, callback Google, sessão e logout; email/password, cadastro e demais endpoints são negados. O endpoint upstream direto ainda precisa ser fechado no Neon: bloquear no proxy não fecha o serviço externo.

## Contrato para RAFAEL e SOFIA

`POST /api/records`: JSON estrito até 4096 bytes; `confirmed:true`, `measuredAt` ISO com timezone e não futuro, `context` existente. Glicemia: `kind:glucose`, `value`, `unit:mg/dL|mmol/L`; pressão: `kind:pressure`, `systolic`, `diastolic`, `pulse`. Campos de imagem, paciente e ator enviados no corpo são recusados. Confirmação é declaração explícita do cliente: servidor não pode provar que uma tela foi visualizada. Consentimento vigente é adicionalmente obrigatório no banco. Faixas são limites técnicos de entrada, sem interpretação clínica.

O contrato legado de demonstração em `measurementSchema` permanece para não afetar a página paralela; persistência usa `confirmedMeasurementSchema`. CSV mantém unidades e pulso. Não há endpoint de upload ou armazenamento de fotos.

## Identidade, RLS e auditoria

Sessão é obtida no servidor por Neon Managed Better Auth sem cache de sessão. `app.actor` isoladamente não autentica. Backend assina HMAC SHA-256 de `txid_current():userId` com `ACTOR_SIGNING_KEY` (mínimo 64 caracteres aleatórios), e `app.actor()` verifica usando chave privada no banco. A chave não é entregue ao papel da aplicação. Assinatura não pode ser reutilizada em outra transação; alterar GUC para B/C invalida a identidade. Chave ausente/divergente bloqueia. Esse desenho confia no servidor e migration owner; comprometimento da chave/owner não é coberto por RLS. Não é JWT/Data API Neon.

Provisionar a mesma chave em secret manager do backend e `vital_private.actor_keys` por canal protegido, sob gate, sem SQL contendo segredo em logs/argumentos. Nenhuma chave real é incluída. `pgcrypto` deve existir no schema `vital_private`; extensão preexistente em outro schema exige revisão, sem relocação automática.

Login dedicado deve herdar somente `vital_app`, sem ownership, CREATE, superuser, BYPASSRLS, memberships de owner ou capacidade de SET ROLE privilegiado. Verificar memberships efetivas e privilégios de public no staging; verificação de runtime de atributos/ownership é defesa adicional, não auditoria completa de memberships. TLS com validação; não inserir sslmode que sobreponha validação em DATABASE_URL.

Todas as queries de entrada usam parâmetros. Cada transação usa advisory lock por paciente para serializar gravação/revogação/leitura pelas APIs. Revogação afeta próximas transações; não recolhe respostas/exportações já entregues. Ordem compartilhada de consentimento e concessão evita empate de timestamps e reativação de concessão antiga. INSERT só nas colunas necessárias impede forjar ordem/data dos eventos. Sem UPDATE/DELETE/TRUNCATE para app. Triggers de auditoria registram ator/paciente/tipo/data sem copiar payload/foto; append-only inclusive histórico de consentimento e compartilhamento. Auditoria cobre escritas; auditoria de leitura/exportação e política final de retenção/LGPD precisam de ADR/aceite antes de dados reais.

## Migração staging e recovery (somente cloud, após BRUNO/EMILY)

1. Ambiente protegido GitHub com revisores BRUNO/EMILY; confirmar host/branch pelo painel/API e escopo das credenciais, sem registrar connection string. Variáveis de script não comprovam identidade do destino nem aprovação humana.
2. Backup anterior criptografado e restore em branch descartável. Dump custom-format por `pg_dump --format=custom --no-owner` em runner protegido; criptografar antes de armazenamento, acesso restrito e expiração. Inclui chave privada: tratar como segredo; não publicar como artifact comum.
3. `scripts/staging-migrate.sh` só aceita banco fresco e target declaradamente autorizado. `001_schema.sql` é baseline revisado para instalação nova, NÃO upgrade de instalação existente. Se já aplicado, abortar e preparar migração incremental após inventário/revisão; não apagar histórico nem reaplicar baseline.
4. Provisionar chave e login mínimo por operação governada separada. Não habilitar flags. Rodar matriz abaixo com fixtures sintéticas, depois rollback das fixtures.
5. `scripts/staging-recovery.sh` restaura backup somente em destino descartável vazio, role previamente provisionada, transação única e sem --clean. Rotacionar chave restaurada e cookie secret antes de ligar aplicação; validar grants/RLS/contagens/histórico. Falha: manter serviço bloqueado, conservar origem/backup, corrigir em nova branch. Nunca apontar restore diretamente a produção.

## Evidência e plano A/B/C

GitHub Actions `Backend security synthetic` cria PostgreSQL 17 descartável, instala baseline e executa SQL com rollback. CI normal na branch executa lint, tipos, Vitest, build e audit. Nenhum resultado é presumido: consultar runs do SHA publicado.

SQL cobre A proprietário, B estranho, C cuidador, consentimento, isolamento de leitura, escrita forjada, cuidador somente leitura, proibição de update/delete/truncate, revogação, retirada/reaceite sem reviver concessão, GUC forjado, chave inacessível e auditoria não forjável. Vitest parametriza contratos completos/inválidos, ausência de confirmação, unidade, pulso e tentativa de foto/IDOR.

Teste Neon real pendente após gate: três contas Google de teste sem dados reais; comprovar fechamento upstream de email/password e trusted origins/callbacks exatos; login/logout/expiração/revogação de sessão; A consente e insere leitura confirmada; B recebe 403 sem payload; C recebe 403, passa a somente leitura após concessão, perde acesso após revogação/retirada; reaceite não restaura concessão; testar concorrência com pool, rollback e reuso de conexão sem herdar ator; SQL direto como login mínimo não lê sem assinatura nem permite assumir owner; comparar auditoria append-only e restore. Registrar apenas IDs sintéticos, status e SHA, nunca cookies/tokens/leitura pessoal.

Aceite A6/A7/A9 permanece pendente de evidência cloud, ADR SOFIA e revisão independente EMILY/BRUNO. Entrega ao MESTRE/LÉO para coordenação do gate, sem declarar produção liberada.
