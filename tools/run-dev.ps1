$ErrorActionPreference = "Stop"

$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $toolsDir
$npm = Join-Path $toolsDir "node\npm.cmd"

if (!(Test-Path $npm)) {
  Write-Error "npm is not installed yet. Run .\tools\install-node-npm.ps1 first."
}

Push-Location $projectDir
try {
  & $npm run dev
} finally {
  Pop-Location
}
