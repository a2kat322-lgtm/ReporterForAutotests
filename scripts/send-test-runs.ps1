#Requires -Version 7
<#
.SYNOPSIS
  Fires a realistic batch of automation run results at POST /api/results, as if
  a Java CI pipeline (JUnit 5 + Surefire) had just finished a regression pass.

.DESCRIPTION
  Contract mapping used here:
    path      — fully qualified Java test class (src/test/java/... → package.Class)
    caseName  — test method name
    suiteName — suite/tag grouping of the class

  Covers:
    - catalog-matched classes with varied statuses
    - repeated runs of the same class (exercises "latest run per path")
    - unregistered classes (show up as "unregistered" in reports; harvest picks them up)
    - every tags format the parser accepts: comma, semicolon, JSON array, real array
    - a minimal payload (only path/status/startDate)
    - negative cases that MUST be rejected with HTTP 400 (validation proof)

  All runs are anchored to "now" (UTC) so they land in a report created today.

.PARAMETER BaseUrl
  API base URL. Default: http://localhost:3001/api

.PARAMETER DryRun
  Print the payloads instead of sending them (no API/DB required).

.EXAMPLE
  pwsh -File scripts/send-test-runs.ps1 -DryRun
  pwsh -File scripts/send-test-runs.ps1
#>
param(
  [string]$BaseUrl = 'http://localhost:3001/api',
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$endpoint = "$BaseUrl/results"
$now = [DateTime]::UtcNow

function At([int]$minutesAgo) { $now.AddMinutes(-$minutesAgo) }
function Iso([DateTime]$dt) { $dt.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ') }

# Builds one form payload. $extra carries the optional contract fields.
function Run([string]$path, [string]$status, [int]$minutesAgo, [int]$durationMs, [hashtable]$extra = @{}) {
  $start = At $minutesAgo
  $end = $start.AddMilliseconds($durationMs)
  $payload = [ordered]@{ path = $path; status = $status; startDate = (Iso $start); endDate = (Iso $end) }
  foreach ($k in $extra.Keys) { $payload[$k] = $extra[$k] }
  return $payload
}

# Deterministic x-www-form-urlencoded encoder (arrays become repeated keys,
# which is exactly how the automation system posts multi-valued tags).
function Encode([System.Collections.IDictionary]$d) {
  ($d.GetEnumerator() | ForEach-Object {
    $k = [uri]::EscapeDataString([string]$_.Key)
    $v = $_.Value
    if ($v -is [array]) { ($v | ForEach-Object { "$k=$([uri]::EscapeDataString([string]$_))" }) -join '&' }
    else { "$k=$([uri]::EscapeDataString([string]$v))" }
  }) -join '&'
}

# --- Positive runs -----------------------------------------------------------
# path = fully qualified Java test class, caseName = @Test method.
$runs = @(
  (Run 'com.acme.shop.checkout.PaymentFlowTest'          'passed'  120 8420  @{ suiteName='Checkout IT'; caseName='paymentSucceedsWithValidCard';     owner='alex.kim';      circuit='green';  tags='checkout,smoke' })
  (Run 'com.acme.shop.auth.LoginValidCredentialsTest'    'passed'  118 3210  @{ suiteName='Auth';        caseName='loginWithValidCredentials';         owner='maria.petrova'; circuit='green';  tags='["auth","smoke"]' })
  (Run 'com.acme.shop.payments.RefundPermissionTest'     'failed'  116 10980 @{ suiteName='Payments';    caseName='viewerCannotRefund';                  owner='alex.kim';      circuit='red';    message='org.opentest4j.AssertionFailedError: expected: <403> but was: <500> at RefundPermissionTest.java:87'; tags='payments,rbac' })
  (Run 'com.acme.shop.search.GlobalSearchTest'           'passed'  114 6040  @{ suiteName='Search';      caseName='searchByEmailFindsRecords';           owner='ivan.sokolov';  circuit='green';  tags=@('search','relevance') })
  (Run 'com.acme.shop.export.CsvExportTest'              'skipped' 112 0     @{ suiteName='Export';      caseName='exportResultsAsCsv';                                        message='Skipped: feature flag export.v2 disabled'; tags='export;feature-flag' })
  # same class re-run later and broken — must win over the earlier passed run in reports
  (Run 'com.acme.shop.auth.LoginValidCredentialsTest'    'broken'  60  5300  @{ suiteName='Auth';        caseName='loginWithValidCredentials';         owner='maria.petrova'; circuit='yellow'; message='org.openqa.selenium.TimeoutException: waiting for #signin-form'; tags='auth,nightly' })
  # same class re-run later and passed — must win over its earlier run
  (Run 'com.acme.shop.checkout.PaymentFlowTest'          'passed'  30  7340  @{ suiteName='Checkout IT'; caseName='paymentSucceedsWithValidCard';     owner='alex.kim';      circuit='green';  tags='checkout,smoke' })
  # unregistered classes — no catalog entry yet, still stored and shown in reports
  (Run 'com.acme.shop.cart.AddItemToCartTest'            'passed'  90  1500  @{ suiteName='Cart';        caseName='addItemIncreasesCount';             owner='dana.lee';      circuit='green';  tags='cart' })
  (Run 'com.acme.shop.cart.RemoveItemFromCartTest'       'failed'  88  2100  @{ suiteName='Cart';        caseName='removeItemDecreasesCount';          owner='dana.lee';      circuit='red';    message='expected: <2> but was: <3> at RemoveItemFromCartTest.java:54'; tags='cart' })
  (Run 'com.acme.shop.profile.AvatarUploadTest'          'broken'  86  4200  @{ suiteName='Profile';     caseName='uploadAvatarImage';                 owner='sam.ortega';    circuit='yellow'; message='java.net.SocketTimeoutException: Upload endpoint returned 502' })
  (Run 'com.acme.legacy.OrphanProbeTest'                 'passed'  45  1200  @{                       caseName='probeResponds' })
  # minimal payload: only the required fields (endDate defaults to startDate)
  (Run 'com.acme.infra.HealthPingTest'                   'passed'  5   120)
)

# --- Negative cases (must return HTTP 400) -----------------------------------
$negative = @(
  @{ name = 'missing path';    payload = [ordered]@{ status='passed'; startDate=(Iso (At 10)); endDate=(Iso (At 9)) } }
  @{ name = 'invalid status';  payload = (Run 'com.acme.shop.checkout.PaymentFlowTest' 'flaky' 10 100) }
  @{ name = 'endDate<start';   payload = [ordered]@{ path='com.acme.X'; status='passed'; startDate=(Iso (At 5)); endDate=(Iso (At 20)) } }
  @{ name = 'unparseable date';payload = [ordered]@{ path='com.acme.X'; status='passed'; startDate='not-a-date' } }
)

function Send([System.Collections.IDictionary]$payload) {
  Invoke-RestMethod -Uri $endpoint -Method Post -Body (Encode $payload) -ContentType 'application/x-www-form-urlencoded'
}

if ($DryRun) {
  Write-Host "DRY RUN — $($runs.Count) positive + $($negative.Count) negative payloads for $endpoint`n" -ForegroundColor Cyan
  $i = 0
  foreach ($r in $runs) { $i++; Write-Host ("[{0,2}] {1}" -f $i, (Encode $r)) }
  Write-Host "`nNegative (expect HTTP 400):" -ForegroundColor Yellow
  foreach ($n in $negative) { Write-Host ("  - {0}: {1}" -f $n.name, (Encode $n.payload)) }
  return
}

$ok = 0; $failed = 0
Write-Host "POST $endpoint — sending $($runs.Count) runs`n" -ForegroundColor Cyan
foreach ($r in $runs) {
  try {
    $resp = Send $r
    $ok++
    Write-Host ("  ok   {0,-52} {1,-7} -> {2}" -f $r.path, $r.status, $resp.id) -ForegroundColor Green
  } catch {
    $failed++
    $code = try { $_.Exception.Response.StatusCode.value__ } catch { '???' }
    Write-Host ("  FAIL {0,-52} {1,-7} -> HTTP {2}: {3}" -f $r.path, $r.status, $code, $_.ErrorDetails.Message) -ForegroundColor Red
  }
}

Write-Host "`nNegative cases (expect HTTP 400):" -ForegroundColor Yellow
$negPass = 0; $negFail = 0
foreach ($n in $negative) {
  try {
    Send $n.payload | Out-Null
    $negFail++
    Write-Host ("  BAD  {0,-18} -> accepted (expected 400)" -f $n.name) -ForegroundColor Red
  } catch {
    $code = try { $_.Exception.Response.StatusCode.value__ } catch { 0 }
    if ($code -eq 400) { $negPass++; Write-Host ("  ok   {0,-18} -> HTTP 400 (rejected as expected)" -f $n.name) -ForegroundColor Green }
    else { $negFail++; Write-Host ("  BAD  {0,-18} -> HTTP {1}" -f $n.name, $code) -ForegroundColor Red }
  }
}

Write-Host ("`nDone. runs ok={0} fail={1} | negative ok={2} fail={3}" -f $ok, $failed, $negPass, $negFail) -ForegroundColor Cyan
if ($failed -or $negFail) { exit 1 }
