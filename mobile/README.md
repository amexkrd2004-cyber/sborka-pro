# СборкаПро — мобильное приложение (Expo)

## Запуск

1. Скопируйте `mobile/.env.example` в `mobile/.env`, укажите **`EXPO_PUBLIC_API_URL`** (тот же хост, что у Railway backend).
2. После смены `.env` перезапустите Metro с очисткой кэша: `npx expo start -c`.
3. `npm run android` или QR в **Expo Go** (для этого MVP достаточно).

Учётные данные — те же, что для `POST /auth/login` на сервере.
