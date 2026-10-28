param(
  [string]$Pasta   = "C:\Projetos\franca-dias-gestorIA\Sicom_Matozinhos",
  [string]$BaseUrl = "http://localhost:3003",
  [string]$Senha   = "FrancaDias@2026"
)
Add-Type -AssemblyName System.Net.Http
$credBase64 = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$Senha"))
$logFile    = "C:\Projetos\franca-dias-gestorIA\importacao-log.txt"
$client = New-Object System.Net.Http.HttpClient
$client.DefaultRequestHeaders.Authorization =
  New-Object System.Net.Http.Headers.AuthenticationHeaderValue("Basic", $credBase64)
$client.Timeout = [TimeSpan]::FromSeconds(120)
$arquivos = Get-ChildItem $Pasta -Filter "*.zip" | Sort-Object Name
$total = $arquivos.Count; $ok = 0; $erros = 0; $i = 0
$header = "=== Importacao SICOM $(Get-Date -Format 'yyyy-MM-dd HH:mm') === Total: $total"
Write-Host $header
$header | Out-File -FilePath $logFile -Encoding utf8
foreach ($arq in $arquivos) {
  $i++
  $pct  = [int]($i * 100 / $total)
  $mod  = ($arq.Name -split "_")[0]
  $hint = switch ($mod) {
    "BALANCETE" { "REMESSA_BALANCETE" }
    "AM"        { "REMESSA_AM" }
    default     { "REMESSA_SICOM" }
  }
  Write-Progress -Activity "Importando SICOM" -Status "$i/$total  $($arq.Name)" -PercentComplete $pct
  try {
    $bytes      = [System.IO.File]::ReadAllBytes($arq.FullName)
    $multipart  = New-Object System.Net.Http.MultipartFormDataContent
    $fc         = New-Object System.Net.Http.ByteArrayContent -ArgumentList (,$bytes)
    $fc.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("application/zip")
    $multipart.Add($fc, "file", $arq.Name)
    $multipart.Add((New-Object System.Net.Http.StringContent($hint)), "tipoDado")
    $resp = $client.PostAsync("$BaseUrl/api/importacao", $multipart).Result
    $json = $resp.Content.ReadAsStringAsync().Result | ConvertFrom-Json
    if ($resp.IsSuccessStatusCode -and $json.ok) {
      $ok++
      $linha = "[OK]  $($arq.Name) | $($json.registros) reg. | $($json.resumo)"
    } else {
      $erros++
      $errMsg = if ($json.erro) { $json.erro } else { $json }
      $linha = "[ERR] $($arq.Name) | $errMsg"
    }
  } catch {
    $erros++
    $linha = "[EXC] $($arq.Name) | $($_.Exception.Message)"
  }
  Write-Host $linha
  $linha | Out-File -FilePath $logFile -Append -Encoding utf8
}
Write-Progress -Activity "Importando SICOM" -Completed
$resumo = "Concluido: $ok OK | $erros erros | $total total"
Write-Host $resumo -ForegroundColor Green
$resumo | Out-File -FilePath $logFile -Append -Encoding utf8
