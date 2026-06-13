param(
  [string]$InPath = ".env.local.enc",
  [string]$OutPath = ".env.local",
  [switch]$Force
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $InPath)) {
  throw "Encrypted env file not found: $InPath"
}
if ((Test-Path -LiteralPath $OutPath) -and -not $Force) {
  throw "$OutPath already exists. Re-run with -Force to overwrite."
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

function Assert-SameBytes([byte[]]$A, [byte[]]$B) {
  if ($A.Length -ne $B.Length) {
    throw "Invalid password or corrupted encrypted env file."
  }
  $diff = 0
  for ($i = 0; $i -lt $A.Length; $i++) {
    $diff = $diff -bor ($A[$i] -bxor $B[$i])
  }
  if ($diff -ne 0) {
    throw "Invalid password or corrupted encrypted env file."
  }
}

$payload = Get-Content -LiteralPath $InPath -Raw | ConvertFrom-Json
if ($payload.version -ne 1) {
  throw "Unsupported encrypted env version: $($payload.version)"
}

$salt = [Convert]::FromBase64String($payload.salt)
$iv = [Convert]::FromBase64String($payload.iv)
$expectedTag = [Convert]::FromBase64String($payload.tag)
$cipherBytes = [Convert]::FromBase64String($payload.ciphertext)
$iterations = [int]$payload.iterations

$passphrase = Read-PlainSecret "Encryption password"
$kdf = New-Object Security.Cryptography.Rfc2898DeriveBytes($passphrase, $salt, $iterations, [Security.Cryptography.HashAlgorithmName]::SHA256)
$keyMaterial = $kdf.GetBytes(64)
$encKey = $keyMaterial[0..31]
$macKey = $keyMaterial[32..63]

$macInput = Join-Bytes $salt $iv $cipherBytes
$hmac = New-Object Security.Cryptography.HMACSHA256 (, $macKey)
$actualTag = $hmac.ComputeHash($macInput)
Assert-SameBytes $expectedTag $actualTag

$aes = [Security.Cryptography.Aes]::Create()
$aes.Mode = [Security.Cryptography.CipherMode]::CBC
$aes.Padding = [Security.Cryptography.PaddingMode]::PKCS7
$aes.Key = $encKey
$aes.IV = $iv
$decryptor = $aes.CreateDecryptor()
$plainBytes = $decryptor.TransformFinalBlock($cipherBytes, 0, $cipherBytes.Length)
$plainText = [Text.Encoding]::UTF8.GetString($plainBytes)

$utf8NoBom = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path (Resolve-Path .).Path $OutPath), $plainText, $utf8NoBom)

Write-Host "Decrypted $InPath -> $OutPath"
