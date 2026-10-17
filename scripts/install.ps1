# install.ps1 - installs, updates, rolls back or removes the my-mods Claude Code plugins on Windows (PowerShell 5.1 and 7).
<#
.SYNOPSIS
  Install or update the my-mods plugins (qhud, change-tutor, pinboard, agent-flow) for Claude Code.
.DESCRIPTION
  Steps: 1 check Claude Code, 2 get the release, 3 verify SHA256SUMS.txt, 4 unpack, 5 swap current\ (the old one is
  kept as previous\), 6 register the my-mods marketplace, 7 install the plugins, 8 print what to do next.
  Run from an unpacked release (.claude-plugin\marketplace.json beside it) it installs that bundle without
  downloading. Otherwise it downloads with gh (logged in), then $env:GITHUB_TOKEN, or uses -Zip.
  Plugin data and /config values survive updates; -Uninstall keeps the data folders but removes /config values.
  If the execution policy blocks this script: powershell -ExecutionPolicy Bypass -File .\install.ps1
.EXAMPLE
  .\install.ps1 -Version v1.4.0 -Plugins qhud,pinboard
.EXAMPLE
  .\install.ps1 -Zip .\my-mods-v1.4.0.zip
#>
[Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSAvoidUsingWriteHost', '', Justification = 'Interactive installer output for a person at a console')]
[CmdletBinding()]
param(
    [string]$Version = '',
    [string[]]$Plugins = @(),
    [string]$Zip = '',
    [string]$Sums = '',
    [string]$Dir = '',
    [switch]$Rollback,
    [switch]$Uninstall,
    [switch]$DryRun
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Repo = 'gloriouslegacy/claude-mods'
$Marketplace = 'my-mods'
$KnownPlugins = @('qhud', 'change-tutor', 'pinboard', 'agent-flow')
$OldName = 'tcw'
$RetiredPlugins = @('blast-radius', 'replay-theater')
$MinClaude = [version]'2.1.287'
$Agent = 'my-mods-installer'
$SumsName = 'SHA256SUMS.txt'

$script:ClaudeExe = $null
$script:WorkDir = $null
$script:LatestTag = $null

function Write-Step([string]$Text) { Write-Host "==> $Text" }
function Write-Note([string]$Text) { Write-Host "    $Text" }
function Write-Plan([string]$Text) { Write-Host "    [dry-run] would $Text" }

# A real run stops on a failed precondition; a dry run reports it and keeps describing the plan.
function Invoke-Blocker([string]$Reason) {
    if ($DryRun) { Write-Plan "stop here: $Reason"; return }
    throw $Reason
}

function Get-Prop($Object, [string]$Name) {
    if ($null -ne $Object -and $Object.PSObject.Properties[$Name]) { return $Object.PSObject.Properties[$Name].Value } else { return $null }
}

function Resolve-UserPath([string]$Path) { return $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Path) }

function Test-SamePath([string]$A, [string]$B) {
    if ([string]::IsNullOrWhiteSpace($A) -or [string]::IsNullOrWhiteSpace($B)) { return $false }
    return [string]::Equals([IO.Path]::GetFullPath($A).TrimEnd('\', '/'), [IO.Path]::GetFullPath($B).TrimEnd('\', '/'), [StringComparison]::OrdinalIgnoreCase)
}

function Get-AppExe([string]$Name) {
    $cmd = Get-Command $Name -CommandType Application -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension -in '.exe', '.cmd', '.bat' } | Select-Object -First 1
    if ($cmd) { return $cmd.Path } else { return $null }
}

function Get-WorkDir {
    if (-not $script:WorkDir) {
        $script:WorkDir = Join-Path ([IO.Path]::GetTempPath()) ('claude-mods-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $script:WorkDir -Force | Out-Null
    }
    return $script:WorkDir
}

# Runs a native command and splits stdout from stderr; stderr must not become a terminating error on 5.1.
function Invoke-Native([string]$Exe, [string[]]$Arguments) {
    $ErrorActionPreference = 'Continue'
    $out = New-Object System.Collections.Generic.List[string]
    $err = New-Object System.Collections.Generic.List[string]
    $lines = & $Exe @Arguments 2>&1
    $code = $LASTEXITCODE
    foreach ($l in $lines) {
        if ($l -is [System.Management.Automation.ErrorRecord]) { $err.Add($l.ToString()) } else { $out.Add([string]$l) }
    }
    return [pscustomobject]@{ Code = $code; Out = $out.ToArray(); Err = $err.ToArray() }
}

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

# current\ and previous\ are replaced or deleted only when they hold a bundle, so a wrong -Dir cannot cost user files.
function Confirm-Marked([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path) -or (Test-Path -LiteralPath (Join-Path $Path '.claude-plugin\marketplace.json'))) { return $true }
    Invoke-Blocker "refusing to replace or delete $Path : it has no .claude-plugin\marketplace.json (check -Dir)"
    return $false
}

# Deletes one direct child of $Root, never $Root itself and never anything elsewhere; a link loses only the link.
function Invoke-GuardedDelete([string]$Path, [string]$Root, [switch]$Marked) {
    if ([string]::IsNullOrWhiteSpace($Path) -or [string]::IsNullOrWhiteSpace($Root)) { throw 'refusing to delete: empty path' }
    $rootFull = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
    if ([IO.Path]::GetPathRoot($rootFull + '\').TrimEnd('\', '/') -eq $rootFull) { throw "refusing to delete under a drive root: $rootFull" }
    $full = [IO.Path]::GetFullPath($Path).TrimEnd('\', '/')
    if (-not [string]::Equals([IO.Path]::GetDirectoryName($full), $rootFull, [StringComparison]::OrdinalIgnoreCase)) {
        throw "refusing to delete outside $rootFull : $full"
    }
    $item = Get-Item -LiteralPath $full -Force -ErrorAction SilentlyContinue
    if ($null -eq $item -or ($Marked -and -not (Confirm-Marked $full))) { return }
    if ($DryRun) { Write-Plan "delete $full"; return }
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { $item.Delete() } else { Remove-Item -LiteralPath $full -Recurse -Force }
}

function Get-BundleVersion([string]$BundleDir) {
    $f = Join-Path $BundleDir 'VERSION'
    if (-not (Test-Path -LiteralPath $f)) { return 'unknown' }
    return 'v' + (Get-Content -LiteralPath $f -Raw).Trim().TrimStart('v')
}

function Assert-Bundle([string]$BundleDir) {
    $f = Join-Path $BundleDir '.claude-plugin\marketplace.json'
    if (-not (Test-Path -LiteralPath $f)) { throw "not a $Marketplace bundle (missing $f)" }
    $m = ConvertFrom-Json -InputObject (Get-Content -LiteralPath $f -Raw -Encoding UTF8)
    if ((Get-Prop $m 'name') -ne $Marketplace) { throw "$f is not the $Marketplace marketplace" }
    Write-Note "bundle ok: $BundleDir ($(Get-BundleVersion $BundleDir))"
}

function Resolve-PluginSelection {
    $list = @()
    foreach ($p in $Plugins) { foreach ($n in ($p -split ',')) { if ($n.Trim()) { $list += $n.Trim() } } }
    if ($list.Count -eq 0) { $list = $KnownPlugins }
    foreach ($n in $list) { if ($KnownPlugins -notcontains $n) { throw "unknown plugin '$n'. Choose from: $($KnownPlugins -join ', ')" } }
    return $list
}

# The token goes only into request headers; it is never printed.
function Get-ApiHeader([string]$Accept) { return @{ Authorization = 'Bearer ' + $env:GITHUB_TOKEN; Accept = $Accept; 'X-GitHub-Api-Version' = '2022-11-28' } }

# Assets redirect to storage that rejects the token: resolve the redirect with it, then fetch without it.
function Save-Asset([string]$Uri, [string]$OutFile) {
    $req = [Net.HttpWebRequest]::Create($Uri)
    $req.AllowAutoRedirect = $false
    $req.UserAgent = $Agent
    $req.Accept = 'application/octet-stream'
    $req.Headers.Add('Authorization', 'Bearer ' + $env:GITHUB_TOKEN)
    $res = $req.GetResponse()
    try { $code = [int]$res.StatusCode; $loc = $res.Headers['Location'] } finally { $res.Close() }
    if ($code -lt 300 -or $code -ge 400 -or -not $loc) {
        Invoke-WebRequest -Uri $Uri -Headers (Get-ApiHeader 'application/octet-stream') -UserAgent $Agent -OutFile $OutFile -UseBasicParsing
    } else { Invoke-WebRequest -Uri $loc -UserAgent $Agent -OutFile $OutFile -UseBasicParsing }
}

function Test-GhReady([string]$GhExe) { return ($GhExe -and (Invoke-Native $GhExe @('auth', 'status', '--hostname', 'github.com')).Code -eq 0) }

function Get-GhTag([string]$GhExe) {
    $r = Invoke-Native $GhExe @('release', 'view', '--repo', $Repo, '--json', 'tagName', '--jq', '.tagName')
    if ($r.Code -ne 0) { throw "gh could not find the latest release of ${Repo}: $($r.Err -join ' ')" }
    return ($r.Out -join '').Trim()
}

function Get-TokenRelease([string]$Tag) {
    $uri = "https://api.github.com/repos/$Repo/releases/latest"
    if ($Tag) { $uri = "https://api.github.com/repos/$Repo/releases/tags/$Tag" }
    return Invoke-RestMethod -Uri $uri -Headers (Get-ApiHeader 'application/vnd.github+json') -UserAgent $Agent -UseBasicParsing
}

function Get-LatestTag {
    if ($script:LatestTag) { return $script:LatestTag }
    if ($DryRun) { return 'unknown (dry run, no network)' }
    try {
        $gh = Get-AppExe 'gh'
        if (Test-GhReady $gh) { return Get-GhTag $gh }
        if ($env:GITHUB_TOKEN) { return [string](Get-TokenRelease '').tag_name }
        return 'unknown (no gh login or GITHUB_TOKEN)'
    } catch {
        Write-Verbose "latest lookup failed reason=$($_.Exception.Message)"
        return 'unknown (lookup failed)'
    }
}

# Download order (RELEASE.md 4.5): gh when logged in, then GITHUB_TOKEN; otherwise ask for -Zip.
function Save-Release([string]$OutDir) {
    $tag = $Version
    $gh = Get-AppExe 'gh'
    if ($gh -and -not (Test-GhReady $gh)) { Write-Note 'gh is installed but not logged in (gh auth login); trying GITHUB_TOKEN'; $gh = $null }
    if ($gh) {
        if (-not $tag) { $tag = Get-GhTag $gh }
        $r = Invoke-Native $gh @('release', 'download', $tag, '--repo', $Repo, '--pattern', "my-mods-$tag.zip", '--pattern', $SumsName, '--dir', $OutDir, '--clobber')
        if ($r.Code -ne 0) { throw "gh release download $tag failed: $($r.Err -join ' ')" }
        $method = 'gh'
    } elseif ($env:GITHUB_TOKEN) {
        $rel = Get-TokenRelease $tag
        $tag = [string]$rel.tag_name
        foreach ($name in @("my-mods-$tag.zip", $SumsName)) {
            $asset = @($rel.assets | Where-Object { $_.name -eq $name }) | Select-Object -First 1
            if ($null -eq $asset) { throw "release $tag has no asset $name" }
            Save-Asset $asset.url (Join-Path $OutDir $name)
        }
        $method = 'GITHUB_TOKEN'
    } else {
        throw ("cannot download from the private repository $Repo. Run 'gh auth login'; or set `$env:GITHUB_TOKEN to a " +
            "fine-grained token (this repository, Contents: Read-only); or download the zip and $SumsName from the Releases page and use -Zip <file>")
    }
    $zipPath = Join-Path $OutDir "my-mods-$tag.zip"
    $sumsPath = Join-Path $OutDir $SumsName
    foreach ($f in @($zipPath, $sumsPath)) {
        if (-not (Test-Path -LiteralPath $f)) { throw "the download did not produce $f" }
        if (Get-Command Unblock-File -ErrorAction SilentlyContinue) { Unblock-File -LiteralPath $f }
    }
    if (-not $Version) { $script:LatestTag = $tag }
    Write-Note "downloaded tag=$tag via=$method"
    return [pscustomobject]@{ Zip = $zipPath; Sums = $sumsPath }
}

function Assert-Checksum([string]$ZipPath, [string]$SumsPath) {
    $name = Split-Path -Leaf $ZipPath
    $expected = $null
    foreach ($line in Get-Content -LiteralPath $SumsPath) {
        $m = [regex]::Match($line, '^\s*([0-9a-fA-F]{64})\s+\*?(.+?)\s*$')
        if ($m.Success -and $m.Groups[2].Value -eq $name) { $expected = $m.Groups[1].Value.ToLowerInvariant() }
    }
    if (-not $expected) { throw "$SumsPath has no line for $name" }
    $actual = (Get-FileHash -LiteralPath $ZipPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) { throw "checksum mismatch for $name (expected $expected, got $actual): not installing" }
    Write-Note "sha256=ok file=$name"
}

function Expand-Bundle([string]$ZipPath, [string]$WorkDir) {
    $bundle = Join-Path (Join-Path $WorkDir 'unzipped') $Marketplace
    Expand-Archive -LiteralPath $ZipPath -DestinationPath (Split-Path -Parent $bundle) -Force
    Assert-Bundle $bundle
    return $bundle
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

function Assert-Claude {
    Write-Step '[1/8] check Claude Code'
    $exe = Get-AppExe 'claude'
    if (-not $exe) { Invoke-Blocker "claude is not on PATH. Install Claude Code $MinClaude or newer first"; return }
    $r = Invoke-Native $exe @('--version')
    $m = [regex]::Match(($r.Out -join ' '), '(\d+)\.(\d+)\.(\d+)')
    if ($r.Code -ne 0 -or -not $m.Success) { Invoke-Blocker "could not read the version from 'claude --version'"; return }
    $v = [version]$m.Value
    if ($v -lt $MinClaude) { Invoke-Blocker "Claude Code $v is older than $MinClaude. Update it (claude update) and run this again"; return }
    Write-Note "claude=$v path=$exe"
    $script:ClaudeExe = $exe
}

function Show-Finish([string]$InstalledVersion) {
    Write-Step '[8/8] next'
    Write-Note 'In a running Claude Code session run /reload-plugins, or open a new session.'
    Write-Host "Installed $InstalledVersion, latest $(Get-LatestTag)"
}

function Invoke-Install([string]$Root) {
    Assert-Claude
    $selection = Resolve-PluginSelection
    Write-Step '[2/8] get the release'
    $beside = Join-Path $PSScriptRoot '.claude-plugin\marketplace.json'
    $bundle = $zipPath = $sumsPath = $null
    if ($Zip) {
        $zipPath = Resolve-UserPath $Zip
        if (-not (Test-Path -LiteralPath $zipPath)) { throw "zip not found: $zipPath" }
        $sumsPath = Join-Path (Split-Path -Parent $zipPath) $SumsName
        if ($Sums) { $sumsPath = Resolve-UserPath $Sums }
        Write-Note "zip=$zipPath"
    } elseif (-not $Version -and (Test-Path -LiteralPath $beside)) {
        $bundle = $PSScriptRoot
        Write-Note "using the bundle beside this script: $bundle (no download, no checksum step)"
    } elseif ($DryRun) {
        $tag = if ($Version) { $Version } else { 'the latest release' }
        $hasGh = if (Get-AppExe 'gh') { 'found' } else { 'not found' }
        $hasToken = if ($env:GITHUB_TOKEN) { 'set' } else { 'not set' }
        Write-Plan "download $tag of $Repo with gh if logged in (gh $hasGh), else GITHUB_TOKEN ($hasToken), else stop and ask for -Zip"
    } else {
        $rel = Save-Release (Get-WorkDir)
        $zipPath = $rel.Zip
        $sumsPath = $rel.Sums
    }

    Write-Step "[3/8] verify $SumsName"
    if ($bundle) { Write-Note 'skipped (installing an unpacked bundle)' }
    elseif (-not $zipPath) { Write-Plan "compare the zip's SHA-256 with $SumsName and stop on a mismatch" }
    elseif (-not (Test-Path -LiteralPath $sumsPath)) { Invoke-Blocker "$sumsPath not found: put $SumsName beside the zip or pass -Sums <file>. Nothing is installed without a checksum" }
    else { Assert-Checksum $zipPath $sumsPath }

    Write-Step '[4/8] unpack'
    if ($bundle) { Assert-Bundle $bundle }
    elseif ($DryRun) { Write-Plan "unpack the zip to a temp folder and check $Marketplace/.claude-plugin/marketplace.json" }
    else { $bundle = Expand-Bundle $zipPath (Get-WorkDir) }
    $label = if ($bundle) { Get-BundleVersion $bundle } else { 'unknown' }

    Write-Step "[5/8] replace $Root\current"
    Install-Bundle $bundle $Root
    Write-Step "[6/8] register marketplace $Marketplace"
    Register-Marketplace $Root
    Write-Step "[7/8] install plugins: $($selection -join ', ')"
    Install-Plugin $selection
    Show-Finish $label
}

function Invoke-Rollback([string]$Root) {
    Assert-Claude
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

function Invoke-Uninstall([string]$Root) {
    Assert-Claude
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

$exitCode = 0
$savedEncoding = $null
try {
    try { $savedEncoding = [Console]::OutputEncoding; [Console]::OutputEncoding = [Text.Encoding]::UTF8 }
    catch { $savedEncoding = $null; Write-Verbose "console encoding left unchanged reason=$($_.Exception.Message)" }
    if ($PSVersionTable.PSVersion.Major -lt 6) { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 }
    if ($Rollback -and $Uninstall) { throw '-Rollback and -Uninstall cannot be used together' }
    if (($Rollback -or $Uninstall) -and ($Zip -or $Version -or $Sums)) { throw '-Zip, -Version and -Sums only apply to an install' }
    if ($Uninstall -and $Plugins.Count -gt 0) { throw '-Uninstall removes every my-mods plugin; to remove one use: claude plugin uninstall <name>@my-mods' }
    if ($Sums -and -not $Zip) { throw '-Sums needs -Zip' }
    if ($Version) {
        if ($Version -cnotmatch '^v?[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?\z') { throw "-Version must look like v1.4.0, got '$Version'" }
        if (-not $Version.StartsWith('v')) { $Version = 'v' + $Version }
    }
    if (-not $Dir) {
        if (-not $env:LOCALAPPDATA) { throw 'LOCALAPPDATA is not set; pass -Dir <folder>' }
        $Dir = Join-Path $env:LOCALAPPDATA 'claude-mods'
    }
    $root = [IO.Path]::GetFullPath((Resolve-UserPath $Dir)).TrimEnd('\', '/')
    if ((Test-SamePath $root $HOME) -or (Test-SamePath $root $env:USERPROFILE) -or [IO.Path]::GetPathRoot($root + '\').TrimEnd('\', '/') -eq $root) {
        throw "refusing -Dir $root : use a folder of its own, not a drive root or the home folder" }
    $mode = if ($Rollback) { 'rollback' } elseif ($Uninstall) { 'uninstall' } else { 'install' }
    Write-Host "my-mods installer mode=$mode dir=$root powershell=$($PSVersionTable.PSVersion)$(if ($DryRun) { ' dry-run=yes (nothing is changed)' })"
    if ($Rollback) { Invoke-Rollback $root } elseif ($Uninstall) { Invoke-Uninstall $root } else { Invoke-Install $root }
} catch {
    Write-Host "error: $($_.Exception.Message)" -ForegroundColor Red
    $exitCode = 1
} finally {
    if ($script:WorkDir) {
        try { Invoke-GuardedDelete $script:WorkDir ([IO.Path]::GetTempPath()) }
        catch { Write-Host "    could not remove the temp folder $($script:WorkDir): $($_.Exception.Message)" }
    }
    if ($savedEncoding) { [Console]::OutputEncoding = $savedEncoding }
}
exit $exitCode
