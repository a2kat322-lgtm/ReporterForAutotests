// Сгенерировано из docs/12-client-integration.md скриптом scripts/generate-help-code.mjs.
// Правьте документ и перегенерируйте: node scripts/generate-help-code.mjs

export const REPORTER_CLIENT = String.raw`package com.example.reporting;

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
                        + "&launchId=" + encode(LAUNCH_ID);

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
}`

export const JUNIT5_RESULT_WRITER = String.raw`package com.example.reporting.junit5;

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
}`

export const JUNIT5_UPLOADER = String.raw`package com.example.reporting.junit5;

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
}`

export const JUNIT4_RESULT_WRITER = String.raw`package com.example.reporting.junit4;

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
}`

export const JUNIT4_RUNNER = String.raw`package com.example.reporting.junit4;

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
}`

export const JUNIT4_RULE = String.raw`package com.example.reporting.junit4;

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
}`

export const TESTNG_RESULT_WRITER = String.raw`package com.example.reporting.testng;

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
}`

export const TESTNG_UPLOADER = String.raw`package com.example.reporting.testng;

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
}`

