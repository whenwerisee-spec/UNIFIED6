$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot/..
$stdoutPath = Join-Path $PWD 'health-check.stdout.log'
$stderrPath = Join-Path $PWD 'health-check.stderr.log'
$server = Start-Process -FilePath 'node' -ArgumentList 'dist/server.cjs' -PassThru -NoNewWindow -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
try {
  Start-Sleep -Seconds 5
  $response = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/api/health' -UseBasicParsing
  if ($response.StatusCode -ne 200) { throw 'Health check failed' }
  Write-Host 'Health check passed'
}
finally {
  if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force }
}
