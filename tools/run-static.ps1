$ErrorActionPreference = "Stop"

$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $toolsDir
$node = Join-Path $toolsDir "node\node.exe"
$script = Join-Path $toolsDir "serve-static.js"
$out = Join-Path $toolsDir "static-server.log"
$err = Join-Path $toolsDir "static-server.err.log"

if (!(Test-Path $node)) {
  Write-Error "Node.js is not installed yet. Run .\tools\install-node-npm.ps1 first."
}

$psi = [System.Diagnostics.ProcessStartInfo]::new()
$psi.FileName = $node
$psi.Arguments = "`"$script`""
$psi.WorkingDirectory = $projectDir
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true

$process = [System.Diagnostics.Process]::Start($psi)
Start-Sleep -Seconds 2

try {
  $status = (Invoke-WebRequest -Uri "http://127.0.0.1:3000" -UseBasicParsing -TimeoutSec 5).StatusCode
  Write-Host "Static MVP running at http://localhost:3000"
  Write-Host "HTTP status: $status"
  Write-Host "PID: $($process.Id)"
} catch {
  Write-Host "Server process started with PID $($process.Id), but health check failed:"
  Write-Host $_.Exception.Message
}
