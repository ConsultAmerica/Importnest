$ErrorActionPreference = "Stop"
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$dir = Join-Path $env:TEMP "importnest-chrome-ux"
$shotDir = Join-Path $env:TEMP "importnest-ux-shots"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
New-Item -ItemType Directory -Force -Path $shotDir | Out-Null
Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $chrome } | Out-Null
$proc = Start-Process -FilePath $chrome -ArgumentList @(
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--remote-debugging-port=9333",
  "--remote-allow-origins=*",
  "--user-data-dir=$dir",
  "about:blank"
) -PassThru -WindowStyle Hidden

function Wait-Debug {
  for ($i = 0; $i -lt 40; $i++) {
    try {
      return Invoke-RestMethod "http://127.0.0.1:9333/json/version" -TimeoutSec 2
    } catch {
      Start-Sleep -Milliseconds 250
    }
  }
  throw "Chrome debug port did not open"
}

try {
  Wait-Debug | Out-Null
  $page = $null
  try {
    $page = Invoke-RestMethod -Method Put -Uri "http://127.0.0.1:9333/json/new?http://localhost:3001/search/results?category=home" -TimeoutSec 10
  } catch {
    $page = Invoke-WebRequest -Method Get -Uri "http://127.0.0.1:9333/json/new?http://localhost:3001/search/results?category=home" -UseBasicParsing -TimeoutSec 10 | Select-Object -ExpandProperty Content | ConvertFrom-Json
  }
  $wsUrl = $page.webSocketDebuggerUrl
  if (-not $wsUrl) { throw "No websocket url: $($page | ConvertTo-Json -Compress)" }

  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = [Threading.CancellationToken]::None
  $ws.ConnectAsync([Uri]$wsUrl, $ct).Wait()

  $script:nextId = 0
  function Send-Cdp([string]$method, $params) {
    $script:nextId++
    $id = $script:nextId
    $payload = @{ id = $id; method = $method }
    if ($null -ne $params) { $payload.params = $params }
    $json = $payload | ConvertTo-Json -Compress -Depth 8
    $bytes = [Text.Encoding]::UTF8.GetBytes($json)
    $seg = New-Object System.ArraySegment[byte] -ArgumentList (,$bytes)
    $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
    return $id
  }

  function Recv-Cdp([int]$wantId) {
    $deadline = [DateTime]::UtcNow.AddSeconds(40)
    while ([DateTime]::UtcNow -lt $deadline) {
      $ms = New-Object IO.MemoryStream
      do {
        $buf = New-Object byte[] 262144
        $seg = New-Object System.ArraySegment[byte] -ArgumentList (,$buf)
        $res = $ws.ReceiveAsync($seg, $ct).Result
        if ($res.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) { throw "socket closed" }
        $ms.Write($buf, 0, $res.Count)
      } while (-not $res.EndOfMessage)
      $text = [Text.Encoding]::UTF8.GetString($ms.ToArray())
      if ($text -match ('"id":' + $wantId + '[,}]')) { return $text }
    }
    throw "Timed out waiting for CDP id $wantId"
  }

  function Eval([string]$expression) {
    $id = Send-Cdp "Runtime.evaluate" @{ expression = $expression; awaitPromise = $true; returnByValue = $true }
    return (Recv-Cdp $id)
  }

  Send-Cdp "Page.enable" $null | Out-Null
  $nav = Send-Cdp "Page.navigate" @{ url = "http://localhost:3001/search/results?category=home" }
  Recv-Cdp $nav | Out-Null

  $waitExpr = @'
new Promise((resolve) => {
  const start = Date.now();
  const timer = setInterval(() => {
    const text = document.body ? document.body.innerText : "";
    if (text.includes("Only 1 live result") || text.includes("Application error") || Date.now() - start > 20000) {
      clearInterval(timer);
      resolve("ready");
    }
  }, 200);
})
'@
  Eval $waitExpr | Out-Null

  $probe = @'
(() => {
  const text = document.body.innerText;
  const merchant = (text.match(/\d+ offers? from [^\n]+/) || [null])[0];
  return JSON.stringify({
    sparse: text.includes("Only 1 live result"),
    blankets: text.includes("Blankets"),
    lamps: text.includes("Table Lamps"),
    bins: text.includes("Storage Bins"),
    nl: text.includes("Best home under $250"),
    pills: text.includes("Best air purifiers under $250"),
    track: text.includes("Track"),
    compare: text.includes("Compare"),
    cart: text.includes("Cart"),
    category: text.includes("Category: Home"),
    merchant,
    error: text.includes("Application error")
  });
})()
'@
  $probeRaw = Eval $probe
  if ($probeRaw -match '"value":"(.*)"') {
    $encoded = $Matches[1] -replace '\\"','"' -replace '\\\\','\'
  }
  "PROBE $probeRaw"

  function Save-Shot([string]$name) {
    $id = Send-Cdp "Page.captureScreenshot" @{ format = "png" }
    $raw = Recv-Cdp $id
    if ($raw -notmatch '"data":"([^"]+)"') { throw "No screenshot data for $name" }
    $path = Join-Path $shotDir $name
    [IO.File]::WriteAllBytes($path, [Convert]::FromBase64String($Matches[1]))
    "SHOT $path"
  }

  $metrics = Send-Cdp "Emulation.setDeviceMetricsOverride" @{ width = 1280; height = 1400; deviceScaleFactor = 1; mobile = $false }
  Recv-Cdp $metrics | Out-Null
  Save-Shot "home-desktop.png"

  $scroll = Eval "(() => { const el = document.querySelector('.product-card-actions'); if (el) el.scrollIntoView({block:'center'}); return !!el; })()"
  "SCROLL $scroll"
  Start-Sleep -Milliseconds 300
  Save-Shot "home-actions.png"

  $mobile = Send-Cdp "Emulation.setDeviceMetricsOverride" @{ width = 390; height = 900; deviceScaleFactor = 2; mobile = $true }
  Recv-Cdp $mobile | Out-Null
  Save-Shot "home-mobile.png"

  $nav2 = Send-Cdp "Page.navigate" @{ url = "http://localhost:3001/search/results?category=home&freeShipping=1" }
  Recv-Cdp $nav2 | Out-Null
  Eval $waitExpr | Out-Null
  $labels = Eval "(() => document.querySelector('.mobile-results-bar-labels')?.innerText || 'missing')()"
  "LABELS $labels"
  Save-Shot "home-mobile-filters.png"

  $click = Eval "(() => { const b = document.querySelector('.product-card-tkc-info'); if (!b) return 'missing'; b.click(); return 'clicked'; })()"
  "CLICK $click"
  Start-Sleep -Milliseconds 400
  $dialog = Eval "(() => { const d = document.querySelector('[role=dialog]'); if (!d) return 'no-dialog'; return d.innerText; })()"
  "DIALOG $dialog"
  Save-Shot "home-tkc-dialog.png"
}
finally {
  if ($ws -and $ws.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
    $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "done", [Threading.CancellationToken]::None).Wait(2000) | Out-Null
  }
  if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
}
