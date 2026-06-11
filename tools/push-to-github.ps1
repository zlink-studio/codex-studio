$ErrorActionPreference = "Stop"

$repo = "D:\Codex\2026-06-09\ai-next-js-typescript-tailwind-css"
$git = "D:\Tools\PortableGit\cmd\git.exe"

if (-not (Test-Path -LiteralPath $git)) {
  throw "Portable Git not found at $git"
}

Set-Location -LiteralPath $repo
& $git status --short
& $git push -u origin main
