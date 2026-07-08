param(
  [switch]$DryRun,
  [switch]$SuppressNewTerminalMessage
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$dotEnvPath = Join-Path $repoRoot '.env'
$dotEnvValues = @{}

if (Test-Path -LiteralPath $dotEnvPath) {
  Get-Content -LiteralPath $dotEnvPath | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
      $index = $line.IndexOf('=')
      $dotEnvValues[$line.Substring(0, $index)] = $line.Substring($index + 1)
    }
  }
}

function Get-ConfigDefault {
  param(
    [string]$Name,
    [string]$Fallback = ''
  )

  $processValue = [Environment]::GetEnvironmentVariable($Name, 'Process')
  if (-not [string]::IsNullOrWhiteSpace($processValue)) {
    return $processValue
  }
  if ($dotEnvValues.ContainsKey($Name) -and -not [string]::IsNullOrWhiteSpace($dotEnvValues[$Name])) {
    return $dotEnvValues[$Name]
  }
  $userValue = [Environment]::GetEnvironmentVariable($Name, 'User')
  if (-not [string]::IsNullOrWhiteSpace($userValue)) {
    return $userValue
  }
  return $Fallback
}

function ConvertTo-PlainText {
  param([securestring]$SecureValue)

  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

function Set-UserEnvironmentValue {
  param(
    [string]$Name,
    [string]$Value,
    [switch]$Sensitive
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    Write-Host "skip ${Name}: empty"
    return
  }

  if ($DryRun) {
    $display = if ($Sensitive) { '<hidden>' } else { $Value }
    Write-Host "dry-run set $Name=$display"
    return
  }

  [Environment]::SetEnvironmentVariable($Name, $Value, 'User')
  [Environment]::SetEnvironmentVariable($Name, $Value, 'Process')
  Set-Item -Path "Env:$Name" -Value $Value
  $display = if ($Sensitive) { '<hidden>' } else { $Value }
  Write-Host "set user/process env $Name=$display"
}

function Read-OptionalText {
  param(
    [string]$Prompt,
    [string]$DefaultValue
  )

  if ($DryRun) {
    return $DefaultValue
  }

  $suffix = if ([string]::IsNullOrWhiteSpace($DefaultValue)) { '' } else { " [$DefaultValue]" }
  $value = Read-Host "$Prompt$suffix"
  if ([string]::IsNullOrWhiteSpace($value)) {
    return $DefaultValue
  }
  return $value
}

function Read-OptionalSecret {
  param([string]$Prompt)

  if ($DryRun) {
    return '<hidden>'
  }

  $value = Read-Host $Prompt -AsSecureString
  if ($value.Length -eq 0) {
    return ''
  }
  return ConvertTo-PlainText -SecureValue $value
}

function New-BridgeToken {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
    return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
  }
  finally {
    $rng.Dispose()
  }
}

Write-Host 'Mobile MCP local env setup'
Write-Host 'Scope: Windows User environment. Values are not written to repo files.'

$supabaseUrlDefault = Get-ConfigDefault -Name 'SUPABASE_URL' -Fallback (Get-ConfigDefault -Name 'VITE_SUPABASE_URL')
$bridgeUrlDefault = Get-ConfigDefault -Name 'MOBILE_MCP_BRIDGE_URL' -Fallback (Get-ConfigDefault -Name 'VITE_MOBILE_MCP_BRIDGE_URL' -Fallback 'http://127.0.0.1:4321')
$supabaseUrl = Read-OptionalText -Prompt 'SUPABASE_URL' -DefaultValue $supabaseUrlDefault
$bridgeUrl = Read-OptionalText -Prompt 'MOBILE_MCP_BRIDGE_URL' -DefaultValue $bridgeUrlDefault
$expectedSerials = Read-OptionalText -Prompt 'MOBILE_MCP_EXPECTED_SERIALS' -DefaultValue (Get-ConfigDefault -Name 'MOBILE_MCP_EXPECTED_SERIALS' -Fallback 'QC4DKJUO6PW4FMQW,R58MC1XNTLR')
$operatorEmail = Read-OptionalText -Prompt 'UI_SMOKE_EMAIL' -DefaultValue (Get-ConfigDefault -Name 'UI_SMOKE_EMAIL')
$deviceMatches = Read-OptionalText -Prompt 'UI_SMOKE_DEVICE_MATCHES' -DefaultValue (Get-ConfigDefault -Name 'UI_SMOKE_DEVICE_MATCHES' -Fallback '23106RN0DA,SM-A515F')
$appName = Read-OptionalText -Prompt 'UI_SMOKE_APP_NAME' -DefaultValue (Get-ConfigDefault -Name 'UI_SMOKE_APP_NAME' -Fallback 'com.android.settings')
$bridgeTokenDefault = Get-ConfigDefault -Name 'MOBILE_MCP_BRIDGE_TOKEN' -Fallback (New-BridgeToken)
$bridgeToken = Read-OptionalSecret -Prompt 'MOBILE_MCP_BRIDGE_TOKEN (hidden; Enter keeps/generates secure token)'
if ([string]::IsNullOrWhiteSpace($bridgeToken)) {
  $bridgeToken = $bridgeTokenDefault
}
$serviceRoleKey = Read-OptionalSecret -Prompt 'SUPABASE_SERVICE_ROLE_KEY / sb_secret (hidden; Enter skips)'
$operatorPassword = Read-OptionalSecret -Prompt 'UI_SMOKE_PASSWORD (hidden; Enter skips)'

Set-UserEnvironmentValue -Name 'SUPABASE_URL' -Value $supabaseUrl
Set-UserEnvironmentValue -Name 'SUPABASE_SERVICE_ROLE_KEY' -Value $serviceRoleKey -Sensitive
Set-UserEnvironmentValue -Name 'DEVICE_BACKEND' -Value 'mobile-mcp'
Set-UserEnvironmentValue -Name 'MOBILE_MCP_BRIDGE_URL' -Value $bridgeUrl
Set-UserEnvironmentValue -Name 'MOBILE_MCP_BRIDGE_TOKEN' -Value $bridgeToken -Sensitive
Set-UserEnvironmentValue -Name 'MOBILE_MCP_ALLOW_INSECURE_DEV' -Value 'false'
Set-UserEnvironmentValue -Name 'MOBILE_MCP_EXPECTED_SERIALS' -Value $expectedSerials
Set-UserEnvironmentValue -Name 'DEVICE_COMMAND_TIMEOUT_MS' -Value '30000'
Set-UserEnvironmentValue -Name 'RUN_POLL_INTERVAL_MS' -Value '2000'
Set-UserEnvironmentValue -Name 'VITE_RUN_CONTROL_MODE' -Value 'browser'
Set-UserEnvironmentValue -Name 'UI_SMOKE_EMAIL' -Value $operatorEmail
Set-UserEnvironmentValue -Name 'UI_SMOKE_PASSWORD' -Value $operatorPassword -Sensitive
Set-UserEnvironmentValue -Name 'UI_SMOKE_DEVICE_MATCHES' -Value $deviceMatches
Set-UserEnvironmentValue -Name 'UI_SMOKE_APP_NAME' -Value $appName

if (-not $DryRun -and -not $SuppressNewTerminalMessage) {
  Write-Host 'Open a new terminal before running npm scripts so Windows reloads User env values.'
}
