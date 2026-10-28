param(
  [string]$Pasta   = "C:\Projetos\franca-dias-gestorIA\Sicom_Matozinhos",
  [string]$BaseUrl = "http://localhost:3003",
  [string]$Senha   = "FrancaDias@2026"
)
Add-Type -AssemblyName System.Net.Http
$credBase64 = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$Senha"))

$falhos = @(
  "DOC_IP_01813_2021.zip",
  "DOC_IP_01813_2022.zip",
  "DOC_IP_01813_2024.zip",
  "EXTRATOS_01813_02_12_2021.zip",
  "EXTRATOS_01813_02_12_2022.zip",
  "EXTRATOS_01813_02_12_2024.zip",
  "EXTRATOS_01813_02_12_2025.zip"
)

$client = New-Object System.Net.Http.HttpClient
$client.DefaultRequestHeaders.Authorization =
  New-Object System.Net.Http.Headers.AuthenticationHeaderValue("Basic", $credBase64)
$client.Timeout = [TimeSpan]::FromSeconds(300)

foreach ($nome in $falhos) {
  $arq = Get-Item "$Pasta\$nome" -ErrorAction SilentlyContinue
  if (!$arq) { Write-Host "[SKIP] $nome — arquivo não encontrado"; continue }

  $mod   = ($nome -split "_")[0]
  $hint  = switch ($mod) {
    "BALANCETE" { "REMESSA_BALANCETE" }
    "AM"        { "REMESSA_AM" }
    default     { "REMESSA_SICOM" }
  }
  $url = "$BaseUrl/api/importacao?tipoDado=$hint&filename=$([Uri]::EscapeDataString($nome))"

  Write-Host "Enviando $nome ($([math]::Round($arq.Length/1MB,1)) MB)..."
  try {
    $bytes = [System.IO.File]::ReadAllBytes($arq.FullName)
    $content = New-Object System.Net.Http.ByteArrayContent -ArgumentList (,$bytes)
    $content.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/octet-stream")
    $resp = $client.PostAsync($url, $content).Result
    $json = $resp.Content.ReadAsStringAsync().Result | ConvertFrom-Json
    if ($resp.IsSuccessStatusCode -and $json.ok) {
      Write-Host "[OK]  $nome | $($json.registros) reg. | $($json.resumo)" -ForegroundColor Green
    } else {
      Write-Host "[ERR] $nome | $($json.erro)" -ForegroundColor Red
    }
  } catch {
    Write-Host "[EXC] $nome | $($_.Exception.Message)" -ForegroundColor Red
  }
}
Write-Host "Concluído."
