# 12. Подключение тестового проекта: JUnit 4, JUnit 5, TestNG

Инструкция для владельцев Java-проектов с автотестами: как настроить отправку результатов в
**Reporter for autotests**, чтобы запуски появлялись в отчёте сразу, а шаги, скриншоты и стектрейсы —
после прогона. Серверная сторона описана в [05-api.md](05-api.md) и
[07-ingestion-and-import.md](07-ingestion-and-import.md); здесь — только клиент.

Код одинаков для всех трёх фреймворков: общий класс `ReporterClient` (HTTP + zip) и тонкие адаптеры
под JUnit 4, JUnit 5 и TestNG.

## 1. Два канала отправки

| Канал | Эндпоинт | Когда вызывается | Что даёт |
| --- | --- | --- | --- |
| **Форма** | `POST /api/results` | после каждого теста | строка запуска в отчёте в тот же момент: путь, статус, владелец, время, теги, сообщение |
| **Архив** | `POST /api/allure/import` | один раз в конце прогона (план / класс / suite) | шаги, вложения (скриншоты), параметры, ссылки, `statusDetails` (стектрейс) |

Каналы независимы:

- только форма — быстрые статусы, но без детализации;
- только архив — полная карточка, но строки появляются после конца прогона;
- оба — статус приходит мгновенно формой, детализация доливается архивом.

**Как они склеиваются.** Импорт архива не создаёт вторую строку, если запуск уже отправлен формой:
совпадение `path` + `circuit` + `startDate` ±10 с (это одно и то же выполнение теста) — импорт
дополняет существующую строку (`enriched`), а статус, время и окружение остаются от формы. Поэтому
основной канал — форма, архив — «обогащение». Повторная загрузка того же архива идемпотентна по
`externalId`.

**Каталог.** Отчёт строится по каталогу тестов (`AutomatedTest`): запуск невидимого пути в отчёт не
попадёт, даже если он есть в БД. Импорт архива регистрирует пути автоматически (`source = 'allure'`).
Если используете только форму, путь нужно добавить в каталог — кнопкой «Собрать из запусков»
(Harvest) на странице фазы или через `POST /api/tests`.

## 2. Общие требования

| Компонент | Что нужно |
| --- | --- |
| Java | 11+ (код использует `Files`, `Instant`, `isBlank`) |
| HTTP-клиент | OkHttp 3.12+ или 4.x (в коде — API 3.x: `MediaType.parse`, `RequestBody.create(MediaType, byte[])`; в OkHttp 5 API изменился) |
| Allure | адаптер своего фреймворка: `allure-junit5` / `allure-junit4` / `allure-testng` |
| JUnit 5 | `junit-jupiter` + `junit-platform-launcher` (для `TestExecutionListener`, scope `test`) |

Java-пакеты в примерах: только один общий (`com.example.reporting`), плюс `junit4`, `junit5`, `testng`
под пакетом `com.example.reporting.*`. Скопируйте классы в `src/test/java`, имена пакетов можно
поменять.

### 2.1. Настройки (system properties)

| Property | По умолчанию | Смысл |
| --- | --- | --- |
| `reporter.api` | `http://localhost:3001` | адрес API (без `/api` на конце) |
| `reporter.project` | `cwi` | `projectName` / workspace; то же значение, что в существующем `ResultWriter` |
| `reporter.environment` | `DSO` | окружение: уходит в `circuit` формы и в `environment` импорта; сравнивается с `Phase.environment` без учёта регистра |
| `reporter.launch` | случайный UUID на JVM | `launchId` прогона: передавайте номер CI-сборки, чтобы один прогон группировался в один `launchId` |
| `reporter.origin` | `ci` при `CI`, иначе `local` | источник прогона в «Истории запусков» (`ci`/`local`); в CI задайте `ci` явно |
| `reporter.timezone` | `Europe/Moscow` | только для форматирования дат в форме (с offset, см. ниже) |

Значения по умолчанию вписаны в `ReporterClient`, поэтому «зелёная стрелка» работает без настройки.
Для другого сервера/окружения задайте свойства:

- IntelliJ IDEA: Run / Debug Configuration → **VM options** → `-Dreporter.api=http://10.0.0.5:3001 -Dreporter.environment=stage`;
- Maven: `-DargLine="-Dreporter.api=... -Dreporter.environment=stage"` либо `<systemPropertyVariables>`;
- Gradle: `test { systemProperty 'reporter.api', '...' }`.

### 2.2. Даты: обязательно с offset

`startDate`/`endDate` формы должны содержать offset (`2026-11-01T16:02:49+03:00`). Сервер парсит их
как `new Date(value)`: строка без offset трактуется как локальное время сервера, и если время сервера
не совпадает с часовым поясом теста, `startDate` сдвинется — импорт архива не найдёт строку в
окне ±10 с и создаст дубль вместо `enriched`. В коде ниже формат
`yyyy-MM-dd'T'HH:mm:ssXXX` — с offset, `Instant` хранится как абсолютная точка времени.

### 2.3. Где лежит `allure-results`

`ReporterClient` ищет папку так: system property `allure.results.directory` → `target/allure-results`
(Maven) → `build/allure-results` (Gradle). Это же значение использует Allure-адаптер. Если у вас
другой каталог, задайте `-Dallure.results.directory=...` для **всех** (Allure и клиент).

## 3. Общий клиент `ReporterClient`

Один класс на все фреймворки: форма на тест, zip и импорт на прогон, повторная отправка уже
ушедших файлов отсекается (`UPLOADED`), отправка сериализована (`LOCK`) — безопасно при параллельных
тестах и нескольких suite в одном JVM.

```java
package com.example.reporting;

import okhttp3.FormBody;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Клиент Reporter API: POST /api/results (один тест) и
 * POST /api/allure/import (один zip архива allure-results на прогон).
 */
public final class ReporterClient {

    private static final String API_URL = trimSlash(System.getProperty("reporter.api", "http://localhost:3001"));
    private static final String PROJECT_NAME = System.getProperty("reporter.project", "cwi");
    private static final String ENVIRONMENT = System.getProperty("reporter.environment", "DSO");
    /** ci или local: источник прогона на странице «История запусков». */
    private static final String ORIGIN = resolveOrigin();
    private static final String LAUNCH_ID =
            limit(System.getProperty("reporter.launch", UUID.randomUUID().toString()), 128);
    private static final ZoneId ZONE = ZoneId.of(System.getProperty("reporter.timezone", "Europe/Moscow"));

    /** ISO 8601 с offset — сервер хранит TIMESTAMPTZ, импорт матчится по точному времени. */
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssXXX");

    private static final MediaType ZIP = MediaType.parse("application/zip");
    private static final OkHttpClient CLIENT = new OkHttpClient();

    private static final Set<String> UPLOADED = ConcurrentHashMap.newKeySet();
    private static final Object LOCK = new Object();

    private ReporterClient() {
    }

    /** Один завершённый запуск → одна строка в отчёте. */
    public static boolean postRun(RunData run) {
        FormBody.Builder form = new FormBody.Builder()
                .add("projectName", PROJECT_NAME)
                .add("path", run.path)
                .add("suiteName", orEmpty(run.suiteName))
                .add("caseName", orEmpty(run.caseName))
                .add("status", run.status)
                .add("owner", orEmpty(run.owner))
                .add("circuit", ENVIRONMENT)
                .add("message", orEmpty(run.message))
                .add("startDate", format(run.start))
                .add("endDate", format(run.end != null ? run.end : run.start));

        for (String tag : run.tags) {
            form.add("tag", tag);
        }

        Request request = new Request.Builder()
                .url(API_URL + "/api/results")
                .post(form.build())
                .build();

        try (Response response = CLIENT.newCall(request).execute()) {
            String body = response.body() != null ? response.body().string() : "";
            if (!response.isSuccessful()) {
                System.err.println("[reporter] POST /api/results failed: HTTP " + response.code() + " " + body);
            }
            return response.isSuccessful();
        } catch (IOException e) {
            System.err.println("[reporter] POST /api/results failed: " + e);
            return false;
        }
    }

    /**
     * ZIP папки allure-results → POST /api/allure/import.
     * sinceMillis — начало прогона: файлы прошлых прогонов в переиспользуемой папке игнорируются.
     */
    public static boolean uploadAllureArchive(long sinceMillis) {
        Path dir = resolveResultsDir();
        if (!Files.isDirectory(dir)) {
            System.err.println("[reporter] allure-results не найдены: " + dir);
            return false;
        }

        synchronized (LOCK) {
            try {
                List<Path> files = newFiles(dir, sinceMillis);
                if (files.isEmpty()) {
                    System.out.println("[reporter] новых allure-файлов нет — импорт пропущен");
                    return false;
                }

                byte[] archive = zip(dir, files);
                String url = API_URL + "/api/allure/import"
                        + "?environment=" + encode(ENVIRONMENT)
                        + "&projectName=" + encode(PROJECT_NAME)
                        + "&launchId=" + encode(LAUNCH_ID)
                        + "&origin=" + encode(ORIGIN);

                Request request = new Request.Builder()
                        .url(url)
                        .post(RequestBody.create(ZIP, archive))
                        .build();

                try (Response response = CLIENT.newCall(request).execute()) {
                    String body = response.body() != null ? response.body().string() : "";
                    if (!response.isSuccessful()) {
                        System.err.println("[reporter] POST /api/allure/import failed: HTTP "
                                + response.code() + " " + body);
                        return false;
                    }
                    files.forEach(file -> UPLOADED.add(file.toAbsolutePath().toString()));
                    System.out.println("[reporter] POST /api/allure/import: " + body);
                    return true;
                }
            } catch (IOException e) {
                System.err.println("[reporter] POST /api/allure/import failed: " + e);
                return false;
            }
        }
    }

    private static List<Path> newFiles(Path dir, long sinceMillis) throws IOException {
        long threshold = (sinceMillis > 0 ? sinceMillis : System.currentTimeMillis()) - 5_000L;
        List<Path> files = new ArrayList<>();
        try (Stream<Path> walk = Files.walk(dir)) {
            walk.filter(Files::isRegularFile)
                    .filter(file -> lastModified(file) >= threshold)
                    .filter(file -> !UPLOADED.contains(file.toAbsolutePath().toString()))
                    .sorted(Comparator.comparing(Path::toString))
                    .forEach(files::add);
        }
        return files;
    }

    private static byte[] zip(Path dir, List<Path> files) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(buffer)) {
            for (Path file : files) {
                // Файлы кладём в корень архива: сервер ждёт содержимое allure-results, не родителя.
                String name = dir.relativize(file).toString().replace('\\', '/');
                zip.putNextEntry(new ZipEntry(name));
                Files.copy(file, zip);
                zip.closeEntry();
            }
        }
        return buffer.toByteArray();
    }

    private static long lastModified(Path file) {
        try {
            return Files.getLastModifiedTime(file).toMillis();
        } catch (IOException e) {
            return 0L;
        }
    }

    private static Path resolveResultsDir() {
        String configured = System.getProperty("allure.results.directory");
        if (configured != null && !configured.isBlank()) {
            return Paths.get(configured);
        }
        Path maven = Paths.get("target", "allure-results");
        if (Files.isDirectory(maven)) {
            return maven;
        }
        Path gradle = Paths.get("build", "allure-results");
        return Files.isDirectory(gradle) ? gradle : maven;
    }

    /** -Dreporter.origin переопределяет автодетект; иначе CI-окружение даёт ci, машина разработчика — local. */
    private static String resolveOrigin() {
        String configured = System.getProperty("reporter.origin");
        if (configured != null && !configured.isBlank()) {
            return configured.trim().toLowerCase();
        }
        return System.getenv("CI") != null ? "ci" : "local";
    }

    private static String format(Instant instant) {
        return DATE_TIME.format(instant.atZone(ZONE));
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static String trimSlash(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    private static String limit(String value, int max) {
        return value.length() > max ? value.substring(0, max) : value;
    }

    private static String orEmpty(String value) {
        return value == null ? "" : value;
    }

    /** Данные одного запуска — одинаковые для всех фреймворков. */
    public static final class RunData {
        public String path;
        public String suiteName = "";
        public String caseName = "";
        public String status = "SKIPPED";
        public String owner = "";
        public String message = " ";
        public Instant start;
        public Instant end;
        public Set<String> tags = new LinkedHashSet<>();
    }
}
```

## 4. JUnit 5

### 4.1. Зависимости

```xml
<dependency>
    <groupId>org.junit.jupiter</groupId>
    <artifactId>junit-jupiter</artifactId>
    <version>5.10.2</version>
    <scope>test</scope>
</dependency>
<!-- обязателен для TestExecutionListener (канал «архив») -->
<dependency>
    <groupId>org.junit.platform</groupId>
    <artifactId>junit-platform-launcher</artifactId>
    <version>1.10.2</version>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>io.qameta.allure</groupId>
    <artifactId>allure-junit5</artifactId>
    <version>2.25.0</version>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>com.squareup.okhttp3</groupId>
    <artifactId>okhttp</artifactId>
    <version>4.12.0</version> <!-- или 3.14.x -->
    <scope>test</scope>
</dependency>
```

Allure JUnit 5 подключается сам через ServiceLoader. Если в вашей версии `allure-results` пуст —
добавьте `@ExtendWith(AllureJunit5.class)` на базовый класс.

### 4.2. Канал «форма»: `ResultWriter`

```java
package com.example.reporting.junit5;

import com.example.reporting.ReporterClient;
import com.example.reporting.ReporterClient.RunData;
import io.qameta.allure.Feature;
import io.qameta.allure.Owner;
import io.qameta.allure.Story;
import org.junit.jupiter.api.extension.BeforeTestExecutionCallback;
import org.junit.jupiter.api.extension.ExtensionContext;
import org.junit.jupiter.api.extension.TestWatcher;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.function.Function;

public class ResultWriter implements BeforeTestExecutionCallback, TestWatcher {

    private static final String PROJECT_TAG = "DSO";
    private final ConcurrentMap<String, RunData> started = new ConcurrentHashMap<>();

    @Override
    public void beforeTestExecution(ExtensionContext context) {
        RunData run = createRun(context);
        run.start = Instant.now();
        started.put(context.getUniqueId(), run);
    }

    @Override
    public void testSuccessful(ExtensionContext context) {
        finish(context, "PASSED", " ");
    }

    @Override
    public void testFailed(ExtensionContext context, Throwable cause) {
        finish(context, cause instanceof AssertionError ? "FAILED" : "BROKEN", message(cause));
    }

    @Override
    public void testAborted(ExtensionContext context, Throwable cause) {
        // Упавший assumption — это skipped, а не failed.
        finish(context, "SKIPPED", message(cause));
    }

    @Override
    public void testDisabled(ExtensionContext context, Optional<String> reason) {
        // @Disabled: beforeTestExecution не вызывается.
        RunData run = createRun(context);
        run.start = Instant.now();
        run.status = "SKIPPED";
        run.message = reason.orElse(" ");
        run.end = Instant.now();
        ReporterClient.postRun(run);
    }

    private void finish(ExtensionContext context, String status, String message) {
        RunData run = started.remove(context.getUniqueId());
        if (run == null) {
            // Тест упал в @BeforeEach и не дошёл до beforeTestExecution.
            run = createRun(context);
            run.start = Instant.now();
        }
        run.status = status;
        run.message = message;
        run.end = Instant.now();
        ReporterClient.postRun(run);
    }

    private RunData createRun(ExtensionContext context) {
        Class<?> testClass = context.getRequiredTestClass();
        Method method = context.getRequiredTestMethod();

        RunData run = new RunData();
        run.path = testClass.getName() + "#" + method.getName();
        run.suiteName = annotationValue(testClass, method, Feature.class, Feature::value);
        run.caseName = annotationValue(testClass, method, Story.class, Story::value);
        run.owner = annotationValue(testClass, method, Owner.class, Owner::value);
        run.tags.add(PROJECT_TAG);
        return run;
    }

    private static <A extends Annotation> String annotationValue(
            Class<?> testClass, Method method, Class<A> type, Function<A, String> getter) {
        A annotation = method.getAnnotation(type);
        if (annotation == null) {
            annotation = testClass.getAnnotation(type);
        }
        return annotation != null ? getter.apply(annotation) : "";
    }

    private static String message(Throwable cause) {
        return cause != null && cause.getMessage() != null ? cause.getMessage() : " ";
    }
}
```

Регистрация — самой аннотацией на базовом классе (наследники получают её автоматически):

```java
@ExtendWith(ResultWriter.class)
public abstract class BaseTest {
    // все тесты проекта наследуются от этого класса
}
```

Либо глобально, без изменения тестов: `src/test/resources/junit-platform.properties` с
`junit.jupiter.extensions.autodetection.enabled=true` и файл
`META-INF/services/org.junit.jupiter.api.extension.Extension` с FQCN `ResultWriter`.

### 4.3. Канал «архив»: `AllureResultsUploader`

```java
package com.example.reporting.junit5;

import com.example.reporting.ReporterClient;
import org.junit.platform.launcher.TestExecutionListener;
import org.junit.platform.launcher.TestPlan;

public class AllureResultsUploader implements TestExecutionListener {

    /** Класс загружается до запуска тестов: всё свежее — файлы текущего прогона. */
    private static final long RUN_STARTED_AT = System.currentTimeMillis();

    @Override
    public void testPlanExecutionFinished(TestPlan testPlan) {
        ReporterClient.uploadAllureArchive(RUN_STARTED_AT);
    }
}
```

Регистрация — только ServiceLoader (аннотации для `TestExecutionListener` нет):

`src/test/resources/META-INF/services/org.junit.platform.launcher.TestExecutionListener`:

```text
com.example.reporting.junit5.AllureResultsUploader
```

### 4.4. Когда срабатывает при «зелёной стрелке»

- один метод — архив уходит сразу после него;
- класс — одна отправка после последнего метода класса;
- пакет/конфигурация — одна отправка в конце прогона (после всех тестов).

## 5. JUnit 4

JUnit 4 не даёт хука «конец прогона»: подключаем `RunListener` через собственный runner, а архив
отправляем в его `testRunFinished`.

### 5.1. Зависимости

```xml
<dependency>
    <groupId>junit</groupId>
    <artifactId>junit</artifactId>
    <version>4.13.2</version>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>io.qameta.allure</groupId>
    <artifactId>allure-junit4</artifactId>
    <version>2.25.0</version>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>com.squareup.okhttp3</groupId>
    <artifactId>okhttp</artifactId>
    <version>4.12.0</version>
    <scope>test</scope>
</dependency>
```

### 5.2. `ResultWriter` — форма на тест + архив в конце

```java
package com.example.reporting.junit4;

import com.example.reporting.ReporterClient;
import com.example.reporting.ReporterClient.RunData;
import io.qameta.allure.Feature;
import io.qameta.allure.Owner;
import io.qameta.allure.Story;
import org.junit.experimental.categories.Category;
import org.junit.runner.Description;
import org.junit.runner.Result;
import org.junit.runner.notification.Failure;
import org.junit.runner.notification.RunListener;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.function.Function;

public class ResultWriter extends RunListener {

    private static final String PROJECT_TAG = "DSO";

    private static final class State {
        Instant start;
        String status = "SKIPPED";
        String message = " ";
    }

    private final ConcurrentMap<String, State> states = new ConcurrentHashMap<>();
    /** Слушатель создаётся перед прогоном класса — хороший якорь для отбора свежих файлов. */
    private final long startedAt = System.currentTimeMillis();

    @Override
    public void testStarted(Description description) {
        State state = new State();
        state.start = Instant.now();
        states.put(key(description), state);
    }

    @Override
    public void testFailure(Failure failure) {
        State state = state(failure.getDescription());
        state.status = failure.getException() instanceof AssertionError ? "FAILED" : "BROKEN";
        state.message = message(failure.getException());
    }

    @Override
    public void testAssumptionFailure(Failure failure) {
        State state = state(failure.getDescription());
        state.status = "SKIPPED";
        state.message = message(failure.getException());
    }

    @Override
    public void testFinished(Description description) {
        State state = states.remove(key(description));
        if (state == null) {
            return;
        }
        RunData run = build(description, state);
        run.end = Instant.now();
        ReporterClient.postRun(run);
    }

    @Override
    public void testIgnored(Description description) {
        State state = new State();
        state.start = Instant.now();
        RunData run = build(description, state);
        run.end = Instant.now();
        ReporterClient.postRun(run);
    }

    @Override
    public void testRunFinished(Result result) {
        // Все *-result.json уже на диске: Allure пишет их в testFinished каждого теста.
        ReporterClient.uploadAllureArchive(startedAt);
    }

    private State state(Description description) {
        return states.computeIfAbsent(key(description), ignored -> {
            State state = new State();
            state.start = Instant.now();
            return state;
        });
    }

    private RunData build(Description description, State state) {
        Class<?> testClass = description.getTestClass();
        Method method = methodOf(description);

        RunData run = new RunData();
        run.path = description.getClassName()
                + (description.getMethodName() != null ? "#" + description.getMethodName() : "");
        run.status = state.status;
        run.message = state.message;
        run.start = state.start != null ? state.start : Instant.now();
        run.suiteName = annotationValue(testClass, method, Feature.class, Feature::value);
        run.caseName = annotationValue(testClass, method, Story.class, Story::value);
        run.owner = annotationValue(testClass, method, Owner.class, Owner::value);
        run.tags.add(PROJECT_TAG);
        run.tags.addAll(categories(testClass, method));
        return run;
    }

    private static String key(Description description) {
        return description.getDisplayName();
    }

    private static Method methodOf(Description description) {
        Class<?> testClass = description.getTestClass();
        String name = description.getMethodName();
        if (testClass == null || name == null) {
            return null;
        }
        try {
            return testClass.getMethod(name);
        } catch (NoSuchMethodException e) {
            return null; // параметризованные тесты: имя содержит "[0]"
        }
    }

    private static Set<String> categories(Class<?> testClass, Method method) {
        Set<String> tags = new LinkedHashSet<>();
        Category category = method != null ? method.getAnnotation(Category.class) : null;
        if (category == null && testClass != null) {
            category = testClass.getAnnotation(Category.class);
        }
        if (category != null) {
            for (Class<?> type : category.value()) {
                tags.add(type.getSimpleName());
            }
        }
        return tags;
    }

    private static <A extends Annotation> String annotationValue(
            Class<?> testClass, Method method, Class<A> type, Function<A, String> getter) {
        A annotation = method != null ? method.getAnnotation(type) : null;
        if (annotation == null && testClass != null) {
            annotation = testClass.getAnnotation(type);
        }
        return annotation != null ? getter.apply(annotation) : "";
    }

    private static String message(Throwable cause) {
        return cause != null && cause.getMessage() != null ? cause.getMessage() : " ";
    }
}
```

### 5.3. `ReportingRunner` и регистрация

```java
package com.example.reporting.junit4;

import io.qameta.allure.junit4.AllureJunit4;
import org.junit.runner.notification.RunNotifier;
import org.junit.runners.BlockJUnit4ClassRunner;
import org.junit.runners.model.InitializationError;

/**
 * Обычный BlockJUnit4ClassRunner + два RunListener:
 * Allure (пишет allure-results) и ResultWriter (форма + отправка архива в testRunFinished).
 */
public class ReportingRunner extends BlockJUnit4ClassRunner {

    public ReportingRunner(Class<?> testClass) throws InitializationError {
        super(testClass);
    }

    @Override
    public void run(RunNotifier notifier) {
        notifier.addListener(new AllureJunit4());
        notifier.addListener(new ResultWriter());
        super.run(notifier);
    }
}
```

Регистрация — аннотацией на базовом классе (`@RunWith` наследуется подклассами):

```java
@RunWith(ReportingRunner.class)
public abstract class BaseTest {
    // все тесты проекта наследуются от этого класса
}
```

Важно:

- если Allure уже подключён через Surefire (`<listener>io.qameta.allure.junit4.AllureJunit4</listener>`
  или `-Dlistener=...`), **уберите** строку `new AllureJunit4()` из раннера, иначе каждый тест
  запишется дважды;
- если ваша версия `allure-junit4` не даёт публичный конструктор без аргументов — тоже оставьте
  Allure в конфигурации Surefire, а в раннере только `ResultWriter`;
- сбой уровня `@BeforeClass` приходит как событие без `testStarted`/`testFinished` и в форму не
  попадёт; его подхватит канал «архив», если Allure успел записать результат.

### 5.4. Если у классов уже есть свой `@RunWith`

Параметризованные тесты, `Suite`, `MockitoJUnitRunner` и т. п. конфликтуют с `@RunWith(ReportingRunner.class)`.
Тогда используйте `TestRule` в базовом классе — правило оборачивает каждый тест и работает с любым
runner-ом, а архив отправляется из `@AfterClass`:

```java
package com.example.reporting.junit4;

import com.example.reporting.ReporterClient;
import com.example.reporting.ReporterClient.RunData;
import io.qameta.allure.Feature;
import io.qameta.allure.Owner;
import io.qameta.allure.Story;
import org.junit.AssumptionViolatedException;
import org.junit.rules.TestRule;
import org.junit.runner.Description;
import org.junit.runners.model.Statement;

import java.time.Instant;

public class ReporterRule implements TestRule {

    private static final String PROJECT_TAG = "DSO";

    @Override
    public Statement apply(Statement base, Description description) {
        return new Statement() {
            @Override
            public void evaluate() throws Throwable {
                RunData run = createRun(description);
                run.start = Instant.now();
                Throwable failure = null;
                try {
                    base.evaluate();
                } catch (Throwable t) {
                    failure = t;
                    throw t;
                } finally {
                    run.end = Instant.now();
                    if (failure == null) {
                        run.status = "PASSED";
                    } else if (failure instanceof AssumptionViolatedException) {
                        run.status = "SKIPPED";
                        run.message = message(failure);
                    } else if (failure instanceof AssertionError) {
                        run.status = "FAILED";
                        run.message = message(failure);
                    } else {
                        run.status = "BROKEN";
                        run.message = message(failure);
                    }
                    ReporterClient.postRun(run);
                }
            }
        };
    }

    private RunData createRun(Description description) {
        RunData run = new RunData();
        run.path = description.getClassName()
                + (description.getMethodName() != null ? "#" + description.getMethodName() : "");
        Class<?> testClass = description.getTestClass();
        try {
            java.lang.reflect.Method method = testClass != null && description.getMethodName() != null
                    ? testClass.getMethod(description.getMethodName())
                    : null;
            run.suiteName = annotationValue(testClass, method, Feature.class, Feature::value);
            run.caseName = annotationValue(testClass, method, Story.class, Story::value);
            run.owner = annotationValue(testClass, method, Owner.class, Owner::value);
        } catch (NoSuchMethodException ignored) {
            // параметризованные тесты: аннотации берём только с класса
        }
        run.tags.add(PROJECT_TAG);
        return run;
    }

    private static <A extends java.lang.annotation.Annotation> String annotationValue(
            Class<?> testClass, java.lang.reflect.Method method,
            Class<A> type, java.util.function.Function<A, String> getter) {
        A annotation = method != null ? method.getAnnotation(type) : null;
        if (annotation == null && testClass != null) {
            annotation = testClass.getAnnotation(type);
        }
        return annotation != null ? getter.apply(annotation) : "";
    }

    private static String message(Throwable cause) {
        return cause != null && cause.getMessage() != null ? cause.getMessage() : " ";
    }
}
```

База:

```java
public abstract class BaseTest {

    private static long classStartedAt;

    @BeforeClass
    public static void reporterClassStarted() {
        classStartedAt = System.currentTimeMillis();
    }

    @AfterClass
    public static void reporterClassFinished() {
        ReporterClient.uploadAllureArchive(classStartedAt);
    }

    @Rule
    public final ReporterRule reporterRule = new ReporterRule();
}
```

`@Ignore`-тесты в форме не появятся (правило для них не выполняется) — это нормально: в отчёте они
будут `no_run`, а импорт архива для них результата и не создаёт. Параллельные классы JUnit 4 при
такой схеме требуют аккуратности: `classStartedAt` общий на JVM — используйте вариант с
`ReportingRunner`.

## 6. TestNG

### 6.1. Зависимости

```xml
<dependency>
    <groupId>org.testng</groupId>
    <artifactId>testng</artifactId>
    <version>7.10.2</version>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>io.qameta.allure</groupId>
    <artifactId>allure-testng</artifactId>
    <version>2.25.0</version>
    <scope>test</scope>
</dependency>
<dependency>
    <groupId>com.squareup.okhttp3</groupId>
    <artifactId>okhttp</artifactId>
    <version>4.12.0</version>
    <scope>test</scope>
</dependency>
```

Свежие версии `allure-testng` регистрируют `AllureTestNg` сами (ServiceLoader). Если `allure-results`
пуст — добавьте слушатель вручную (см. регистрацию ниже).

### 6.2. Канал «форма»: `ResultWriter`

```java
package com.example.reporting.testng;

import com.example.reporting.ReporterClient;
import com.example.reporting.ReporterClient.RunData;
import io.qameta.allure.Feature;
import io.qameta.allure.Owner;
import io.qameta.allure.Story;
import org.testng.ITestListener;
import org.testng.ITestResult;

import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.function.Function;

public class ResultWriter implements ITestListener {

    private static final String PROJECT_TAG = "DSO";

    @Override
    public void onTestSuccess(ITestResult result) {
        write(result, "PASSED", " ");
    }

    @Override
    public void onTestFailure(ITestResult result) {
        Throwable cause = result.getThrowable();
        write(result, cause instanceof AssertionError ? "FAILED" : "BROKEN", message(cause));
    }

    @Override
    public void onTestSkipped(ITestResult result) {
        write(result, "SKIPPED", message(result.getThrowable()));
    }

    @Override
    public void onTestFailedButWithinSuccessPercentage(ITestResult result) {
        write(result, "FAILED", message(result.getThrowable()));
    }

    private void write(ITestResult result, String status, String message) {
        Class<?> testClass = result.getTestClass().getRealClass();
        Method method = result.getMethod().getConstructorOrMethod().getMethod();

        RunData run = new RunData();
        run.path = testClass.getName() + "#" + result.getMethod().getMethodName();
        run.status = status;
        run.message = message;
        run.start = Instant.ofEpochMilli(result.getStartMillis() > 0
                ? result.getStartMillis()
                : System.currentTimeMillis());
        run.end = Instant.ofEpochMilli(result.getEndMillis() > 0
                ? result.getEndMillis()
                : System.currentTimeMillis());
        run.suiteName = annotationValue(testClass, method, Feature.class, Feature::value);
        run.caseName = annotationValue(testClass, method, Story.class, Story::value);
        run.owner = annotationValue(testClass, method, Owner.class, Owner::value);
        run.tags.add(PROJECT_TAG);
        run.tags.addAll(groups(result));

        ReporterClient.postRun(run);
    }

    private static Set<String> groups(ITestResult result) {
        Set<String> tags = new LinkedHashSet<>();
        String[] groups = result.getMethod().getGroups();
        if (groups != null) {
            for (String group : groups) {
                if (group != null && !group.isBlank()) {
                    tags.add(group);
                }
            }
        }
        return tags;
    }

    private static <A extends Annotation> String annotationValue(
            Class<?> testClass, Method method, Class<A> type, Function<A, String> getter) {
        A annotation = method != null ? method.getAnnotation(type) : null;
        if (annotation == null && testClass != null) {
            annotation = testClass.getAnnotation(type);
        }
        return annotation != null ? getter.apply(annotation) : "";
    }

    private static String message(Throwable cause) {
        return cause != null && cause.getMessage() != null ? cause.getMessage() : " ";
    }
}
```

### 6.3. Канал «архив»: `AllureResultsUploader`

```java
package com.example.reporting.testng;

import com.example.reporting.ReporterClient;
import org.testng.ISuite;
import org.testng.ISuiteListener;
import org.testng.ISuiteResult;
import org.testng.ITestContext;

import java.util.Date;

public class AllureResultsUploader implements ISuiteListener {

    private static final long CLASS_LOADED_AT = System.currentTimeMillis();

    @Override
    public void onStart(ISuite suite) {
        // архив отправляется только в onFinish
    }

    @Override
    public void onFinish(ISuite suite) {
        ReporterClient.uploadAllureArchive(suiteStartedAt(suite));
    }

    /** Самая ранняя дата старта среди <test> этого suite (слушатель может быть создан позже). */
    private static long suiteStartedAt(ISuite suite) {
        long earliest = Long.MAX_VALUE;
        for (ISuiteResult result : suite.getResults().values()) {
            ITestContext context = result.getTestContext();
            Date started = context != null ? context.getStartDate() : null;
            if (started != null) {
                earliest = Math.min(earliest, started.getTime());
            }
        }
        return earliest == Long.MAX_VALUE ? CLASS_LOADED_AT : earliest;
    }
}
```

### 6.4. Регистрация

Все три способа работают; выбирайте один, чтобы не плодить двойные экземпляры слушателей.

1. `testng.xml`:

```xml
<suite name="DSO">
    <listeners>
        <listener class-name="com.example.reporting.testng.ResultWriter"/>
        <listener class-name="com.example.reporting.testng.AllureResultsUploader"/>
    </listeners>

    <test name="...">
        <!-- ... -->
    </test>
</suite>
```

2. ServiceLoader (аналог JUnit-варианта): `src/test/resources/META-INF/services/org.testng.ITestNGListener`:

```text
com.example.reporting.testng.ResultWriter
com.example.reporting.testng.AllureResultsUploader
```

3. Аннотацией на базовом классе:

```java
@Listeners({ResultWriter.class, AllureResultsUploader.class})
public abstract class BaseTest {
    // ...
}
```

Если `allure-results` остаётся пустым, добавьте в список явно
`io.qameta.allure.testng.AllureTestNg` (в старых версиях автоматической регистрации нет) — и
проверьте, что класс не зарегистрирован дважды.

### 6.5. Когда срабатывает при «зелёной стрелке»

IDE создаёт один синтетический suite: `onFinish(ISuite)` — одна отправка архива в конце прогона
(класса, метода или выбранного набора). Если у вас несколько `<suite>` в XML — отправка на каждый,
каждый архив содержит только свои новые файлы, `launchId` общий (из `reporter.launch`).

## 7. Сводная таблица

| Фреймворк | Форма (на тест) | Архив (на прогон) | Регистрация |
| --- | --- | --- | --- |
| JUnit 5 | `ResultWriter` (extension) | `AllureResultsUploader` (`TestExecutionListener`) | `@ExtendWith` / autodetection + `META-INF/services` |
| JUnit 4 | `ResultWriter` (`RunListener`) | там же: `testRunFinished` → upload | `@RunWith(ReportingRunner.class)` |
| JUnit 4 (если `@RunWith` занят) | `ReporterRule` (`TestRule`) | `@AfterClass` в базовом классе | `@Rule` + `@AfterClass` |
| TestNG | `ResultWriter` (`ITestListener`) | `AllureResultsUploader` (`ISuiteListener`) | `testng.xml` / `@Listeners` / ServiceLoader |

## 8. Настройка CI

Maven Surefire:

```xml
<properties>
    <reporter.api>http://reporter.internal:3001</reporter.api>
    <reporter.environment>dso</reporter.environment>
    <reporter.project>cwi</reporter.project>
</properties>

<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-surefire-plugin</artifactId>
    <configuration>
        <systemPropertyVariables>
            <reporter.api>${reporter.api}</reporter.api>
            <reporter.environment>${reporter.environment}</reporter.environment>
            <reporter.project>${reporter.project}</reporter.project>
            <reporter.launch>${env.BUILD_NUMBER}</reporter.launch>
            <reporter.origin>ci</reporter.origin>
        </systemPropertyVariables>
    </configuration>
</plugin>
```

Gradle:

```groovy
test {
    systemProperty 'reporter.api', System.getenv('REPORTER_API') ?: 'http://localhost:3001'
    systemProperty 'reporter.environment', 'dso'
    systemProperty 'reporter.project', 'cwi'
    systemProperty 'reporter.launch', System.getenv('BUILD_NUMBER') ?: System.currentTimeMillis()
    systemProperty 'reporter.origin', 'ci'
    // каталог Allure, если он нестандартный:
    systemProperty 'allure.results.directory', "$buildDir/allure-results"
}
```

Запуск из IDEA («зелёная стрелка») работает без настройки: значения по умолчанию указывают на
`http://localhost:3001`, проект `cwi`, окружение `DSO`. Для другого сервера — VM options в
конфигурации запуска.

Чтобы история запусков отличала CI/CD от локальных прогонов, передавайте при загрузке архива
`origin=ci` (в Maven/Gradle это можно добавить к URL рядом с `launchId`). При загрузке архива из
веб-интерфейса источник выбирается в форме (по умолчанию `local`), а клиенты без параметра
остаются `origin=unknown`.

## 9. Проверка и диагностика

### 9.1. Ручная проверка каналов

```bash
# форма: один запуск
curl -X POST http://localhost:3001/api/results \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "projectName=cwi" \
  --data-urlencode "path=com.example.SmokeTest#login" \
  --data-urlencode "status=passed" \
  --data-urlencode "startDate=2026-11-02T10:00:00+03:00" \
  --data-urlencode "endDate=2026-11-02T10:00:02+03:00" \
  --data-urlencode "circuit=dso"

# архив
cd target/allure-results && zip -r ../allure-results.zip . && cd ../..
curl -X POST "http://localhost:3001/api/allure/import?environment=dso&projectName=cwi" \
  -H "Content-Type: application/zip" \
  --data-binary @target/allure-results.zip
```

Ожидаемые логи в консоли прогона:

```text
[reporter] POST /api/allure/import: {"imported":0,"enriched":12,...,"launchId":"...","warnings":[]}
```

### 9.2. Типовые ошибки

| Симптом | Причина / решение |
| --- | --- |
| `400 environment query parameter is required` | не передан `environment` — проверьте `reporter.environment` |
| `400 workspaceId or projectName query parameter is required` | пустой `projectName` |
| `400 No *-result.json files found in the archive` | zip собран из родителя `allure-results`; или все файлы уже отправлены/старше якоря |
| `400 Archive is too large` | больше 512 МиБ (`ALLURE_IMPORT_MAX_BYTES`) |
| `429` на импорте | троттлинг 2 запроса/10 с — не шлите архив на каждый тест |
| `warnings: ["...status differs..."]` | статус формы и Allure расходятся: остаётся статус формы, это нормально |
| Запуски не видны в отчёте фазы | `environment` ≠ `Phase.environment`; путь не в каталоге (для канала формы — Harvest) |
| Дубли строк вместо `enriched` | `startDate` формы без offset или сдвиг > 10 с; проверьте формат `+03:00` |
| `imported = 0, duplicates > 0` | архив уже импортировался (идемпотентность по `externalId`) — это ожидаемо |

## 10. Чеклист подключения

- [ ] добавлены зависимости: адаптер Allure своего фреймворка, OkHttp, `junit-platform-launcher` (JUnit 5);
- [ ] скопирован `ReporterClient` (пакет `com.example.reporting`);
- [ ] канал «форма»: слушатель/расширение зарегистрировано (`@ExtendWith`, `@RunWith`, `@Listeners`, `testng.xml` или `META-INF/services`);
- [ ] канал «архив»: uploader зарегистрирован (JUnit 5 — `META-INF/services`; JUnit 4 — в раннере/`@AfterClass`; TestNG — вместе с формой);
- [ ] `reporter.project` / `reporter.environment` совпадают с проектом и окружением фазы;
- [ ] каталог `allure-results` тот же, что у Allure (`-Dallure.results.directory`, если нестандартный);
- [ ] прогон: в консоли есть ответы формы на каждый тест и строка `POST /api/allure/import`;
- [ ] ручная проверка `curl` из п. 9.1 проходит;
- [ ] для проекта только с формой — путь добавлен в каталог (Harvest или `POST /api/tests`);
- [ ] в CI задан `reporter.launch` (номер сборки), чтобы прогон группировался в один `launchId`.
