# LUMA App

Aplicativo nativo da LUMA para iOS e Android, construído com Expo SDK 56 e React Native. Este projeto não é uma PWA nem encapsula o webapp em WebView.

## Arquitetura

O aplicativo mantém a divisão já existente na plataforma:

- `luma-core` (FastAPI) é o backend de domínio e a API consumida pelo app;
- `luma-ai` é o backend isolado do assistente e acessa dados clínicos somente pelos contratos do `luma-core`;
- Supabase fornece Auth, Storage e PostgreSQL, mas não substitui o backend;
- `luma-notifications` planeja e envia WhatsApp, Web Push e Expo Push;
- `luma-front-webapp` continua sendo o cliente web e a referência de paridade funcional.

O app usa Supabase diretamente apenas para sessão de autenticação e foto privada de perfil. Medicamentos, rotinas, histórico, relações de cuidado, preferências e ações de dose passam pelo `luma-core` com o JWT Supabase.

## Configuração local

Requisitos: Node.js compatível com Expo SDK 56, Xcode para iOS e/ou Android Studio para Android.

```bash
cp .env.example .env
npm install
npm run ios
# ou
npm run android
```

Variáveis públicas obrigatórias:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_AI_API_BASE_URL`, a origem do `luma-ai` (HTTPS obrigatório em produção)
- `EXPO_PUBLIC_EAS_PROJECT_ID` para Expo Push em builds reais
- `EXPO_PUBLIC_AUTH_REDIRECT_URL`, normalmente `luma://auth/update-password`

Em desenvolvimento, o backend usa `http://localhost:8000` no iOS e `http://10.0.2.2:8000` no emulador Android quando `EXPO_PUBLIC_API_BASE_URL` não está definido.
O assistente usa o fake em memória quando `EXPO_PUBLIC_AI_API_BASE_URL` não está definido em
desenvolvimento. Quando definido, HTTP sem TLS só é aceito para `localhost`, `127.0.0.1` e
`10.0.2.2`; builds de produção falham fechados sem uma origem HTTPS válida.

## Notificações nativas

O app registra cada instalação em `POST /v1/me/native-push-subscriptions`. O token Expo fica sob controle do backend e não é devolvido pelas respostas públicas.

Lembretes normais e atrasados usam:

- categoria `luma_medication_actions`;
- canal Android `medication_reminders` com importância alta;
- ações `MARK_TAKEN` e `SKIP_DOSE` na tela bloqueada;
- tokens opacos, distintos, de uso único para `POST /v1/push-actions/taken` e `/skipped`;
- deep links `luma://home?event_id=...` sem tokens na URL.

No Android, os botões são processados por uma task nativa mesmo com o app em segundo plano ou encerrado, sem exigir que a tela do app seja aberta. No iOS, os botões continuam disponíveis na tela bloqueada e abrem o app para concluir a ação, pois o Expo não entrega taps de ações interativas a uma task encerrada nessa plataforma.

Ao sair da conta ou remover o dispositivo, a assinatura é desativada, os tokens de ação pendentes expiram, as notificações exibidas são removidas e o registro remoto do sistema operacional é descartado. A remoção explícita também bloqueia o recadastro automático até o usuário ativar o dispositivo novamente.

O serviço consulta os receipts da Expo após a janela recomendada, persiste retries e invalida de forma atômica instalações que retornarem `DeviceNotRegistered`.

Para entrega real, ainda é necessário configurar o projeto EAS, credenciais APNs e FCM v1, aplicar as migrations nativas no banco e ativar Expo Push no serviço de notificações.

## Validação

```bash
npm run typecheck
npm test
npm run lint
npx expo install --check
npx expo config --type public
```

Builds usam os perfis de `eas.json`:

```bash
npx eas build --profile development --platform ios
npx eas build --profile development --platform android
npx eas build --profile production --platform all
```

Consulte [FEATURE_PARITY.md](./FEATURE_PARITY.md) para o mapa entre o webapp e as telas nativas.
