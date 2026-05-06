param(
  [switch]$DryRun,
  [switch]$SkipBridgeSetup,
  [switch]$EnsureOperatorAfter,
  [switch]$SyncDevicesAfter,
  [switch]$QuickVerifyAfter,
  [switch]$VerifyAfter
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

function Invoke-CheckedCommand {
  param(
    [string]$Label,
    [string]$Command,
    [string[]]$Arguments
  )

  Write-Host "== $Label =="
  if ($DryRun) {
    Write-Host "dry-run: $Command $($Arguments -join ' ')"
    return
  }

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE"
  }
}

Push-Location $repoRoot
try {
  Write-Host 'Mobile MCP local setup'

  if (-not $SkipBridgeSetup) {
    Invoke-CheckedCommand `
      -Label 'Install Mobile MCP bridge dependencies' `
      -Command 'npm.cmd' `
      -Arguments @('--prefix', 'services/mobile-mcp-bridge', 'run', 'setup')
  }
  else {
    Write-Host 'skip bridge setup'
  }

  $envArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/set-mobile-mcp-user-env.ps1')
  if ($DryRun) {
    $envArgs += '-DryRun'
  }
  $envArgs += '-SuppressNewTerminalMessage'

  Write-Host '== Configure Windows User environment =='
  if ($DryRun) {
    Write-Host "dry-run: powershell.exe $($envArgs -join ' ')"
  }
  else {
    . (Join-Path $PSScriptRoot 'set-mobile-mcp-user-env.ps1') -SuppressNewTerminalMessage
  }

  if ($EnsureOperatorAfter) {
    $operatorArgs = if ($DryRun) { @('run', 'ensure:mobile-mcp:operator', '--', '--dry-run') } else { @('run', 'ensure:mobile-mcp:operator') }
    Invoke-CheckedCommand `
      -Label 'Ensure UI smoke operator' `
      -Command 'npm.cmd' `
      -Arguments $operatorArgs
  }

  if ($SyncDevicesAfter) {
    $syncArgs = if ($DryRun) { @('run', 'sync:mobile-mcp:devices', '--', '--dry-run') } else { @('run', 'sync:mobile-mcp:devices') }
    Invoke-CheckedCommand `
      -Label 'Sync online ADB devices' `
      -Command 'npm.cmd' `
      -Arguments $syncArgs
  }

  if ($VerifyAfter) {
    Invoke-CheckedCommand `
      -Label 'Verify Mobile MCP runtime' `
      -Command 'npm.cmd' `
      -Arguments @('run', 'verify:mobile-mcp')
  }
  elseif ($QuickVerifyAfter) {
    Invoke-CheckedCommand `
      -Label 'Quick verify Mobile MCP runtime' `
      -Command 'npm.cmd' `
      -Arguments @('run', 'verify:mobile-mcp:quick')
  }

  if (-not $DryRun) {
    Write-Host 'Setup complete. Current setup process has the new env values; other terminals need a restart.'
  }
}
finally {
  Pop-Location
}
