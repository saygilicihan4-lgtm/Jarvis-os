param(
  [string]$Shop = "varora-v.myshopify.com",
  [string]$ApiVersion = "2026-10",
  [switch]$SkipTest
)

$ErrorActionPreference = "Stop"
$Workspace = if ($env:JARVIS_WORKSPACE) { $env:JARVIS_WORKSPACE } else { Join-Path $env:USERPROFILE "JARVIS-Workspace" }
$SecretDir = Join-Path $Workspace ".jarvis-secrets"
$ConfigFile = Join-Path $SecretDir "shopify.json"
$TokenFile = Join-Path $SecretDir "shopify.token.dpapi"

New-Item -ItemType Directory -Force -Path $SecretDir | Out-Null

$Shop = $Shop.Trim().ToLowerInvariant()
$Shop = $Shop -replace '^https?://',''
$Shop = ($Shop -split '/')[0]
if ($Shop -notmatch '^[a-z0-9][a-z0-9-]*\.myshopify\.com$') {
  throw "Gecersiz Shopify alan adi: $Shop"
}

Write-Host ""
Write-Host "[JARVIS] SHOPIFY SECURE CONNECT" -ForegroundColor Cyan
Write-Host "Magaza: $Shop"
Write-Host "API: $ApiVersion"
Write-Host ""
Write-Host "Admin API access token bu bilgisayarda Windows DPAPI ile sifrelenerek saklanacak." -ForegroundColor DarkGray
$SecureToken = Read-Host "Shopify Admin API access token" -AsSecureString
$Encrypted = ConvertFrom-SecureString $SecureToken
if (-not $Encrypted) { throw "Token alinamadi." }
Set-Content -LiteralPath $TokenFile -Value $Encrypted -Encoding UTF8

$config = [ordered]@{
  schema = 1
  shop = $Shop
  apiVersion = $ApiVersion
  tokenFile = "shopify.token.dpapi"
  connectedAt = (Get-Date).ToUniversalTime().ToString("o")
}
$config | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $ConfigFile -Encoding UTF8

if (-not $SkipTest) {
  $Bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureToken)
  try {
    $Plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Bstr)
    $Headers = @{
      "X-Shopify-Access-Token" = $Plain
      "Content-Type" = "application/json"
    }
    $Body = @{
      query = "query JarvisConnectTest { shop { name myshopifyDomain currencyCode } }"
    } | ConvertTo-Json -Compress
    $Uri = "https://$Shop/admin/api/$ApiVersion/graphql.json"
    $Response = Invoke-RestMethod -Method Post -Uri $Uri -Headers $Headers -Body $Body -TimeoutSec 20
    if ($Response.errors) {
      throw (($Response.errors | ForEach-Object {$_.message}) -join " | ")
    }
    Write-Host ("[JARVIS] Shopify baglantisi dogrulandi: " + $Response.data.shop.name) -ForegroundColor Green
  } catch {
    Remove-Item -LiteralPath $TokenFile -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $ConfigFile -Force -ErrorAction SilentlyContinue
    throw ("Shopify baglanti testi basarisiz. Yerel secret dosyalari kaldirildi. " + $_.Exception.Message)
  } finally {
    if ($Bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr) }
    $Plain = $null
  }
}

Write-Host ""
Write-Host "[JARVIS] SHOPIFY READY" -ForegroundColor Green
Write-Host "  - Token repo'ya yazilmadi"
Write-Host "  - Token Windows kullanicisina bagli DPAPI ile sifreli"
Write-Host "  - JARVIS urun taslagi olusturabilir"
Write-Host "  - Yayinlama ayri ve acik komut gerektirir"
