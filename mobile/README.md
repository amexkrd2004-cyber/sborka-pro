# СборкаПро — мобильное приложение (Expo)

Кратко для опытных: в папке `mobile` файл **`.env`** с **`EXPO_PUBLIC_API_URL`**, затем **`npx.cmd expo start -c`** (на Windows в PowerShell так надёжнее), дальше **Expo Go** по QR или **`npm run android`**.

Ниже — **пошагово для новичка** (Windows).

---

## Если красная ошибка: «невозможно загрузить npx.ps1» / «выполнение сценариев отключено»

PowerShell по умолчанию часто **запрещает** запускать `npm.ps1` и **`npx.ps1`**. Сделайте **один** из вариантов.

### Вариант A (рекомендуется): разрешить скрипты только для вашего пользователя

1. Закройте текущее окно PowerShell (если открыто).
2. Нажмите **Win**, введите **`powershell`**, по найденному **Windows PowerShell** нажмите **правой кнопкой** → **Запуск от имени администратора** *не обязателен* — достаточно обычного запуска.
3. Выполните **одну** строку (скопируйте целиком):

   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
   ```

4. На вопрос подтверждения введите **`Y`** и нажмите **Enter**.
5. Закройте это окно, снова откройте PowerShell в папке **`C:\Sborka_Project\mobile`** (как в шаге 1 ниже).
6. Снова выполните: **`npx expo start -c`**.

Подробнее у Microsoft: [about_Execution_Policies](https://learn.microsoft.com/ru-ru/powershell/module/microsoft.powershell.core/about/about_execution_policies).

### Вариант B: ничего не менять в политике — вызывать `.cmd`

В папке **`mobile`** всегда используйте **`npx.cmd`** и **`npm.cmd`** вместо `npx` и `npm`:

```powershell
npx.cmd expo start -c
```

```powershell
npm.cmd install
```

Так PowerShell запускает не сценарий `.ps1`, а обычную программу **`.cmd`** — ограничение не срабатывает.

### Вариант C: обычная командная строка Windows

1. **Win + R** → введите **`cmd`** → Enter.
2. Выполните:

   ```text
   cd /d C:\Sborka_Project\mobile
   ```

3. Затем:

   ```text
   npx expo start -c
   ```

В **cmd** политика PowerShell не участвует.

---

## Что понадобится

1. **Node.js** с сайта [nodejs.org](https://nodejs.org/) (LTS, 18+). При установке оставьте галочку, чтобы добавился в PATH.
2. На телефоне — приложение **Expo Go** из Google Play (или App Store на iPhone).
3. Телефон и компьютер в **одной Wi‑Fi сети** (так проще; иначе см. раздел «Проблемы»).

---

## Шаг 1. Открыть терминал в папке проекта

1. Откройте **Проводник** и перейдите в `C:\Sborka_Project\mobile`.
2. В адресной строке введите `powershell` и нажмите Enter — откроется PowerShell уже в этой папке.

*(Либо: Win + R → `powershell` → Enter, затем команда `cd C:\Sborka_Project\mobile`.)*

---

## Шаг 2. Файл `.env` с адресом сервера

В папке `mobile` должен быть файл **`.env`** (одна строка без кавычек):

```env
EXPO_PUBLIC_API_URL=https://ваш-проект.up.railway.app
```

Подставьте **тот же адрес**, что у вашего backend на Railway, **без** `/webhook/...` и **без** слэша в конце.

- В репозитории есть **`mobile/.env.example`** — можно скопировать: в PowerShell из папки `mobile` выполните  
  `Copy-Item .env.example .env`  
  затем откройте `.env` в блокноте и исправьте URL.

Если вы уже задавали вебхук в `server/.env` как  
`https://…up.railway.app/webhook/moysklad`,  
то в `.env` мобилки нужен только корень:  
`https://…up.railway.app`

**Важно:** после любого изменения `.env` перезапустите Metro с очисткой кэша (шаг 4): **`npx expo start -c`**.

---

## Шаг 3. Установить зависимости (один раз)

В той же PowerShell, будучи в `C:\Sborka_Project\mobile`:

```powershell
npm.cmd install
```

*(Если политика уже разрешена — можно `npm install`.)*

---

## Шаг 4. Запустить сервер разработки Expo

В PowerShell (из папки `mobile`), **предпочтительно**:

```powershell
npx.cmd expo start -c
```

Если после **варианта A** всё ок с политикой — можно и **`npx expo start -c`**.

Флаг **`-c`** сбрасывает кэш — нужен после правок **`.env`**.

В терминале появится **QR-код**.

---

## Шаг 5а. Запуск на телефоне (Expo Go) — Android

1. На телефоне установите **Expo Go** из Google Play.
2. Убедитесь, что телефон в **той же Wi‑Fi**, что и компьютер (для первого раза).
3. На ПК в окне Metro должен быть **QR-код**. В **Expo Go** нажмите **Scan QR code** и наведите камеру на QR в терминале.
4. Если не сканируется: в терминале нажмите **`s`** (переключение сети) и попробуйте режим **Tunnel** — дольше, но часто помогает в «сложных» Wi‑Fi.
5. Откроется **СборкаПро** — введите **логин** и **пароль** от вашего сервера (те же, что для `POST /auth/login`, не обязательно логин `admin`).

---

## Шаг 5б. Запуск на эмуляторе Android

1. Установите **Android Studio**, в нём — **Android SDK** и виртуальное устройство (AVD).
2. Запустите эмулятор.
3. В папке `mobile`:

```powershell
npm.cmd run android
```

---

## Если что-то не работает

| Симптом | Что сделать |
|--------|-------------|
| **`npx.ps1`**, «выполнение сценариев отключено», **PSSecurityException** | См. раздел **«Если красная ошибка…»** выше: **`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`** или команды через **`npx.cmd`** / **cmd**. |
| На Android красный экран **`java.lang.String cannot be cast to java.lang.Boolean`** сразу при открытии | В проекте подключены **`react-native-gesture-handler`** и обёртки **`GestureHandlerRootView`** + **`SafeAreaProvider`**. Остановите Metro (**Ctrl+C**), снова **`npx.cmd expo start -c`**, в Expo Go нажмите **Reload**. Если ошибка останется — в **`app.json`** временно поставьте **`"newArchEnabled": false`** и снова **`-c`**. |
| «Не задан EXPO_PUBLIC_API_URL» на экране входа | Проверьте `.env` в **`mobile`**, перезапустите **`npx.cmd expo start -c`**. |
| Телефон не открывает проект по QR | Убедитесь, что телефон и ПК в одной Wi‑Fi; попробуйте в терминале нажать **`s`** и переключить на **Tunnel** (медленнее, но обходит часть сетей). |
| `npm` не находится | Перезапустите терминал после установки Node; проверьте `node -v` и `npm -v`. |
| Ошибка входа `invalid_credentials` | Логин должен совпадать с пользователем в БД (не обязательно `admin` — см. сид `SEED_ADMIN_LOGIN` в документации Railway). |
| Красные ошибки в Metro | Остановите (Ctrl+C), снова **`npx expo start -c`**. |

---

## Учётные данные

Те же, что для **`POST /auth/login`** на вашем сервере (логин и пароль пользователя в PostgreSQL, не переменные Railway `SEED_*`, если вы их уже удалили).
