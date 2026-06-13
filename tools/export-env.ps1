param(
  [string]$EnvPath = ".env.local",
  [string]$OutPath = ".env.local.enc"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $EnvPath)) {
  throw "Env file not found: $EnvPath"
}

function Read-PlainSecret([string]$Prompt) {
  $secure = Read-Host $Prompt -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function Join-Bytes([byte[]]$A, [byte[]]$B, [byte[]]$C) {
  $joined = New-Object byte[] ($A.Length + $B.Length + $C.Length)
  [Array]::Copy($A, 0, $joined, 0, $A.Length)
  [Array]::Copy($B, 0, $joined, $A.Length, $B.Length)
  [Array]::Copy($C, 0, $joined, $A.Length + $B.Length, $C.Length)
  return $joined
}

$passphrase = Read-PlainSecret "Create encryption password"
$confirm = Read-PlainSecret "Confirm encryption password"

if ($passphrase.Length -lt 12) {
  throw "Use at least 12 characters."
}
if ($passphrase -ne $confirm) {
  throw "Passwords do not match."
}

$salt = New-Object byte[] 16
$iv = New-Object byte[] 16
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($salt)
$rng.GetBytes($iv)

$kdf = New-Object Security.Cryptography.Rfc2898DeriveBytes($passphrase, $salt, 250000, [Security.Cryptography.HashAlgorithmName]::SHA256)
$keyMaterial = $kdf.GetBytes(64)
$encKey = $keyMaterial[0..31]
$macKey = $keyMaterial[32..63]

$plainText = [IO.File]::ReadAllText((Resolve-Path -LiteralPath $EnvPath).Path)
$plainBytes = [Text.Encoding]::UTF8.GetBytes($plainText)

$aes = [Security.Cryptography.Aes]::Create()
$aes.Mode = [Security.Cryptography.CipherMode]::CBC
$aes.Padding = [Security.Cryptography.PaddingMode]::PKCS7
$aes.Key = $encKey
$aes.IV = $iv
$encryptor = $aes.CreateEncryptor()
$cipherBytes = $encryptor.TransformFinalBlock($plainBytes, 0, $plainBytes.Length)

$macInput = Join-Bytes $salt $iv $cipherBytes
$hmac = New-Object Security.Cryptography.HMACSHA256 (, $macKey)
$tag = $hmac.ComputeHash($macInput)

$payload = [ordered]@{
  version = 1
  kdf = "PBKDF2-SHA256"
  iterations = 250000
  cipher = "AES-256-CBC-HMAC-SHA256"
  salt = [Convert]::ToBase64String($salt)
  iv = [Convert]::ToBase64String($iv)
  tag = [Convert]::ToBase64String($tag)
  ciphertext = [Convert]::ToBase64String($cipherBytes)
}

$json = $payload | ConvertTo-Json
$utf8NoBom = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path (Resolve-Path .).Path $OutPath), $json, $utf8NoBom)

Write-Host "Encrypted $EnvPath -> $OutPath"
Write-Host "Commit $OutPath, not $EnvPath."
