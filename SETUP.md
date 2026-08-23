# Покрокове налаштування: Supabase + Auth + RevenueCat + сервер

Код уже повністю готовий — треба лише створити зовнішні сервіси і вписати
ключі у два файли додатку та env-змінні сервера:

| Куди                          | Що                                                                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/lib/supabaseConfig.ts`   | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`                      |
| `src/lib/revenueCatConfig.ts` | `REVENUECAT_APPLE_API_KEY` (+ Google пізніше)                                                            |
| Сервер (env)                  | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, RevenueCat webhook/erasure secrets, PostHog erasure secrets |

Порядок кроків нижче — рекомендований: 0 → 1 (мінімум, після якого все
працює) → 2–3 (соц-логіни) → 4–5 (підписки) → 6 (перевірка).

---

## Крок 0. Bundle ID — ✅ зроблено

Ідентифікатор — **`app.permitcoach`** (reverse-DNS домену `permitcoach.app`),
назва застосунку — **PermitCoach**. Прописано в:

- iOS: `PRODUCT_BUNDLE_IDENTIFIER` (Debug + Release), `CFBundleDisplayName`,
  `CFBundleName`, `withModuleName` в `AppDelegate.swift`;
- Android: `namespace` + `applicationId` у `android/app/build.gradle`, пакет
  `android/app/src/main/java/app/permitcoach/`, `app_name` у `strings.xml`;
- JS: `app.json` (`name` + `displayName`) — ключ `AppRegistry` синхронізовано
  з нативним `moduleName` на обох платформах.

Внутрішні назви Xcode-проєкту, схеми й тек лишилися `DmvLearning` — вони
користувачу не видні, а їх перейменування ламає Podfile і схеми.

Лишилось зробити руками в Xcode (я не маю доступу до твого акаунта):
`ios/DmvLearning.xcworkspace` → таргет **DmvLearning → Signing &
Capabilities** → вибрати **Team**. Для симулятора підпис не потрібен (збірка
вже перевірена), для девайса і Sign in with Apple — обовʼязковий.

## Крок 1. Supabase (після цього кроку auth+sync уже працюють)

1. [supabase.com](https://supabase.com) → Sign up → **New project**:
   организація, назва (`dmv-prep`), Database password (згенеруй і збережи),
   регіон — `us-east-1` (юзери в США).
2. **Ключі** → `src/lib/supabaseConfig.ts`:
   - **Project URL** → `SUPABASE_URL`. У новому дашборді його НЕМАЄ на
     сторінці API Keys — бери з кнопки **Connect** угорі дашборду, або
     Project Settings → **Data API**, або збери сам:
     `https://<project-ref>.supabase.co` (ref видно в URL браузера:
     `dashboard/project/<ref>`).
   - Project Settings → **API Keys** → **Publishable key**
     (`sb_publishable_...`) → `SUPABASE_ANON_KEY`.
     (У старих проєктах це legacy `anon` JWT — працюють обидва.)
3. **Міграції**: лівe меню → SQL Editor → New query:
   - вставити весь вміст `supabase/migrations/0001_init.sql` → **Run**;
   - потім `supabase/migrations/0002_anon_cleanup.sql` → **Run**.
     Якщо помилка на `create extension pg_cron` — Database → Extensions →
     увімкнути `pg_cron`, повторити;
   - далі по черзі запустити `0003_reset_ops.sql`,
     `0004_question_stats_and_streak_history.sql`, `0005_wipe_progress.sql`
     та `0006_account_erasure_queue.sql`. Остання міграція має бути застосована
     до деплою Railway-воркера видалення.
4. **Auth-налаштування**: Authentication → Sign In / Providers:
   - **Allow anonymous sign-ins: ON** (у General/Sign in settings);
   - провайдер **Email**: увімкнений, а **Confirm email: OFF** (для MVP —
     конвертація аноніма через `updateUser` не потребує лінка з листа).
5. **Перевірка**: `npm run ios` → у дашборді Authentication → Users має
   з'явитись анонімний користувач; пройди урок у додатку → Table Editor →
   `lesson_progress` — рядок з твоїм прогресом.

## Крок 2. Sign in with Apple (потрібен платний Apple Developer Program)

1. [developer.apple.com](https://developer.apple.com) → Certificates,
   Identifiers & Profiles → **Identifiers**: якщо App ID для твого bundle id
   ще нема — Xcode створить його автоматично при першому запуску з team;
   відкрий App ID і постав галочку **Sign in with Apple** (Edit → Save).
2. Xcode → таргет → Signing & Capabilities → **+ Capability → Sign in with
   Apple**.
3. Supabase → Authentication → Sign In / Providers → **Apple** → Enable:
   - у поле **Authorized Client IDs** впиши `app.permitcoach`.
   - Secret Key / Services ID не потрібні — ми використовуємо нативний
     id-token flow, без OAuth-редіректів.

## Крок 3. Google Sign-In

1. [console.cloud.google.com](https://console.cloud.google.com) → New
   Project (`dmv-prep`).
2. **OAuth consent screen** (Google Auth Platform → Branding): External →
   назва додатку, support email → зберегти (публікація/верифікація для
   старту не потрібна).
3. **Credentials → Create Credentials → OAuth client ID**, двічі:
   - тип **Web application** → створити → скопіювати Client ID →
     `GOOGLE_WEB_CLIENT_ID` у `src/lib/supabaseConfig.ts`;
   - тип **iOS** → вписати `app.permitcoach` → створити → Client ID →
     `GOOGLE_IOS_CLIENT_ID`; там же буде **iOS URL scheme** (reversed client
     id, `com.googleusercontent.apps.…`) — скопіюй його.
4. **URL scheme в Xcode**: таргет → Info → **URL Types** → `+` → у поле URL
   Schemes встав reversed client id з попереднього пункту.
5. Supabase → Authentication → Sign In / Providers → **Google** → Enable →
   у **Authorized Client IDs** впиши **Web client id** (саме web!).
   Client Secret не потрібен для нативного id-token flow.

## Крок 4. App Store Connect: підписка

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → Apps →
   **+ New App**: платформа iOS, назва PermitCoach, bundle id `app.permitcoach`.
2. **Business → Agreements**: підписати **Paid Apps Agreement** і заповнити
   банківські/податкові дані — без цього sandbox-покупки не працюють.
3. App → Monetization → **Subscriptions**: створити Subscription Group
   (`DMV Prep Plus`) → у ній продукт тижневої підписки (ціна,
   локалізація). Статус "Missing Metadata" — норм до першого сабміту.
4. **Sandbox-тестер**: Users and Access → Sandbox → Testers → додати
   тестовий Apple ID (для перевірки покупок на девайсі).

## Крок 5. RevenueCat

1. [app.revenuecat.com](https://app.revenuecat.com) → створити акаунт →
   **New project** (`dmv-prep`).
2. **Додати app**: Project → Apps → **+ New → App Store** → назва +
   `app.permitcoach`.
3. **In-App Purchase Key** (щоб RevenueCat міг валідувати покупки):
   - App Store Connect → Users and Access → **Integrations → In-App
     Purchase** → згенерувати ключ → завантажити `.p8`, скопіювати Issuer ID;
   - RevenueCat → твій App Store app → **In-app purchase key configuration**
     → завантажити `.p8` + Issuer ID.
4. (Опційно, зручно) **App Store Connect API key** там же — дозволяє
   RevenueCat самому імпортувати продукти.
5. **Product**: Project → Products → **+ New** → вибрати/вписати
   Product ID тижневої підписки (той самий, що в ASC).
6. **Entitlement**: Project → Entitlements → **+ New** → identifier —
   рівно `plus` (так у коді) → Attach → створений тижневий продукт.
7. **Offering**: Project → Offerings → у `default` додати Package
   (Weekly) з цим продуктом. Додаток купує перший пакет із current
   offering.
8. **SDK-ключ**: Project → **API Keys** → App-specific keys → ключ твого
   App Store app (`appl_...`) → `REVENUECAT_APPLE_API_KEY` у
   `src/lib/revenueCatConfig.ts`. (Це публічний ключ; secret-ключі — тільки
   для сервера.) Test Store key використовується лише в `__DEV__`; release
   завжди бере `appl_...` ключ.
9. **Webhook** (після кроку 6-сервер): Project → Integrations → **Webhooks**
   → + New: URL `https://<твій-сервер>/v1/webhooks/revenuecat`,
   **Authorization header value** — той самий рядок, що в
   `REVENUECAT_WEBHOOK_AUTH` на сервері.

## Крок 6. Деплой сервера (Railway — найпростіше)

Сервер живе в **окремому репозиторії** `Arsen27/dmv-server` (директорія
`server/` тут — його робоча копія, у цьому репо вона ігнорується). Деталі
про роботу з двома репозиторіями — наприкінці кроку.

1. Згенеруй webhook-секрет: `openssl rand -hex 32`.
2. [railway.app](https://railway.app) → New Project → **Deploy from GitHub
   repo** → `Arsen27/dmv-server` → **Root Directory: порожній** (корінь репо)
   → Start command: `npm start`.
3. Variables:
   - `SUPABASE_URL` — Project URL з кроку 1;
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Project Settings → API Keys →
     **Secret key** (`sb_secret_...`; у старих проєктах — legacy
     `service_role`). Тільки на сервері, ніколи в додаток;
   - `REVENUECAT_WEBHOOK_AUTH` — секрет з п.1;
   - `REVENUECAT_V2_SECRET_API_KEY` — RevenueCat REST API v2 secret лише з
     правом `customer_information:customers:read_write`;
   - `REVENUECAT_PROJECT_ID` — RevenueCat project id (`proj...`);
   - `POSTHOG_PERSONAL_API_KEY` — personal key з `person:write`;
   - `POSTHOG_PROJECT_ID` — числовий id PostHog project.
4. Settings → Networking → **Generate Domain** → отриманий URL використай у
   вебхуку RevenueCat (крок 5.9).
5. Перевірка: `curl https://<домен>/health` → `{"ok":true}` і
   `curl 'https://<домен>/v1/bootstrap?course=ca&courseVersion=1.0.0'` →
   JSON з `"mode":"none"`.
6. **Впиши домен у додаток**: `src/lib/serverConfig.ts` → `SERVER_URL =
'https://<домен>'`. Поки `SERVER_URL` порожній, додаток працює лише на
   вбудованій копії курсу і не перевіряє оновлення.
7. **Два репозиторії**: контент курсу генерується тут
   (`npm run course:export-server` пише в `server/content/`), а комітиться і
   деплоїться з `server/` як з окремого репо:

   ```sh
   npm run course:export-server -- --semver 1.0.1   # у корені цього репо
   cd server && git add -A && git commit -m "content: 1.0.1" && git push
   ```

   Про випуск нових версій курсу — `docs/course-integration/server-versioning.md`.

## Крок 7. Наскрізна перевірка

1. **Анонім + sync**: чиста установка → пройти урок → у Supabase
   Authentication → Users новий анонім, у `lesson_progress` рядок.
2. **Офлайн-черга**: airplane mode → пройти урок → повернути мережу →
   згорнути/розгорнути додаток → рядок доїхав.
3. **Реєстрація**: You → Sign up → email+пароль → у дашборді той САМИЙ
   user id отримав email; прогрес на місці. Log out → чистий стан; Log in →
   прогрес повернувся.
4. **Apple/Google**: Continue with Apple / Google → вхід успішний, прогрес
   злився (adopt-and-merge).
5. **Reinstall**: видалити додаток → встановити знову → прогрес відновився
   без логіна (сесія з Keychain + pull).
6. **Покупка**: на девайсі з sandbox-тестером → Upgrade → купівля → бейдж
   PLUS; у RevenueCat дашборді видно транзакцію; за хвилину-дві вебхук
   виставить `profiles.plan = 'plus'` у Supabase.
7. **Delete account**: You → Delete account → юзер і прогрес зникли з бази;
   у `account_erasure_jobs` короткочасно з'явився job і зник після успішного
   стирання PostHog та RevenueCat. Активна store-підписка при цьому не
   скасовується.

## Нотатки на майбутнє

- **Email confirmations** зараз OFF — перед масштабом увімкнути назад і
  додати deep links (інакше можливий сквотинг чужих email).
- **Legacy ключі** Supabase деприкейтять до кінця 2026 — ми вже на нових
  (`sb_publishable_` / `sb_secret_`), нічого робити не треба.
- `server`-ендпоінт `/v1/me` перевіряє legacy HS256 JWT secret; нові
  проєкти Supabase підписують токени асиметрично (ES256) — коли реально
  знадобляться авторизовані ендпоінти, перевести перевірку на JWKS (`jose`).
  На вебхук/контент це не впливає.
- **Android**: коли дійде черга — `REVENUECAT_GOOGLE_API_KEY`, Google
  Play-app у RevenueCat і `GOOGLE_WEB_CLIENT_ID` уже покривають логін.
