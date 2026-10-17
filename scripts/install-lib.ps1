# install-lib.ps1 - the state-changing half of install.ps1: swaps current\ and previous\, registers the marketplace, installs, rolls back, removes.
<#
.SYNOPSIS
  Library dot-sourced by install.ps1 at script scope; it is not run on its own.
.DESCRIPTION
  install.ps1 finds this file (bundle root, beside install.ps1, <Dir>\current, <Dir>\previous) and dot-sources it,
  then calls one mode function. Everything below relies on what install.ps1 defines before that:

  Variables (script scope):
    $DryRun, $Plugins                      the switches/parameters of install.ps1
    $Marketplace, $KnownPlugins, $OldName, $RetiredPlugins
    $script:ClaudeExe                      claude.exe path, or $null when claude was not found (dry run)
  Functions:
    Write-Step, Write-Note, Write-Plan     console output
    Invoke-Blocker                         stop, or on a dry run only report
    Invoke-Native                          run a native command, split stdout/stderr
    Get-Prop, Test-SamePath                object and path helpers
    Confirm-Marked, Invoke-GuardedDelete   guarded replace/delete under the install folder
    Get-BundleVersion, Get-LatestTag, Resolve-PluginSelection

  Mode functions called by install.ps1 (the folder is the resolved install folder):
    Invoke-ModeInstall  -Bundle <dir|$null> -Root <dir> -Selection <names> -Label <vX.Y.Z>   steps 5-8
    Invoke-ModeRollback -Root <dir>                                                          steps 5-8
    Invoke-ModeUninstall -Root <dir>
#>
[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSAvoidUsingWriteHost', '', Justification = 'Interactive installer output for a person at a console')]
param()

# A claude command that changes the user's Claude settings: only printed on a dry run.
function Invoke-ClaudeChange([string[]]$Arguments) {
    $shown = 'claude ' + ($Arguments -join ' ')
    if ($DryRun) { Write-Plan "run: $shown"; return }
    Write-Note "run: $shown"
    $r = Invoke-Native $script:ClaudeExe $Arguments
    foreach ($l in @($r.Out) + @($r.Err)) { if ($l) { Write-Note "  $l" } }
    if ($r.Code -ne 0) { throw "'$shown' failed with exit code $($r.Code)" }
}

function Invoke-ClaudeJson([string[]]$Arguments) {
    $r = Invoke-Native $script:ClaudeExe $Arguments
    if ($r.Code -ne 0) { throw "'claude $($Arguments -join ' ')' failed: $($r.Err -join ' ')" }
    return ConvertFrom-Json -InputObject ($r.Out -join "`n")
}

# Copies the bundle in as .incoming, parks previous as .old-previous, then current -> previous and .incoming -> current.
function Install-Bundle([string]$Source, [string]$Root) {
    $current, $previous, $incoming, $oldPrev = @('current', 'previous', '.incoming', '.old-previous') | ForEach-Object { Join-Path $Root $_ }
    if ($Source -and (Test-SamePath $Source $current)) { Write-Note "the bundle is already $current"; return }
    if (-not ((Confirm-Marked $current) -and (Confirm-Marked $previous))) { return }
    if ($DryRun) {
        if (Test-Path -LiteralPath $current) { Write-Plan "keep $current as $previous (replacing the older one)" }
        Write-Plan "copy the new bundle to $current"
        return
    }
    if (-not (Test-Path -LiteralPath $Root)) { New-Item -ItemType Directory -Path $Root -Force | Out-Null }
    Invoke-GuardedDelete $incoming $Root
    Invoke-GuardedDelete $oldPrev $Root -Marked
    $parked = $moved = $false
    try {
        Copy-Item -LiteralPath $Source -Destination $incoming -Recurse
        if (Test-Path -LiteralPath $previous) { Rename-Item -LiteralPath $previous -NewName '.old-previous'; $parked = $true }
        if (Test-Path -LiteralPath $current) { Rename-Item -LiteralPath $current -NewName 'previous'; $moved = $true }
        Rename-Item -LiteralPath $incoming -NewName 'current'
    } catch {
        if ($moved -and -not (Test-Path -LiteralPath $current)) { Rename-Item -LiteralPath $previous -NewName 'current' }
        if ($parked -and -not (Test-Path -LiteralPath $previous)) { Rename-Item -LiteralPath $oldPrev -NewName 'previous' }
        Invoke-GuardedDelete $incoming $Root
        throw [System.Exception]::new("could not swap in the new version, the old one was put back: $($_.Exception.Message)", $_.Exception)
    }
    Invoke-GuardedDelete $oldPrev $Root -Marked
    Write-Note "current=$current previous=$(if ($moved) { $previous } else { 'none' })"
}

function Get-MarketplaceEntry {
    foreach ($m in (Invoke-ClaudeJson @('plugin', 'marketplace', 'list', '--json'))) { if ($m.name -eq $Marketplace) { return $m } }
    return $null
}

# Not registered: add. Registered at another place (README manual install, git): add again without remove, which
# only re-points the source and keeps installed plugins and /config values (remove would drop both). Same place: update.
function Register-Marketplace([string]$Root) {
    $target = Join-Path $Root 'current'
    if (-not $script:ClaudeExe) { Write-Plan "add or update marketplace $Marketplace at $target (claude not found, state unknown)"; return }
    $entry = Get-MarketplaceEntry
    if ($null -eq $entry) {
        Invoke-ClaudeChange @('plugin', 'marketplace', 'add', $target)
    } elseif (Test-SamePath (Get-Prop $entry 'path') $target) {
        Invoke-ClaudeChange @('plugin', 'marketplace', 'update', $Marketplace)
    } else {
        $where = Get-Prop $entry 'path'
        if (-not $where) { $where = "$(Get-Prop $entry 'source') $(Get-Prop $entry 'repo')$(Get-Prop $entry 'url')" }
        Write-Note "$Marketplace is registered at $where; re-pointing $Marketplace to $target"
        Invoke-ClaudeChange @('plugin', 'marketplace', 'add', $target)
    }
}

# Only user-scope plugins are this installer's; project and local installs are left alone.
function Get-InstalledPlugin {
    $map = @{}
    if (-not $script:ClaudeExe) { return $map }
    foreach ($p in (Invoke-ClaudeJson @('plugin', 'list', '--json'))) { if ((Get-Prop $p 'scope') -eq 'user') { $map[[string]$p.id] = $p } }
    return $map
}

function Uninstall-PluginKeepData([string]$Id) { Invoke-ClaudeChange @('plugin', 'uninstall', $Id, '--scope', 'user', '--keep-data') }

function Show-RetiredPlugin($Installed) {
    foreach ($id in @($RetiredPlugins | ForEach-Object { "$_@$Marketplace" })) {
        if ($Installed.ContainsKey($id)) { Write-Note "$id is no longer part of $Marketplace. Remove it with: claude plugin uninstall $id --scope user" }
    }
}

# Installed plugins are cached copies, so an installed one is updated and a missing one installed (-UpdateOnly: skipped).
function Install-Plugin([string[]]$Selection, [switch]$UpdateOnly) {
    if (-not $script:ClaudeExe) { Write-Note 'claude not found: which plugins are installed is unknown' }
    $installed = Get-InstalledPlugin
    $names = @($Selection)
    $oldId = "$OldName@$Marketplace"
    if ($installed.ContainsKey($oldId)) {
        Write-Note "$oldId was renamed to qhud: removing it (its data is kept)"
        Uninstall-PluginKeepData $oldId
        if ($names -notcontains 'qhud') { $names += 'qhud' }
    }
    foreach ($name in $names) {
        $id = "$name@$Marketplace"
        if ($installed.ContainsKey($id)) { Invoke-ClaudeChange @('plugin', 'update', $id, '--scope', 'user') }
        elseif (-not $UpdateOnly -or ($name -eq 'qhud' -and $installed.ContainsKey($oldId))) { Invoke-ClaudeChange @('plugin', 'install', $id, '--scope', 'user') }
    }
    Show-RetiredPlugin $installed
}

function Show-Finish([string]$InstalledVersion) {
    Write-Step '[8/8] next'
    Write-Note 'In a running Claude Code session run /reload-plugins, or open a new session.'
    Write-Host "Installed $InstalledVersion, latest $(Get-LatestTag)"
}

# Steps 5-8 of an install; steps 1-4 (claude check, get, verify, unpack) ran in install.ps1.
function Invoke-ModeInstall([string]$Bundle, [string]$Root, [string[]]$Selection, [string]$Label) {
    Write-Step "[5/8] replace $Root\current"
    Install-Bundle $Bundle $Root
    Write-Step "[6/8] register marketplace $Marketplace"
    Register-Marketplace $Root
    Write-Step "[7/8] install plugins: $($Selection -join ', ')"
    Install-Plugin $Selection
    Show-Finish $Label
}

function Invoke-ModeRollback([string]$Root) {
    $current, $previous, $parked = @('current', 'previous', '.rollback') | ForEach-Object { Join-Path $Root $_ }
    Write-Step "[5/8] swap $current and $previous"
    if ($DryRun -and -not (Test-Path -LiteralPath $previous)) { Write-Host "    warning: nothing to roll back to, $previous does not exist" -ForegroundColor Yellow }
    if (-not (Test-Path -LiteralPath $previous)) { Invoke-Blocker "nothing to roll back to: $previous does not exist. Use -Version vX.Y.Z to install an older release"; return }
    if (-not ((Confirm-Marked $current) -and (Confirm-Marked $previous))) { return }
    $from = Get-BundleVersion $current
    $to = Get-BundleVersion $previous
    if ($DryRun) {
        Write-Plan "make $to current and keep $from as previous"
    } else {
        Invoke-GuardedDelete $parked $Root -Marked
        $hadCurrent = Test-Path -LiteralPath $current
        try {
            if ($hadCurrent) { Rename-Item -LiteralPath $current -NewName '.rollback' }
            Rename-Item -LiteralPath $previous -NewName 'current'
        } catch {
            if ($hadCurrent -and -not (Test-Path -LiteralPath $current) -and (Test-Path -LiteralPath $parked)) { Rename-Item -LiteralPath $parked -NewName 'current' }
            throw [System.Exception]::new("rollback failed, the installed version was left in place: $($_.Exception.Message)", $_.Exception)
        }
        try { if ($hadCurrent) { Rename-Item -LiteralPath $parked -NewName 'previous' }; Write-Note "current=$to previous=$from" }
        catch { Write-Host "    warning: current is now $to, but $from stayed at $parked instead of previous: $($_.Exception.Message)" -ForegroundColor Yellow }
    }
    Write-Step "[6/8] register marketplace $Marketplace"
    Register-Marketplace $Root
    Write-Step '[7/8] bring the installed plugins back to the previous versions'
    Install-Plugin (Resolve-PluginSelection) -UpdateOnly:($Plugins.Count -eq 0)
    Show-Finish $to
}

function Invoke-ModeUninstall([string]$Root) {
    foreach ($child in @('current', 'previous', '.old-previous', '.rollback')) { if (-not (Confirm-Marked (Join-Path $Root $child))) { return } }
    Write-Step 'remove the plugins (their data folders are kept)'
    $installed = Get-InstalledPlugin
    if (-not $script:ClaudeExe) { Write-Plan "run: claude plugin uninstall <name>@$Marketplace --scope user --keep-data for each installed plugin" }
    foreach ($name in @($KnownPlugins) + @($OldName)) {
        if ($installed.ContainsKey("$name@$Marketplace")) { Uninstall-PluginKeepData "$name@$Marketplace" }
    }
    Show-RetiredPlugin $installed
    Write-Step "remove marketplace $Marketplace"
    if (-not $script:ClaudeExe) { Write-Plan "run: claude plugin marketplace remove $Marketplace" }
    elseif ($null -ne (Get-MarketplaceEntry)) { Invoke-ClaudeChange @('plugin', 'marketplace', 'remove', $Marketplace) }
    else { Write-Note "$Marketplace is not registered" }
    Write-Step "delete $Root"
    Invoke-GuardedDelete (Join-Path $Root '.incoming') $Root
    foreach ($child in @('current', 'previous', '.old-previous', '.rollback')) { Invoke-GuardedDelete (Join-Path $Root $child) $Root -Marked }
    if (Test-Path -LiteralPath $Root) {
        if ($DryRun) { Write-Plan "delete $Root if nothing else is left in it" }
        elseif (@(Get-ChildItem -LiteralPath $Root -Force).Count -eq 0) { Remove-Item -LiteralPath $Root -Force }
        else { Write-Note "kept $Root because it holds other files" }
    }
    Write-Note 'Plugin data folders are kept; /config option values are removed.'
    Write-Note 'Done. In a running Claude Code session run /reload-plugins, or open a new session.'
}
