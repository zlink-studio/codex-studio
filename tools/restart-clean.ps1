param(
  [ValidateSet("dev", "prod")]
  [string]$Mode = "prod",
  [int]$Port = 3200
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$nodePath = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$nextCli = Join-Path $root "node_modules\next\dist\bin\next"

Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object {
    try {
      Stop-Process -Id $_ -Force -ErrorAction Stop
    } catch {
      Write-Host "Skip stopping PID $_ : $($_.Exception.Message)"
    }
  }

if (Test-Path ".next") {
  Remove-Item ".next" -Recurse -Force
}

if ($Mode -eq "prod") {
  & $nodePath $nextCli build
  Start-Process -FilePath $nodePath `
    -ArgumentList @($nextCli, "start", "-p", "$Port") `
    -WorkingDirectory $root `
    -RedirectStandardOutput (Join-Path $root "prodserver.log") `
    -RedirectStandardError (Join-Path $root "prodserver.err.log") `
    -WindowStyle Hidden
} else {
  Start-Process -FilePath $nodePath `
    -ArgumentList @($nextCli, "dev", "-p", "$Port") `
    -WorkingDirectory $root `
    -RedirectStandardOutput (Join-Path $root "devserver.log") `
    -RedirectStandardError (Join-Path $root "devserver.err.log") `
    -WindowStyle Hidden
}

Write-Host "Restarted $Mode server on http://localhost:$Port"
