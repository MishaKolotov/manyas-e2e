# E2E-тестирование локализации — Дизайн-спека

**Дата:** 2026-05-26
**Проект:** Manyas e2e
**Тестируемое приложение:** https://dev.slimkit.health/walking/survey/?stripeV64=true
**Статус:** Утверждено (ожидает финального ревью этой спеки пользователем)

---

## 1. Цель и скоуп

Создать e2e-тестовый проект на Playwright, который проверяет локализацию воронки Walking Survey (с feature-флагом `stripeV64=true`) на 10 языках, 3 мобильных девайсах и 2 движках браузера. Локализация должна определяться **языком браузера** (не URL-параметрами и не встроенным переключателем языка в приложении) — то есть если у пользователя браузер на русском, приложение должно отрисоваться на русском.

**В скоупе:**

- Языки: `en, fr, it, es, ja, ru, de, pt, zh, ko` (10 штук)
- Девайсы: iPhone 17, iPhone 16 Pro Max, Samsung Galaxy S20e/FE
- Движки браузера: Chromium (рендеринг Google Chrome), WebKit (рендеринг Safari — через Playwright WebKit)
- Глубина покрытия: полный end-to-end опросника (лендинг → все шаги опросника → paywall с stripeV64)
- Что проверяем в локализации:
  - Язык интерфейса соответствует локали браузера
  - Нет видимых «сырых» / непереведённых i18n-ключей
  - Целостность вёрстки (нет обрезаний и overflow) для языков с длинными строками (de, ru)
  - Корректные форматы чисел/дат/валют на paywall в соответствии с локалью
- Только локальный запуск (CI откладывается)

**Вне скоупа (явно фиксируем):**

- CI/CD пайплайны (GitHub Actions и т.п.)
- Облачные real-device сервисы (BrowserStack, Sauce Labs)
- Accessibility (a11y) тесты
- Performance / Lighthouse тесты
- API-тесты
- Любые feature-флаги кроме `stripeV64=true`
- Языки `ar` и `hi` (есть в исходном xlsx, но игнорируем)
- Встроенный переключатель языка в приложении (локаль приходит только из браузера)

---

## 2. Технологический стек

- **Язык:** TypeScript (strict mode)
- **Среда выполнения:** Node.js 20 LTS
- **Тестовый фреймворк:** Playwright Test (`@playwright/test`, последняя стабильная версия)
- **Движки браузера:** Chromium и WebKit (ставятся через `playwright install`)
- **Парсер исходника переводов:** `xlsx` (SheetJS) — конвертирует `WWLI Onboarding Localisation.xlsx` в JSON-фикстуры
- **Запуск TS-скриптов:** `tsx`
- **Конфигурация:** `dotenv` для секретов
- **Качество кода:** ESLint, Prettier
- **Репортеры:** встроенные HTML + list + JSON

---

## 3. Структура проекта

```
manyas-e2e/
├── .env.example                    # шаблон, в git
├── .env                            # секреты, в .gitignore
├── .gitignore
├── package.json
├── tsconfig.json
├── playwright.config.ts            # программно генерирует 60 projects
├── README.md
├── WWLI Onboarding Localisation.xlsx   # источник истины для переводов
│
├── src/
│   ├── config/
│   │   ├── locales.ts              # SUPPORTED_LOCALES с BCP-47 + timezone
│   │   ├── devices.ts              # кастомные device descriptors
│   │   └── projects.ts             # сборка матрицы locales × devices × engines
│   ├── fixtures/
│   │   └── i18n.fixture.ts         # Playwright fixture, отдающая переводы по локали
│   ├── pages/
│   │   ├── BasePage.ts
│   │   ├── LandingPage.ts
│   │   ├── SurveyPage.ts
│   │   └── PaywallPage.ts
│   └── utils/
│       ├── i18n-loader.ts          # читает tests/fixtures/i18n/<locale>.json
│       ├── visual-checks.ts        # DOM-хелперы для overflow/clipping/in-viewport
│       ├── wait-stable.ts          # waitForVisualStability: fonts.ready + images + scroll
│       ├── excel-to-json.ts        # импортёр xlsx → JSON
│       └── i18n-check.ts           # guard: xlsx-mtime vs JSON-mtime
│
├── tests/
│   ├── fixtures/
│   │   └── i18n/
│   │       ├── _meta.json          # метаданные импорта + лог missing keys
│   │       ├── en.json
│   │       ├── fr.json
│   │       └── ... (10 файлов локалей)
│   ├── localization/
│   │   ├── landing.spec.ts
│   │   ├── survey-flow.spec.ts
│   │   ├── paywall.spec.ts
│   │   ├── no-missing-keys.spec.ts
│   │   └── visual.spec.ts
│   └── helpers/
│       └── survey-flow.ts          # detect-and-answer утилита для опросника
│
├── test-results/                   # в .gitignore; артефакты упавших тестов
└── playwright-report/              # в .gitignore; HTML отчёт
```

Папки `*-snapshots/` рядом с каждым spec-файлом хранят baseline PNG (коммитятся).

---

## 4. Тестовая матрица (60 projects)

### 4.1 Подход

Программная генерация в `src/config/projects.ts`:

```ts
projects = LOCALES.flatMap(loc =>
  DEVICES.flatMap(dev =>
    ENGINES.map(eng => buildProject(loc, dev, eng))
  )
);
```

Именование project: `<locale>__<device>__<engine>`. Примеры: `ru__iphone17__webkit`, `ja__s20e__chromium`.

Это канонический Playwright-паттерн (по официальной документации) и даёт:

- `npx playwright test` → все 60 projects параллельно
- `npx playwright test --project='/ru__.*/'` → все ru-варианты
- `npx playwright test --project=en__iphone17__webkit` → одна комбинация

### 4.2 Device descriptors (`src/config/devices.ts`)

| Девайс                  | Viewport (CSS px) | DSR | hasTouch | isMobile | UA-заглушка                                                       |
|-------------------------|-------------------|-----|----------|----------|---------------------------------------------------------------|
| iPhone 17               | 402 × 874         | 3   | true     | true     | `Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) ... Safari/605.1.15` |
| iPhone 16 Pro Max       | 440 × 956         | 3   | true     | true     | `Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) ... Safari/605.1.15` |
| Samsung Galaxy S20e/FE  | 360 × 780         | 3   | true     | true     | `Mozilla/5.0 (Linux; Android 13; SM-G781B) AppleWebKit/537.36 ... Chrome/124.0` |

Это собственные дескрипторы (не встроенные `devices['iPhone X']`), потому что в комплекте Playwright нет ни iPhone 17, ни S20e. Viewport и DSR взяты по спекам производителей.

**Ограничение по UA-строкам.** UA для iPhone 17 (`iPhone OS 19_0`) — это разумная экстраполяция, а не зафиксированная Apple строка (на момент написания iOS 19 ещё не GA). Этот UA пригоден ТОЛЬКО для:

- задания корректного `navigator.userAgent` для клиентского feature-detection,
- эмуляции мобильного режима в DevTools.

UA **не следует считать достоверным** для:

- серверной аналитики/логики, ветвящейся по UA-строке,
- A/B-таргетинга по версии iOS,
- проверок что бэкенд правильно парсит UA.

Если в ходе имплементации обнаружится что бэкенд приложения реагирует на UA (другая разметка, другой контент, перенаправления), нужно вернуться сюда и подставить **реальные** UA-строки с устройств — а для проверок таких ветвлений придётся использовать real-device cloud (вне текущего скоупа). В плане имплементации есть смоук-проверка «сравнить ответы сервера для нашего UA-stub и для реального UA из Chrome DevTools — серверный контент должен совпадать».

### 4.3 Локали (`src/config/locales.ts`)

| Код  | BCP-47  | Timezone           | Примечания |
|------|---------|--------------------|------------|
| en   | en-US   | America/New_York   | |
| fr   | fr-FR   | Europe/Paris       | |
| it   | it-IT   | Europe/Rome        | |
| es   | es-ES   | Europe/Madrid      | |
| ja   | ja-JP   | Asia/Tokyo         | |
| ru   | ru-RU   | Europe/Moscow      | |
| de   | de-DE   | Europe/Berlin      | |
| pt   | pt-PT   | Europe/Lisbon      | ⚠️ вариант под вопросом (см. ниже) |
| zh   | zh-CN   | Asia/Shanghai      | упрощённый китайский, подтверждено по xlsx |
| ko   | ko-KR   | Asia/Seoul         | |

Timezone выставляется чтобы рендеринг дат/времени был стабильным независимо от хост-машины разработчика.

**Открытый вопрос — pt-PT vs pt-BR:** маркетинговые funnel-ы часто локализованы под Бразилию (pt-BR, бо́льший рынок), но xlsx-колонка просто `pt` без явной спецификации. В плане имплементации есть отдельный шаг: открыть приложение с `Accept-Language: pt-BR` и с `Accept-Language: pt-PT`, сравнить с xlsx-переводами и зафиксировать правильный variant. До этого момента в `locales.ts` стоит `pt-PT` как наиболее консервативный default; если выяснится что приложение реально отдаёт pt-BR — поменять на `pt-BR` + timezone `America/Sao_Paulo`.

### 4.4 Движки

- `chromium` (рендеринг Chrome, ближайшее к настоящему Chrome)
- `webkit` (рендеринг Safari, ближайшее к настоящему Safari)

### 4.5 Блок `use:` для каждого project

```ts
{
  name: 'ru__iphone17__webkit',
  use: {
    ...iPhone17Descriptor,            // viewport, DSR, UA, hasTouch, isMobile
    browserName: 'webkit',
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    httpCredentials: {
      username: process.env.BASIC_AUTH_USER!,
      password: process.env.BASIC_AUTH_PASS!,
    },
    baseURL: process.env.BASE_URL!,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  metadata: { locale: 'ru', device: 'iphone17', engine: 'webkit' },
}
```

### 4.6 Локаль только через `context.locale`

Согласно документации Playwright, задание `locale` в конфигурации контекста автоматически:

- Выставляет правильный HTTP-заголовок `Accept-Language`
- Устанавливает `navigator.language` и `navigator.languages`
- Влияет на внутренние locale-зависимые API браузера (`Intl.*`, date-пикеры и т.п.)

Это полностью соответствует требованию: локаль задаётся браузером, не URL-параметрами и не встроенным переключателем.

---

## 5. Импорт переводов (Excel → JSON)

### 5.1 Источник

`WWLI Onboarding Localisation.xlsx` в корне репо. Три листа:

- **Sheet1** (~1617 строк): колонка `key` + 12 языковых колонок
- **Sheet2** (~227 строк): нет колонки key, параллельные строки на разных языках (English используется как идентификатор)
- **Sheet3** (~1492 строк): колонка `key` + 12 языковых колонок

### 5.2 Поведение импортёра (`src/utils/excel-to-json.ts`, запускается через `npm run i18n:import`)

1. Читает xlsx из корня репо. Если файла нет — падает с понятной ошибкой («Place WWLI Onboarding Localisation.xlsx in repo root»).
2. Фильтрует 10 нужных языковых колонок (`en, fr, it, es, ja, ru, de, pt, zh, ko`); игнорирует `ar`, `hi` и неиспользуемую колонку `-`.
3. Для **Sheet1** и **Sheet3** (с явными ключами):
   - Использует колонку `key` как идентификатор.
   - **Перед обработкой строк — schema validation:** проверяем что в header row есть колонка `key` И обязательные языковые колонки (`en, fr, it, es, ja, ru, de, pt, zh, ko`). Если чего-то нет — падаем с понятным сообщением (`"Sheet1 missing required column: 'ru'. Did the localization team rename/remove it?"`). Это защищает от случая когда команда локализации изменит структуру xlsx и тихие потери появятся.
   - **Правила пропуска строки** применяются по порядку (первое подходящее → решение). Default — `accept`, никаких whitelist-ов:
     1. `key` пустой ИЛИ `en` пустой → **skip** (категория `EMPTY`)
     2. `key` содержит `[!?]{2,}` → **skip** (категория `MARKER`)
     3. `key` содержит emoji (`/\p{Extended_Pictographic}/u`) → **skip** (категория `EMOJI`)
     4. `key` содержит кириллицу (`/[Ѐ-ӿ]/`) И при этом ВСЕ языковые колонки кроме `ru` пустые → **skip** (категория `RU_NOTE`)
     5. Иначе → **accept** (без whitelist-а префиксов — это специально, чтобы новые префиксы импортировались автоматически).
   - **Каждая пропущенная строка** логируется в `_meta.json` под ключом `skippedRows: [{ sheet, rowIndex, key, category, sampleValues: { en, ru } }, ...]`. Никаких тихих потерь.
   - При **дубликатах ключей** между Sheet1/Sheet3 (один и тот же `key` встречается в обоих sheets с разными значениями): импортёр **падает с ошибкой**, печатает оба значения, требует от человека разобраться. Это не должно быть «тихим last-wins», потому что чаще всего дубликат = ошибка в xlsx. Если действительно нужно второму выиграть — это решается локально удалением старой строки.
4. Для **Sheet2** (без ключей):
   - Ключ = `'sheet2.' + slugify(english_text)`.
   - `slugify`: lowercase, заменить не-alphanumeric на `_`, схлопнуть последовательные `_`, trim.
5. **Нормализует** каждое значение:
   - Заменяет ` ` (non-breaking space) на обычный пробел.
   - Заменяет глиф `⏎` на настоящий `\n`.
   - Trim пробелов по краям.
6. **Записывает** файлы (truncate + rewrite на каждом запуске):
   - `tests/fixtures/i18n/<locale>.json` — плоская мапа `{ key: value }` для каждой локали.
   - `tests/fixtures/i18n/_meta.json` — `{ importedAt, source, totalKeys, perLocale: { en: { translated, missingKeys: [] }, ... }, duplicateKeys: [] }`.
7. **Сайд-эффект:** печатает в консоль summary (`git diff --stat` по файлам фикстур), чтобы изменения после повторного импорта были видны.

### 5.3 Workflow обновления

1. Заменить xlsx-файл в корне репо на новую версию (от команды локализации).
2. Запустить `npm run i18n:import`.
3. Посмотреть `git diff` по `tests/fixtures/i18n/*.json` чтобы увидеть какие переводы поменялись.
4. Запустить тесты — упавшие подсветят где задеплоенное приложение не догнало новые переводы.
5. Закоммитить xlsx + JSON-фикстуры вместе.

### 5.4 Когда запускается импортёр

- **Только вручную:** разработчик запускает `npm run i18n:import` после замены xlsx. `npm install` импорт НЕ дёргает (никаких сюрпризов в виде перезаписанных фикстур; не падает на свежем клоне если xlsx ещё не на месте; не зависим от `.env`).
- **Guard через `i18n:check`** (отдельный npm-скрипт): сравнивает `mtime(xlsx)` против `mtime(_meta.json)`. Если xlsx новее ИЛИ `_meta.json` отсутствует — скрипт падает с инструкцией «Run `npm run i18n:import` to regenerate fixtures». Guard вызывается:
  - в `pretest` хуке (`npm test` сначала прогоняет `i18n:check`), чтобы тесты не запускались на устаревших JSON,
  - вручную при сомнениях.
- **Никогда** не запускается как часть `npm test` сам импорт (это создавало бы нестабильность если xlsx редактируется в процессе). Только check.

### 5.5 Unit-тесты для импортёра

Маленький фикстурный xlsx (закоммичен в `tests/fixtures/i18n/__importer-test-input.xlsx`) с известным содержимым. Тест проверяет что `excel-to-json.ts` на этот вход даёт ожидаемый JSON. Делается по TDD (red → green).

---

## 6. Авторизация и конфигурация приложения

### 6.1 Хранение кредов

`.env.example` (в git, пустые значения):

```
BASIC_AUTH_USER=
BASIC_AUTH_PASS=
BASE_URL=https://dev.slimkit.health
SURVEY_PATH=/walking/survey/
FEATURE_FLAGS=stripeV64=true
```

`.env` (в .gitignore, реальные значения):

```
BASIC_AUTH_USER=dev
BASIC_AUTH_PASS=gPgFCeJ7
BASE_URL=https://dev.slimkit.health
SURVEY_PATH=/walking/survey/
FEATURE_FLAGS=stripeV64=true
```

Загружается в `playwright.config.ts` через `import 'dotenv/config'`. Если кредов нет — конфиг падает с понятным сообщением («Copy `.env.example` to `.env` and fill in credentials») — никаких silent defaults.

### 6.2 Доставка basic-auth

`httpCredentials` в блоке `use:` каждого project. Playwright прозрачно подставляет заголовок `Authorization: Basic ...` на запросы к `BASE_URL`. Никаких URL-схем типа `https://user:pass@host/` (устарело).

### 6.3 Конструирование URL

`.env`-формат `FEATURE_FLAGS`: **query string без ведущего `?`**, поддерживает несколько флагов через `&`. Примеры:

```
FEATURE_FLAGS=stripeV64=true
FEATURE_FLAGS=stripeV64=true&newPaywall=v3
```

В `BasePage.goto()`:

```ts
const url = new URL(process.env.SURVEY_PATH!, process.env.BASE_URL!);
const flags = new URLSearchParams(process.env.FEATURE_FLAGS ?? '');
for (const [k, v] of flags) url.searchParams.set(k, v);
await this.page.goto(url.toString());
```

Используем `URLSearchParams` (а не сырое присваивание `url.search`), чтобы:

- корректно обрабатывались случайные ведущие `?` в `.env`,
- значения escape'ились правильно (`&`, `=`, юникод),
- было одно явное место где видно «вот список флагов которые мы применяем».

### 6.4 Безопасность

- `.env` в `.gitignore`.
- В `.env.example` нет реальных кредов.
- HTML-отчёт не светит httpCredentials (Playwright редактирует по умолчанию).
- CI-секреты (когда подключим) через GitHub Actions Secrets, не в конфигурационных файлах.

---

## 7. Page Object Model

### 7.1 Иерархия

```
BasePage              — общее: goto, ready(), i18n.text() хелпер
  ├── LandingPage     — первый экран (заголовок, CTA «Start»)
  ├── SurveyPage      — контейнер опросника, шаги как методы
  └── PaywallPage     — финальный stripeV64 paywall
```

### 7.2 Стратегия локаторов (в порядке приоритета)

1. `getByRole('button', { name: i18n.t('cta_start') })` — семантика + переведённый текст
2. `getByTestId('survey-question-card')` — если в приложении есть `data-testid`
3. `getByLabel`, `getByPlaceholder` — для форм
4. CSS-селекторы только как последний резорт

### 7.3 Правила POM

- **Никаких захардкоженных строк.** Любой видимый текст приходит через `i18n.t(key)`. Отсутствующие ключи бросают исключение сразу.
- **POM-ы возвращают следующий POM:** `landing.startSurvey()` возвращает `Promise<SurveyPage>`.
- **Никаких ассертов внутри POM.** Ассерты живут в тестах; POM описывает поведение.
- **Никаких `waitForTimeout`.** Используем web-first ассерты Playwright (`expect(loc).toBeVisible()`) и автовейтинг.

### 7.4 Тестовые файлы

| Файл                            | Назначение                                                                    |
|---------------------------------|----------------------------------------------------------------------------|
| `landing.spec.ts`               | Лендинг показывает корректно переведённые заголовок и CTA для каждой локали.          |
| `survey-flow.spec.ts`           | Полный e2e: лендинг → все шаги опросника → paywall.                |
| `paywall.spec.ts`               | Paywall рендерится с корректной для локали валютой / форматированием цены.             |
| `no-missing-keys.spec.ts`       | На страницах нет **неразрешённых** i18n-ключей или `{{плейсхолдеров}}`. Точное правило: см. ниже. |
| `visual.spec.ts`                | Пиксельные снапшоты для landing, первого survey-шага и paywall.               |

Все тесты автоматически запускаются по всем 60 projects, потому что читают переводы из per-project `i18n` fixture.

**Правило `no-missing-keys.spec.ts`** (точное определение):

Скрейпит **все visible text nodes** на каждом экране опросника. Каждое значение `text.trim()` считается «утёкшим ключом» если ВСЕ условия true:

1. Матчится регексп `/^[a-zA-Z][a-zA-Z0-9_]*[._][a-zA-Z0-9_.]+$/` — то есть строка целиком из ASCII букв (любого регистра), цифр и `_`/`.`, И содержит хотя бы один разделитель `_` или `.`. Регексп специально допускает camelCase (`fitnesLevel_title`) И snake_case (`intro_text_0`) И dotted (`sheet2.what_do_you_want`, `intro.0`) — все три стиля присутствуют в реальном xlsx. Требование разделителя исключает однословные английские термины (`email`, `ok`, `next`, `info`) которые могут остаться непереведёнными в CJK-локалях по дизайну.
2. Длина 4–80 символов (отрезает шум типа `a_b`).
3. **НЕ** входит в whitelist валидных видимых ASCII-строк (`tests/fixtures/i18n/_visible-ascii-whitelist.json` — пополняется по мере столкновений; стартовая seed-версия: `["email", "info@*", "stripe", ...]`).
4. **Дополнительно отдельно** ловим `{{placeholder}}`-синтаксис любых движков шаблонов через `/\{\{[^}]+\}\}/`.

Регексп **верифицирован** на реальных ключах из текущего xlsx: матчит формы `intro_text_0`, `fitnesLevel_title`, `sheet2.what_do_you_want`, `intro.0`, `step_2_title`; не матчит валидные переводы `Walking`, `Ходьба`, `email`, `What do you want?`, `12,99 €`, `Hello World`.

Whitelist коммитится в репо. При первом ложном срабатывании теста на CJK-локали разработчик ревьюит — если строка действительно так задумана, добавляет её в whitelist + комментарий с причиной.

### 7.5 Survey flow helper (`tests/helpers/survey-flow.ts`)

Detect-and-answer утилита: на каждом шаге определяет тип вопроса (single-choice, multi-choice, slider, текстовый input) и выбирает первый валидный ответ. Нужно потому что:

- В опроснике есть ветвления (разные пути в зависимости от ответов).
- Тесты должны быть стабильны к минорным изменениям flow (не зависеть от точного количества шагов).

Метод `completeAllSteps()` крутит цикл пока не увидит paywall ИЛИ не превысит safety-cap — последний роняет тест.

**Safety-cap не задан заранее.** В плане имплементации есть отдельный шаг: вручную пройти survey несколько раз с разными ответами, посчитать максимум шагов до paywall, и зафиксировать `cap = max_observed * 1.5`. В коде это будет константа в `survey-flow.ts` (например `MAX_STEPS = 30` после реального замера). До замера ставим temporary `cap = 60` чтобы случайно не прерывать тесты на этапе разработки.

---

## 8. Стратегия визуальной валидации

### 8.1 Уровень 1 — DOM-ассерты (на каждом тесте)

`src/utils/visual-checks.ts` экспортирует:

- `assertNoHorizontalOverflow(page)` — `documentElement.scrollWidth <= clientWidth`
- `assertNoTextClipping(locator)` — элемент с `overflow: hidden` не обрезает контент по факту
- `assertButtonInViewport(locator)` — использует `toBeInViewport()` Playwright

Вызываются после каждого значимого навигационного шага. Быстро, детерминированно, ловит ~80% layout-регрессий на всех 60 projects.

### 8.2 Уровень 2 — Пиксельные снапшоты (только 3 ключевых экрана)

Только Landing, первый шаг опросника и Paywall:

```ts
await expect(page).toHaveScreenshot({
  fullPage: true,
  maxDiffPixelRatio: 0.02,
  animations: 'disabled',
  caret: 'hide',
  mask: [page.locator('[data-dynamic]')],
});
```

### 8.3 Хранение и скоуп снапшотов

Default Playwright: `<spec-file>-snapshots/<test-name>-<project-name>.png`. Коммитятся в репо.

Скоуп снапшотов осознанно сужен, чтобы балансировать покрытие vs стоимость поддержки. Мы НЕ снапшотим каждый экран на каждом project (3 × 60 = 180 PNG — слишком много, чтобы baseline-ы оставались осмысленными).

Финальный скоуп (после ревью — драстично сокращён, чтобы ребейзлайн при изменении одной строки на лендинге был 1–2 файла, не 6):

- **Landing snapshot:**
  - EN × 3 девайса × 2 движка = **6 PNG** (полное покрытие девайсов и движков на «контрольной» локали)
  - 9 не-EN локалей × **только iPhone 17** × 2 движка = **18 PNG** (по одному репрезентативному девайсу — ловим длиннотекстовые / RTL-подобные / CJK-проблемы)
  - Итого Landing: **24 PNG**
- **Snapshot первого шага опросника:** только EN × 3 девайса × 2 движка = **6 PNG**. (Не per-locale; per-locale layout покрыт DOM-ассертами на overflow.)
- **Paywall snapshot:**
  - EN × 3 девайса × 2 движка = **6 PNG**
  - 9 не-EN локалей × iPhone 17 × 2 движка = **18 PNG**
  - Итого Paywall: **24 PNG**

**Всего: ~54 baseline PNG** (~5–8 МБ). Реализуется через `test.skip(({ locale, device }) => locale !== 'en' && device !== 'iphone17')` на snapshot-тестах.

**Обоснование выбора iPhone 17 как репрезентативного:** самый узкий из iPhone-viewport (402px) в нашем наборе — длинные de/ru/ja-строки наиболее склонны ломать его layout. Если на iPhone 17 ru-локаль красива, то на 16 Pro Max (440px) она тоже почти наверняка ок. Обратное неверно — поэтому если хочется страховки, можно потом расширить до 2 iPhone-моделей; пока — экономим на ребейзлайне.

### 8.4 Меры против флейков

- `animations: 'disabled'` глобально в блоке `use:`
- Ждать `document.fonts.ready` перед каждым снапшотом
- Ждать изображения: `img.complete && img.naturalHeight !== 0`
- Маскировать динамический контент (таймеры, A/B вариации, даты)
- Стабилизировать скролл: `window.scrollTo(0,0)` перед full-page снапшотом
- Пороги: пиксельный `threshold: 0.2`, регионный `maxDiffPixelRatio: 0.02`

Все эти стабилизаторы инкапсулированы в `src/utils/wait-stable.ts` (хелпер `waitForVisualStability(page)`), который вызывается из `BasePage.ready()` или явно перед каждым `toHaveScreenshot`. Дублирование этой логики в каждом тесте запрещено.

### 8.5 Управление baseline-ами

- Первый прогон создаёт baseline автоматически (тест проходит с warning «snapshot created»).
- `npm run test:update-snapshots` обновляет baseline после осознанных изменений UI/переводов.
- Когда подключим CI — создание baseline в CI запрещено, baseline-ы должны быть закоммичены.

---

## 9. Запуск тестов

### 9.1 npm-скрипты

```json
{
  "pretest": "npm run i18n:check",
  "test": "playwright test",
  "test:smoke": "playwright test --project='/en__.*/'",
  "test:headed": "playwright test --headed",
  "test:debug": "PWDEBUG=1 playwright test",
  "test:ui": "playwright test --ui",
  "test:update-snapshots": "playwright test --update-snapshots",
  "test:report": "playwright show-report",
  "i18n:import": "tsx src/utils/excel-to-json.ts",
  "i18n:check": "tsx src/utils/i18n-check.ts",
  "lint": "eslint . --ext .ts",
  "format": "prettier --write \"**/*.{ts,json,md}\"",
  "typecheck": "tsc --noEmit",
  "install:browsers": "playwright install --with-deps chromium webkit"
}
```

Нет `prepare` хука — `npm install` НЕ запускает импортёр (никаких сюрпризов на свежих клонах). Импорт делается явно по команде.

### 9.2 Типовые запуски

| Команда                                                            | Назначение                                            |
|--------------------------------------------------------------------|----------------------------------------------------|
| `npm test`                                                          | Полная матрица: 60 projects (~25–40 мин)              |
| `npm run test:smoke`                                                | Английская локаль × 3 девайса × 2 движка (~3–5 мин)  |
| `npx playwright test --project=ru__iphone17__webkit`                | Одна комбинация                                 |
| `npx playwright test --grep paywall`                                | Все paywall-тесты во всех projects              |
| `npm run test:ui`                                                   | Интерактивный UI-mode Playwright                     |

### 9.3 Параллелизм / конфиг

```ts
{
  fullyParallel: true,
  workers: process.env.CI ? 4 : '50%',
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  timeout: 120_000,          // 2 мин на тест (см. бюджет ниже)
  expect: { timeout: 10_000 },
}
```

**Бюджет одного теста (target):**

- `landing.spec.ts` — ~5–10 сек (загрузка + 5–10 ассертов)
- `survey-flow.spec.ts` — ~30–90 сек (зависит от реальной длины survey)
- `paywall.spec.ts` — ~30–90 сек (прохождение опросника до paywall)
- `no-missing-keys.spec.ts` — ~30–60 сек (проход по экранам + скрейп текста)
- `visual.spec.ts` — ~10–20 сек (загрузка + wait-stable + snapshot)

**Дублирование прохождения survey между файлами — осознанное решение.** Тесты `survey-flow.spec.ts`, `paywall.spec.ts`, `no-missing-keys.spec.ts` каждый независимо проходят опросник от начала до paywall. Это означает что в одном project одна и та же последовательность шагов проигрывается ~3 раза.

Альтернатива (которую мы НЕ выбираем): прогнать survey один раз в `beforeAll`, сохранить `storageState`, переиспользовать в остальных тестах. Почему не выбираем:

- Конфликтует с §9.5.1 (изоляция состояния — мы её ввели именно потому что survey funnel кеширует прогресс, и shared storage между тестами заведомо приведёт к скрытым зависимостям).
- Делает тесты не-независимыми: падение одного «провисит» остальные.
- Сохранённый storageState может протухать между прогонами (на dev-стенде что-то меняется).

Цена дублирования — лишние ~2–3 минуты на project. Цена потерянной изоляции — флейки и неотлаживаемые баги. Выбираем изоляцию.

**Грубая прикидка полного прогона** на машине с 8 ядрами (`workers = '50%' = 4`):

- 60 projects × ~3 минуты среднего времени на project = 180 минут / 4 worker'а = **~45 минут**.
- Если в реальности тесты окажутся медленнее (3 мин/тест × 5 файлов = 15 мин/project), прогон станет 60 × 15 / 4 = **3 часа 45 мин** — это уже сигнал делить на shards или урезать матрицу.
- После первого реального прогона: обновить эти оценки в `README.md` и решить нужно ли что-то оптимизировать.

### 9.4 Репортеры

```ts
reporter: [
  ['list'],
  ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ['json', { outputFile: 'test-results/results.json' }],
];
```

HTML-отчёт группирует по project (видно сразу какие locale/device-комбинации упали), даёт trace viewer на каждый упавший тест (timeline, network, DOM snapshots), а также snapshot diffs.

### 9.5 Артефакты падений

В `test-results/<test>-<project>/`:

- `trace.zip` — полный Playwright trace
- `error-context.md` — summary ошибки
- `test-failed-1.png` — скриншот в момент падения
- `video.webm` — полная запись теста (только для упавших)

**Cleanup-policy.** При 60 projects × возможные failures видео + trace быстро занимают гигабайты. Меры:

- `test-results/` и `playwright-report/` — в `.gitignore`.
- Перед каждым прогоном делается `rimraf test-results playwright-report` (встроено в Playwright по умолчанию для `test-results`, делаем то же для report).
- Локальная утилита `npm run test:clean` — `rimraf test-results playwright-report *-snapshots-actual` для ручной очистки.
- В `playwright.config.ts`: `outputDir: 'test-results'` + `preserveOutput: 'failures-only'` (по умолчанию). Артефакты прошедших тестов автоматически удаляются.
- Если нужно сохранить артефакты конкретного прогона для расследования — копируем в `test-results-archive/<date>/` вручную (этой папки в `.gitignore` нет, она для разработчика локально).

### 9.5.1 Изоляция состояния между тестами

Survey funnel часто кеширует прогресс в `localStorage`/cookies. При `fullyParallel: true` тесты бегут в изолированных browser contexts по умолчанию, НО:

- Глобально в `use:` блоке выставляем `storageState: undefined` явно (документирует намерение, защищает от случайного `storageState` в проектах).
- В `BasePage` конструкторе ставим `addInitScript` который **запускается до любого скрипта страницы** при каждой навигации:
  ```ts
  await this.context.addInitScript(() => {
    try { localStorage.clear(); sessionStorage.clear(); } catch {}
  });
  ```
  Это критично: если делать `localStorage.clear()` ПОСЛЕ `goto`, страница уже могла записать «уже видел paywall» в localStorage до того как мы вычистили — и весь сценарий уже отравлен. `addInitScript` гарантирует чистый старт.
- Cookies чистятся через `await context.clearCookies()` перед `goto` (cookies в отличие от storage можно убрать без domain).
- Никаких сценариев «передаём cookie из одного теста в другой». Если такая потребность возникнет — она нарушит изоляцию и требует пересмотра дизайна.

### 9.6 Quality gates (локально)

- `npm run lint` — ESLint по `.ts` файлам
- `npm run typecheck` — `tsc --noEmit`
- `npm run format` — Prettier write

По умолчанию НЕ запускаются автоматически pre-commit; пользователь может опционально добавить через Husky позже.

### 9.7 README

`README.md` покрывает:

- Setup: clone → `cp .env.example .env` → заполнить креды → `npm install` → `npm run install:browsers`
- Примеры запуска
- Где смотреть отчёты / артефакты падений
- Как обновить snapshots / переводы
- Краткое объяснение матрицы из 60 projects и схемы именования

---

## 10. TDD-дисциплина

Для каждого тестового файла:

1. **Red:** пишем тест против живого приложения, ожидающий локализованное поведение. Если он сразу проходит без работы — это подозрительно, проверь что тест реально падает на ошибочных ожиданиях (например, временно поменяй ожидаемую строку).
2. **Green:** для e2e против существующего приложения «green» означает что тест корректно отражает текущее правильное поведение. Сообщение ассерта должно быть информативным: называть конкретные locale / device / engine / шаг / ключ.
3. **Refactor:** консолидировать общие хелперы (POM-методы, fixtures) когда 2+ тестов нуждаются в них. Избегать преждевременной абстракции.

Для импортёра Excel (чистая логика) TDD применяется в чистом виде: пишем падающий unit-тест против минимального fixture-xlsx → делаем зелёным → рефакторим.

---

## 11. Риски и митигации

| Риск                                                             | Митигация                                                              |
|------------------------------------------------------------------|-------------------------------------------------------------------------|
| xlsx может быть устаревшим относительно живого приложения        | Считаем xlsx snapshot-ом. Расхождения, валящие тесты = баги в триаж.    |
| В опроснике есть ветвление → флаки в зависимости от ответов      | Detect-and-answer хелпер выбирает детерминированный первый валидный ответ. |
| Длинные строки (de, ru) ломают вёрстку                           | DOM-ассерты на overflow на каждом тесте; пиксельные снапшоты на ключевых экранах. |
| **Playwright WebKit ≠ Safari iOS** (а не только ≠ desktop Safari). | Жёстко прописано: Playwright WebKit использует системный WebKit на Linux/macOS, **без** iOS-специфичных quirks: viewport units (`100vh` на iOS Safari учитывает URL bar динамически), momentum scrolling, авто-zoom на input focus, специфика safe-area inset. Все pixel snapshots на `webkit + iphone17` это **приближение**, а не доказательство что в реальной iOS Safari всё работает идентично. Известные классы багов которые мы НЕ ловим: zoom при focus на input < 16px, авто-смещение viewport при появлении клавиатуры, разница в font-rendering hinting. Документируется в README красным текстом. При найденных в проде iOS-specific багах — заводим тикет с пометкой «требует real-device testing». |
| Спека iPhone 17 новая; UA/viewport — предположения, могут потребовать корректировки | Централизовано в `src/config/devices.ts`; легко обновить когда появятся реальные данные. |
| Полный прогон матрицы медленный (~25–40 мин)                     | Smoke-сюита для быстрой обратной связи; per-project фильтр; параллельные workers. |
| Snapshot-тесты флейкуют на различиях в font rendering            | Многослойные anti-flake настройки (animations off, fonts ready, маски). |
| Утечка basic-auth кредов                                         | `.env` в `.gitignore`; HTML-отчёт редактирует; чистый `.env.example` шаблон. |
| xlsx-schema может сломаться (команда локализации переименует колонку / sheet / удалит `key`) | Импортёр валидирует schema на старте (§5.2 шаг 3): проверяет наличие колонки `key` и всех 10 языковых колонок; при отсутствии падает с понятным сообщением, называющим конкретно что не так. Никаких cryptic ошибок типа `Cannot read property 'en' of undefined`. |
| UA-stub не совпадает с реальным UA → бэкенд может отдать другой контент | Acceptance check: до полного прогона матрицы — открыть приложение **вручную** в Chrome DevTools с эмуляцией iPhone и сравнить серверный HTML с тем что отдаёт сервер при playwright-прогоне (`page.content()` после `goto`). Если контент идентичен — UA не используется бэкендом для ветвления, дальше работаем как описано. Если разный — заводим тикет «требуются реальные UA-строки» и переходим на real-device cloud для затронутых проверок. |

---

## 12. Критерии успеха

Проект считается «готовым» когда:

1. `npm install && npm run install:browsers && npm test` запускает полную матрицу 60 projects локально без ошибок setup.
2. Все baseline-снапшоты закоммичены и воспроизводимы.
3. Тесты детерминированы локально (нет флейков на 3 подряд прогонах smoke-сюиты).
4. Изменение в xlsx, вносящее некорректный перевод для любой локали, приводит к падению соответствующего `landing.spec.ts` / `survey-flow.spec.ts` с понятным сообщением, называющим locale и ключ.
5. По `README.md` новый разработчик может склонировать, настроить и запустить тесты за <10 минут.
6. `npm run lint` и `npm run typecheck` зелёные.
7. **UA-smoke выполнен и задокументирован** (раздел в README): сравнили серверный ответ для нашего UA-stub и для реального UA с устройства; результат — «бэкенд не ветвится по UA» ИЛИ заведённый тикет если ветвится.
8. **pt-вариант разрешён**: определено окончательно pt-PT или pt-BR, `locales.ts` обновлён, переводы из xlsx сверены с тем что отдаёт приложение для соответствующего `Accept-Language`.
9. **Survey safety-cap откалиброван**: проведён ручной замер длины опросника, `MAX_STEPS` зафиксирован в `survey-flow.ts` с комментарием почему именно это число.
10. **xlsx schema validation работает**: попытка импортировать xlsx с переименованной/удалённой обязательной колонкой даёт понятную ошибку (не cryptic).
