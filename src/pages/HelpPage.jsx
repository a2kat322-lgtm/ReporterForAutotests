import { useCallback, useState } from 'react'
import { Alert, App, Button, Card, Tabs, Table, Typography } from 'antd'
import { ArrowLeftOutlined, CopyOutlined, DownOutlined, UpOutlined } from '@ant-design/icons'
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
import POSTMAN_PACKAGE from '../../postman/package.json?raw'
import POSTMAN_REPORTER_PACKAGE from '../../postman/newman-reporter-report/package.json?raw'
import POSTMAN_REPORTER from '../../postman/newman-reporter-report/index.js?raw'
import POSTMAN_RUN from '../../postman/run.js?raw'
import POSTMAN_INSTRUMENT_TOOL from '../../postman/instrument.js?raw'
import POSTMAN_UI_SNIPPET from '../../postman/postman-ui-snippet.js?raw'

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

const CHECK_CURL = String.raw`# в CI используйте origin=ci
cd target/allure-results && zip -r ../allure-results.zip . && cd ../..
curl -X POST "http://localhost:3001/api/allure/import?environment=dso&projectName=cwi&origin=local&fileName=allure-results.zip" \
  -H "Content-Type: application/zip" \
  --data-binary @target/allure-results.zip`

const CI_SETTINGS = `<systemPropertyVariables>
    <reporter.api>http://reporter.internal:3001</reporter.api>
    <reporter.environment>dso</reporter.environment>
    <reporter.project>cwi</reporter.project>
    <reporter.launch>\${env.BUILD_NUMBER}</reporter.launch>
    <reporter.origin>ci</reporter.origin>
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

const POSTMAN_BUNDLE = [
  { file: 'postman/package.json', code: POSTMAN_PACKAGE },
  { file: 'postman/newman-reporter-report/package.json', code: POSTMAN_REPORTER_PACKAGE },
  { file: 'postman/newman-reporter-report/index.js', code: POSTMAN_REPORTER },
  { file: 'postman/run.js', code: POSTMAN_RUN },
  { file: 'postman/instrument.js', code: POSTMAN_INSTRUMENT_TOOL },
  { file: 'postman/postman-ui-snippet.js', code: POSTMAN_UI_SNIPPET },
]

const POSTMAN_INSTRUMENT = String.raw`cd postman
node instrument.js ..\collection.json
# результат: ..\collection.reporter.postman_collection.json`

const POSTMAN_INSTALL = String.raw`cd postman
npm install

$env:REPORTER_API = 'http://localhost:3001'
$env:REPORTER_PROJECT = 'cwi'
$env:REPORTER_ENVIRONMENT = 'dso'
$env:REPORTER_LAUNCH = $env:BUILD_NUMBER
$env:REPORTER_ORIGIN = 'ci'

node run.js ..\collection.json
# либо штатным Newman (репортер установлен локально):
# npx newman run ..\collection.json -r cli,report`

const POSTMAN_UI_RUN = String.raw`// Collection → Variables:
// reporterUrl         http://localhost:3001
// reporterProject     cwi
// reporterEnvironment dso
// reporterCollection  Shop API
// reporterOwner       alex.kim
// reporterTags        smoke,postman
// reporterOrigin      local

// В начало post-response скрипта запроса:
const reporterChecks = []

function check(name, fn) {
  pm.test(name, function () {
    try {
      fn()
    } catch (error) {
      reporterChecks.push({ name: name, message: error.message })
      throw error
    }
  })
}

// Проверки — через check(), а не pm.test():
check('status 200', function () {
  pm.response.to.have.status(200)
})

// В конец скрипта вставьте блок «КОНЕЦ» из postman/postman-ui-snippet.js.`

const postmanProperties = [
  { key: 'REPORTER_API', value: 'http://localhost:3001', meaning: 'Адрес API без /api на конце.' },
  { key: 'REPORTER_PROJECT', value: 'default', meaning: 'Имя проекта (workspace), в который пишутся запуски.' },
  { key: 'REPORTER_ENVIRONMENT', value: 'local', meaning: 'Окружение: circuit формы и environment импорта; должно совпадать с окружением фазы.' },
  { key: 'REPORTER_LAUNCH', value: 'случайный UUID на прогон', meaning: 'Идентификатор прогона; в CI передавайте номер сборки, чтобы один прогон имел один launchId.' },
  { key: 'REPORTER_ORIGIN', value: 'ci / local (по env CI)', meaning: 'Источник прогона для «Истории запусков»; в CI задайте ci явно.' },
  { key: 'REPORTER_TAGS', value: '—', meaning: 'Теги через запятую: попадают в строку и в фильтры отчёта.' },
  { key: 'REPORTER_OWNER / REPORTER_EPIC', value: '—', meaning: 'Владелец и эпик (подпись и фильтр на странице отчёта).' },
  { key: 'REPORTER_UPLOAD', value: 'true', meaning: 'false — отправить только форму, без архива allure-results.' },
  { key: 'REPORTER_ARCHIVE_NAME', value: 'postman-results.zip', meaning: 'Имя архива в «Истории запусков».' },
]

const properties = [
  { key: 'reporter.api', value: 'http://localhost:3001', meaning: 'Адрес API без /api на конце.' },
  { key: 'reporter.project', value: 'cwi', meaning: 'Имя проекта (workspace), в который пишутся запуски.' },
  { key: 'reporter.environment', value: 'DSO', meaning: 'Окружение: circuit формы и environment импорта; должно совпадать с окружением фазы.' },
  { key: 'reporter.launch', value: 'случайный UUID на JVM', meaning: 'Идентификатор прогона; в CI передавайте номер сборки, чтобы один прогон имел один launchId.' },
  { key: 'reporter.origin', value: 'ci / local (по env CI)', meaning: 'Источник прогона для «Истории запусков»; в CI задайте ci явно, локально можно не задавать.' },
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

const COLLAPSE_LINE_THRESHOLD = 12

function CodeBlock({ title, code }) {
  const { message } = App.useApp()
  const [expanded, setExpanded] = useState(false)
  const lineCount = code.split('\n').length
  const collapsible = lineCount > COLLAPSE_LINE_THRESHOLD

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
      <div className="code-block-body">
        <pre className={collapsible ? (expanded ? 'code-block-pre-expanded' : 'code-block-pre-collapsed') : undefined}>
          <code>{code}</code>
        </pre>
        {collapsible && !expanded ? <div className="code-block-fade" aria-hidden="true" /> : null}
      </div>
      {collapsible ? (
        <div className="code-block-footer">
          <Text type="secondary" className="code-block-lines">{lineCount} строк</Text>
          <Button
            type="text"
            size="small"
            icon={expanded ? <UpOutlined /> : <DownOutlined />}
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            {expanded ? 'Свернуть' : 'Развернуть'}
          </Button>
        </div>
      ) : null}
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

function PostmanExtra() {
  return (
    <>
      <Title level={5} style={{ marginTop: 24 }}>Установка и прогон</Title>
      <CodeBlock title="powershell — postman/run.js" code={POSTMAN_INSTALL} />

      <Title level={5} style={{ marginTop: 24 }}>Настройки (переменные окружения)</Title>
      <Table
        rowKey="key"
        columns={propertyColumns}
        dataSource={postmanProperties}
        pagination={false}
        size="small"
      />

      <Paragraph type="secondary" className="help-note">
        Готовая коллекция для импорта в Postman UI:{' '}
        <Text code>postman/collection-runner/Reporter-for-autotests.postman_collection.json</Text>.
        Скрипты уже вставлены в каждый запрос; после первого прогона выполните Harvest, иначе
        строки не появятся в отчёте фазы.
      </Paragraph>

      <details className="help-details">
        <summary>Не вставлять код в каждый запрос</summary>
        <Paragraph type="secondary">
          Экспортируйте коллекцию и выполните команду ниже: инструмент добавит блоки в каждый
          запрос и перепишет <Text code>pm.test(...)</Text> на <Text code>check(...)</Text>, чтобы
          падения попадали в отчёт. Либо запускайте через Newman — там код в тестах не нужен
          вообще.
        </Paragraph>
        <CodeBlock title="powershell — автоинструментирование" code={POSTMAN_INSTRUMENT} />
      </details>

      <details className="help-details">
        <summary>Postman UI (Collection Runner) — упрощённый вариант</summary>
        <Paragraph type="secondary">
          В приложение Postman нельзя установить Newman-репортер, поэтому для ручных прогонов есть
          сниппет: он отправляет строку формы после каждого запроса. Путь строится как{' '}
          <Text code>Коллекция#Запрос</Text> (папки из песочницы недоступны), архив не отправляется,
          а проверки нужно писать через <Text code>check()</Text> — обычные{' '}
          <Text code>pm.test()</Text> в отчёт не попадут. Для CI и полного паритета с JUnit/TestNG
          используйте Newman.
        </Paragraph>
        <CodeBlock title="postman-ui-snippet.js — начало post-response скрипта" code={POSTMAN_UI_RUN} />
      </details>

      <details className="help-details">
        <summary>Почему архив allure-results пишет сам клиент</summary>
        <Paragraph type="secondary">
          <Text code>newman-reporter-allure</Text> строит <Text code>fullName</Text> как{' '}
          <Text code>&lt;project&gt;:Коллекция/Папка#Запрос</Text>, а сервер берёт его как{' '}
          <Text code>path</Text>. Путь формы такого префикса не имеет, поэтому архив создал бы вторую
          строку вместо <Text code>enriched</Text>. Клиент пишет минимальный{' '}
          <Text code>*-result.json</Text> с <Text code>labels.testClass</Text> /{' '}
          <Text code>testMethod</Text>, и оба канала используют один и тот же путь.
        </Paragraph>
      </details>

      <details className="help-details">
        <summary>Проверка клиента без API и БД</summary>
        <Paragraph type="secondary">
          Смоук поднимает мок-API, прогоняет три запроса (passed / failed / broken) и проверяет
          строки формы, архив и query-параметры импорта:
        </Paragraph>
        <CodeBlock title="powershell — смоук-тест" code="npm --prefix postman run smoke" />
      </details>
    </>
  )
}

export default function HelpPage({ navigate }) {
  return (
    <>
      <PageHeading
        eyebrow="ДОКУМЕНТАЦИЯ"
        title="Как подключить отчёт"
        description="Отправка результатов из тестового проекта: JUnit 5, JUnit 4, TestNG и Postman. Всё, что нужно, — на этой странице: скопируйте код кнопкой и разложите файлы по указанным путям."
        action={<Button icon={<ArrowLeftOutlined />} onClick={() => navigate({ page: 'phases' })}>К фазам</Button>}
      />

      <Alert
        className="help-alert"
        type="info"
        showIcon
        message="Код для JUnit 5, JUnit 4, TestNG и Postman можно скопировать целиком"
        description="В каждой вкладке — зависимости, все классы/файлы и регистрация. Java: http://localhost:3001, проект cwi, окружение DSO; источник — reporter.origin (в CI ci). Postman: переменные REPORTER_* (по умолчанию проект default, окружение local)."
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
        <Paragraph type="secondary" className="help-note">
          Источник прогона: архивы из CI отправляйте с <Text code>origin=ci</Text>, локальные — с{' '}
          <Text code>origin=local</Text>. В «Истории запусков» источник отображается и фильтруется;
          при загрузке архива через веб-интерфейс его можно выбрать в форме.
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
            {
              key: 'postman',
              label: 'Postman',
              children: (
                <IntegrationTab
                  title="Postman"
                  description="Newman-репортер отправляет строку на каждый запрос и архив allure-results в конце прогона. Для Collection Runner — сниппет с check()."
                  entries={POSTMAN_BUNDLE}
                  extra={<PostmanExtra />}
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
        <Paragraph type="secondary" className="help-note">
          Для Postman те же настройки задаются переменными окружения <Text code>REPORTER_*</Text> —
          таблица во вкладке Postman.
        </Paragraph>
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
          Каждый загруженный архив появляется в «Истории запусков» и открывается как отчёт своего
          прогона. Запуски не видны в отчёте фазы — почти всегда не совпадает{' '}
          <Text code>environment</Text> (должен совпадать с окружением фазы) или путь не в каталоге.
          Остальные ошибки — 429 (чаще 2 импортов в 10 секунд), 400 на zip и лимит 512 МиБ.
        </Paragraph>
      </Card>
    </>
  )
}
