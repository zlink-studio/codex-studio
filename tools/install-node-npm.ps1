$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = Split-Path -Parent $toolsDir
$downloadDir = Join-Path $toolsDir "node-download"
$targetDir = Join-Path $toolsDir "node"

Write-Host "Fetching latest Node.js LTS release..."
$index = Invoke-RestMethod "https://nodejs.org/dist/index.json"
$release = $index | Where-Object { $_.lts -ne $false } | Select-Object -First 1
$version = $release.version
$zipName = "node-$version-win-x64.zip"
$url = "https://nodejs.org/dist/$version/$zipName"
$zipPath = Join-Path $toolsDir $zipName

Write-Host "Downloading $url"
Invoke-WebRequest -Uri $url -OutFile $zipPath

if (Test-Path $downloadDir) {
  Remove-Item -LiteralPath $downloadDir -Recurse -Force
}

Write-Host "Extracting Node.js..."
Expand-Archive -LiteralPath $zipPath -DestinationPath $downloadDir -Force
$folder = Get-ChildItem -LiteralPath $downloadDir -Directory | Select-Object -First 1

if (Test-Path $targetDir) {
  Remove-Item -LiteralPath $targetDir -Recurse -Force
}

Move-Item -LiteralPath $folder.FullName -Destination $targetDir

Write-Host "Node installed at $targetDir"
& (Join-Path $targetDir "node.exe") --version
& (Join-Path $targetDir "npm.cmd") --version

Write-Host ""
Write-Host "Installing project dependencies..."
Push-Location $projectDir
try {
  & (Join-Path $targetDir "npm.cmd") install
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "Done. Start the app with:"
Write-Host "  .\tools\node\npm.cmd run dev"
