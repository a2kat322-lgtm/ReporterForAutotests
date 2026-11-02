import { useCallback } from 'react'
import { Alert, App, Button, Card, Tabs, Table, Typography } from 'antd'
import { ArrowLeftOutlined, CopyOutlined } from '@ant-design/icons'
import PageHeading from '../components/PageHeading'
import {
  JUNIT4_RESULT_WRITER,
  JUNIT4_RULE,
  JUNIT4_RUNNER,
  JUNIT5_RESULT_WRITER,
  JUNIT5_UPLOADER,
  REPORTER_CLIENT,
  TESTNG_RESULT_WRITER,
  TESTNG_UPLOADER,
} from './helpCode'

const { Paragraph, Text, Title } = Typography

const JUNIT5_DEPS = String.raw`<dependencies>
    <dependency>
        <groupId>io.qameta.allure</groupId>
        <artifactId>allure-junit5</artifactId>
        <version>2.25.0</version>
        <scope>test</scope>
    </dependency>
    <dependency>
        <groupId>org.junit.platform</groupId>
        <artifactId>junit-platform-launcher</artifactId>
        <version>1.10.2</version>
        <scope>test</scope>
    </dependency>
    <dependency>
        <groupId>com.squareup.okhttp3</groupId>
        <artifactId>okhttp</artifactId>
        <version>4.12.0</version>
        <scope>test</scope>
    </dependency>
</dependencies>`

const JUNIT4_DEPS = String.raw`<dependencies>
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
</dependencies>`

const TESTNG_DEPS = String.raw`<dependencies>
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
</dependencies>`

const JUNIT5_SERVICE = 'com.example.reporting.junit5.AllureResultsUploader'

const TESTNG_SERVICE = String.raw`com.example.reporting.testng.ResultWriter
com.example.reporting.testng.AllureResultsUploader`

const JUNIT5_BASE = String.raw`import com.example.reporting.junit5.ResultWriter;
import org.junit.jupiter.api.extension.ExtendWith;

@ExtendWith(ResultWriter.class)
public abstract class BaseTest {
    // все тесты проекта наследуются от этого класса
}`

const JUNIT4_BASE = String.raw`import com.example.reporting.junit4.ReportingRunner;
import org.junit.runner.RunWith;

@RunWith(ReportingRunner.class)
public abstract class BaseTest {
    // все тесты проекта наследуются от этого класса
}`

const TESTNG_LISTENERS = String.raw`import com.example.reporting.testng.AllureResultsUploader;
import com.example.reporting.testng.ResultWriter;
import org.testng.annotations.Listeners;

@Listeners({ResultWriter.class, AllureResultsUploader.class})
public abstract class BaseTest {
    // все тесты проекта наследуются от этого класса
}`

const JUNIT4_RULE_BASE = String.raw`import com.example.reporting.ReporterClient;
import com.example.reporting.junit4.ReporterRule;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Rule;

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
}`

const TESTNG_XML = String.raw`<listeners>
    <listener class-name="com.example.reporting.testng.ResultWriter"/>
    <listener class-name="com.example.reporting.testng.AllureResultsUploader"/>
</listeners>`

const CHECK_CURL = String.raw`cd target/allure-results && zip -r ../allure-results.zip . && cd ../..
curl -X POST "http://localhost:3001/api/allure/import?environment=dso&projectName=cwi" \
  -H "Content-Type: application/zip" \
  --data-binary @target/allure-results.zip`

const CI_SETTINGS = `<systemPropertyVariables>
    <reporter.api>http://reporter.internal:3001</reporter.api>
    <reporter.environment>dso</reporter.environment>
    <reporter.project>cwi</reporter.project>
    <reporter.launch>\${env.BUILD_NUMBER}</reporter.launch>
</systemPropertyVariables>`

const JUNIT5_BUNDLE = [
  { file: 'pom.xml — добавьте зависимости (scope test)', code: JUNIT5_DEPS },
  { file: 'src/test/java/com/example/reporting/ReporterClient.java', code: REPORTER_CLIENT },
  { file: 'src/test/java/com/example/reporting/junit5/ResultWriter.java', code: JUNIT5_RESULT_WRITER },
  { file: 'src/test/java/com/example/reporting/junit5/AllureResultsUploader.java', code: JUNIT5_UPLOADER },
  { file: 'src/test/resources/META-INF/services/org.junit.platform.launcher.TestExecutionListener', code: JUNIT5_SERVICE },
  { file: 'BaseTest.java — пример регистрации', code: JUNIT5_BASE },
]

const JUNIT4_BUNDLE = [
  { file: 'pom.xml — добавьте зависимости (scope test)', code: JUNIT4_DEPS },
  { file: 'src/test/java/com/example/reporting/ReporterClient.java', code: REPORTER_CLIENT },
  { file: 'src/test/java/com/example/reporting/junit4/ResultWriter.java', code: JUNIT4_RESULT_WRITER },
  { file: 'src/test/java/com/example/reporting/junit4/ReportingRunner.java', code: JUNIT4_RUNNER },
  { file: 'BaseTest.java — пример регистрации', code: JUNIT4_BASE },
]

const TESTNG_BUNDLE = [
  { file: 'pom.xml — добавьте зависимости (scope test)', code: TESTNG_DEPS },
  { file: 'src/test/java/com/example/reporting/ReporterClient.java', code: REPORTER_CLIENT },
  { file: 'src/test/java/com/example/reporting/testng/ResultWriter.java', code: TESTNG_RESULT_WRITER },
  { file: 'src/test/java/com/example/reporting/testng/AllureResultsUploader.java', code: TESTNG_UPLOADER },
  { file: 'src/test/resources/META-INF/services/org.testng.ITestNGListener', code: TESTNG_SERVICE },
]

const properties = [
  { key: 'reporter.api', value: 'http://localhost:3001', meaning: 'Адрес API без /api на конце.' },
  { key: 'reporter.project', value: 'cwi', meaning: 'Имя проекта (workspace), в который пишутся запуски.' },
  { key: 'reporter.environment', value: 'DSO', meaning: 'Окружение: circuit формы и environment импорта; должно совпадать с окружением фазы.' },
  { key: 'reporter.launch', value: 'случайный UUID на JVM', meaning: 'Идентификатор прогона; в CI передавайте номер сборки, чтобы один прогон имел один launchId.' },
  { key: 'allure.results.directory', value: 'target/allure-results', meaning: 'Каталог результатов Allure, если он нестандартный (например, build/allure-results).' },
]

const propertyColumns = [
  { title: 'Свойство', dataIndex: 'key', width: 230, render: (value) => <Text code>{value}</Text> },
  { title: 'По умолчанию', dataIndex: 'value', width: 210, render: (value) => <Text type="secondary">{value}</Text> },
  { title: 'Назначение', dataIndex: 'meaning' },
]

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the legacy copy path below.
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '-1000px'
    document.body.appendChild(area)
    area.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(area)
    return copied
  } catch {
    return false
  }
}

function bundleText(entries) {
  return entries.map((entry) => `===== ${entry.file} =====\n${entry.code.trim()}\n`).join('\n')
}

function CodeBlock({ title, code }) {
  const { message } = App.useApp()
  const handleCopy = useCallback(async () => {
    const copied = await copyText(code)
    if (copied) message.success('Код скопирован')
    else message.error('Не удалось скопировать — выделите код вручную')
  }, [code, message])

  return (
    <div className="code-block">
      <div className="code-block-head">
        <span className="code-block-title">{title}</span>
        <Button type="text" size="small" icon={<CopyOutlined />} onClick={handleCopy} aria-label={`Скопировать ${title}`}>
          Скопировать
        </Button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  )
}

function CopyAllButton({ entries }) {
  const { message } = App.useApp()
  const handleCopy = useCallback(async () => {
    const copied = await copyText(bundleText(entries))
    if (copied) message.success(`Скопировано файлов: ${entries.length}`)
    else message.error('Не удалось скопировать — выделите код вручную')
  }, [entries, message])

  return (
    <Button type="primary" icon={<CopyOutlined />} onClick={handleCopy}>
      {`Скопировать весь код (${entries.length})`}
    </Button>
  )
}

function IntegrationTab({ title, description, entries, extra }) {
  return (
    <>
      <Title level={4}>{title}</Title>
      <Paragraph type="secondary">{description}</Paragraph>
      <div className="help-bundle-actions">
        <Paragraph type="secondary">
          Кнопка копирует все файлы вкладки одним текстом: каждый блок начинается с пути, по
          которому его нужно сохранить.
        </Paragraph>
        <CopyAllButton entries={entries} />
      </div>
      {entries.map((entry) => <CodeBlock key={entry.file} title={entry.file} code={entry.code} />)}
      {extra}
    </>
  )
}

function JUnit5Extra() {
  return (
    <details className="help-details">
      <summary>Можно включить ResultWriter без @ExtendWith — глобально</summary>
      <Paragraph type="secondary">
        В <Text code>src/test/resources/junit-platform.properties</Text> добавьте{' '}
        <Text code>junit.jupiter.extensions.autodetection.enabled=true</Text>, а в{' '}
        <Text code>META-INF/services/org.junit.jupiter.api.extension.Extension</Text> — строку{' '}
        <Text code>com.example.reporting.junit5.ResultWriter</Text>.
      </Paragraph>
    </details>
  )
}

function JUnit4Extra() {
  return (
    <details className="help-details">
      <summary>Если у классов уже есть свой @RunWith (Parameterized, Suite, Mockito)</summary>
      <Paragraph type="secondary">
        Раннер занят другим фреймворком — используйте <Text code>TestRule</Text>: правило оборачивает
        каждый тест, а архив отправляется из <Text code>@AfterClass</Text>.
      </Paragraph>
      <CodeBlock title="src/test/java/com/example/reporting/junit4/ReporterRule.java" code={JUNIT4_RULE} />
      <CodeBlock title="BaseTest.java — регистрация через @Rule и @AfterClass" code={JUNIT4_RULE_BASE} />
    </details>
  )
}

function TestNgExtra() {
  return (
    <details className="help-details">
      <summary>Регистрация через @Listeners или testng.xml</summary>
      <Paragraph type="secondary">
        Вместо файла ServiceLoader можно явно перечислить слушатели в базовом классе или в{' '}
        <Text code>testng.xml</Text>.
      </Paragraph>
      <CodeBlock title="BaseTest.java — регистрация слушателей" code={TESTNG_LISTENERS} />
      <CodeBlock title="testng.xml — блок listeners" code={TESTNG_XML} />
    </details>
  )
}

export default function HelpPage({ navigate }) {
  return (
    <>
      <PageHeading
        eyebrow="ДОКУМЕНТАЦИЯ"
        title="Как подключить отчёт"
        description="Отправка результатов из тестового проекта: JUnit 5, JUnit 4 и TestNG. Всё, что нужно, — на этой странице: скопируйте код кнопкой и разложите файлы по указанным путям."
        action={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate({ page: 'phases' })}>К фазам</Button>}
      />

      <Alert
        className="help-alert"
        type="info"
        showIcon
        message="Код для JUnit 5, JUnit 4 и TestNG можно скопировать целиком"
        description="В каждой вкладке — зависимости, все классы и регистрация. Значения по умолчанию: http://localhost:3001, проект cwi, окружение DSO."
      />

      <Card className="help-card">
        <Title level={4}>Два канала отправки</Title>
        <div className="help-two-channels">
          <div className="help-channel">
            <h4>Статусы: <code>POST /api/results</code></h4>
            <p>
              Форма на каждый тест: путь, статус, владелец, время, теги и сообщение об ошибке.
              Строка запуска появляется в отчёте сразу после теста.
            </p>
          </div>
          <div className="help-channel">
            <h4>Детализация: <code>POST /api/allure/import</code></h4>
            <p>
              ZIP папки allure-results в конце прогона: шаги, скриншоты, параметры и стектрейс.
              Сервер склеивает архив с уже отправленной строкой по пути, окружению и времени старта ±10 с.
            </p>
          </div>
        </div>
        <Paragraph type="secondary" className="help-note">
          Импорт архива сам регистрирует тест в каталоге. Если проект отправляет только статусы,
          путь нужно добавить в каталог кнопкой «Собрать из запусков» на странице фазы — иначе
          запуск не попадёт в отчёт.
        </Paragraph>
      </Card>

      <Card className="help-card">
        <Tabs
          defaultActiveKey="junit5"
          items={[
            {
              key: 'junit5',
              label: 'JUnit 5',
              children: (
                <IntegrationTab
                  title="JUnit 5"
                  description="ResultWriter отправляет статус на каждый тест; AllureResultsUploader — архив после последнего теста плана."
                  entries={JUNIT5_BUNDLE}
                  extra={<JUnit5Extra />}
                />
              ),
            },
            {
              key: 'junit4',
              label: 'JUnit 4',
              children: (
                <IntegrationTab
                  title="JUnit 4"
                  description="ReportingRunner регистрирует RunListener и отправляет архив в testRunFinished. Один класс-раннер — и оба канала работают."
                  entries={JUNIT4_BUNDLE}
                  extra={<JUnit4Extra />}
                />
              ),
            },
            {
              key: 'testng',
              label: 'TestNG',
              children: (
                <IntegrationTab
                  title="TestNG"
                  description="ResultWriter (ITestListener) отправляет статусы, AllureResultsUploader (ISuiteListener) — архив в конце suite. Слушатели подхватываются автоматически."
                  entries={TESTNG_BUNDLE}
                  extra={<TestNgExtra />}
                />
              ),
            },
          ]}
        />
      </Card>

      <Card className="help-card" title="Настройки (system properties)">
        <Table rowKey="key" columns={propertyColumns} dataSource={properties} pagination={false} size="small" />
        <Paragraph type="secondary" className="help-note">
          В IDE задайте их в VM options конфигурации запуска, в CI — через{' '}
          <Text code>systemPropertyVariables</Text> Surefire или <Text code>systemProperty</Text> Gradle:
        </Paragraph>
        <CodeBlock title="pom.xml — surefire systemPropertyVariables" code={CI_SETTINGS} />
      </Card>

      <Card className="help-card" title="Проверка подключения">
        <Paragraph>
          После прогона в консоли появится строка{' '}
          <Text code>[reporter] POST /api/allure/import: {'{'}...{'}'}</Text> с полями{' '}
          <Text code>imported</Text>, <Text code>enriched</Text> и <Text code>warnings</Text>.
          Архив можно проверить и вручную:
        </Paragraph>
        <CodeBlock title="bash — проверка архива вручную" code={CHECK_CURL} />
        <Paragraph type="secondary" className="help-note">
          Запуски не видны в отчёте фазы — почти всегда не совпадает{' '}
          <Text code>environment</Text> (должен совпадать с окружением фазы) или путь не в каталоге.
          Остальные ошибки — 429 (чаще 2 импортов в 10 секунд), 400 на zip и лимит 512 МиБ.
        </Paragraph>
      </Card>
    </>
  )
}
