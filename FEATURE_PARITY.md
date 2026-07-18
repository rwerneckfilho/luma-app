# Paridade funcional com o luma-front-webapp

Esta matriz trata o `luma-front-webapp` como referência funcional. Recursos específicos de navegador (PWA, Service Worker e Web Push) são substituídos por equivalentes nativos; não são embarcados no app.

| Área no webapp | Continuidade no app nativo | Implementação principal |
| --- | --- | --- |
| Login, cadastro e confirmação de e-mail | Fluxos nativos, sessão Supabase protegida em SecureStore | `src/app/(auth)`, `src/auth` |
| Esqueci/alterar senha | PKCE, token hash e callback por `luma://auth/update-password` | `src/app/auth`, `src/lib/deepLinks.ts` |
| Onboarding | Canais, WhatsApp, primeiro medicamento/rotina, amostra e cuidador opcional | `src/features/onboarding` |
| Início e medicações do dia | Progresso, estados, atualização periódica e pull-to-refresh | `src/features/home` |
| Marcar tomada/pular dose | No horário, agora, manual, antecipação confirmada e conflitos | `src/features/home`, `src/dailyMedications` |
| Uso se necessário (PRN) | Prévia de limites, alertas, confirmação e registro manual | `src/features/home`, `src/asNeededUsageLogs` |
| Medicamentos | Busca, criação, edição, arquivamento e compartilhamento nativo | `src/features/medications`, `src/medications` |
| Importação com IA | Texto, JPEG, PNG, WebP e PDF via API do `luma-core` | `src/features/imports`, `src/medicationImports` |
| Rotinas | Criar, revisar, pausar, reativar, cancelar e ver versões | `src/features/routines`, `src/routines` |
| Agendamentos | Diário, semanal, intervalo, a cada N semanas, mensal, ciclos, fases e múltiplas doses | `src/features/medications`, `src/routines/routineSchema.ts` |
| Histórico | Períodos, filtros, métricas, timeline agendada e PRN | `src/features/history`, `src/history` |
| Perfil | Foto privada, Luma ID, idioma, fuso, WhatsApp, senha e logout | `src/features/profile`, `src/profilePhotos`, `src/me` |
| Relações de cuidado | Convites, aceite/recusa, permissões, escopo, preferência e encerramento | `src/features/care`, `src/care` |
| Timeline e rotinas do paciente | Visualização autorizada e revisão de rotina pelo cuidador | `src/features/care` |
| Assistente LUMA | Lista paginada, criação, transcript, composer e SSE retomável contra `luma-ai`; fake somente em desenvolvimento sem URL configurada | `src/features/ai`, `src/ai` |
| PWA/Web Push | Substituído por Expo Push real para iOS e Android | `src/notifications` + `luma-core` + `luma-notifications` |
| Ações na tela bloqueada | `Tomei` e `Pular`, inclusive para alerta atrasado; task headless no Android | `src/notifications/backgroundTask.ts`, `src/notifications/responseProcessor.ts` |
| Internacionalização | pt-BR, inglês e espanhol, incluindo ações do sistema | `src/i18n` |

## Critérios operacionais antes da publicação

- aplicar em ordem as migrations `20260712000300_native_app_push_support.sql`, `20260712000400_enforce_profile_photo_relationship_validity.sql` e `20260712000500_expo_push_receipt_reconciliation.sql` do `luma-core`;
- publicar juntos os contratos nativos do `luma-core` e `luma-notifications`;
- definir um EAS Project ID real e cadastrar credenciais APNs/FCM;
- configurar `EXPO_PUSH_DRY_RUN=false` somente no ambiente que possui credenciais válidas;
- autorizar `luma://auth/update-password` nos redirect URLs do Supabase;
- definir `EXPO_PUBLIC_AI_API_BASE_URL` com HTTPS e publicar uma versão compatível de `C-AI-PUBLIC` antes de ativar o assistente em produção;
- validar retomada SSE e suspensão/retorno em aparelhos físicos iOS e Android;
- validar as duas ações em aparelhos físicos iOS e Android, com app em foreground, background e encerrado;
- executar builds internos antes dos perfis de produção.
