param([int]$LauncherPid, [long]$StartedAt, [string]$Instance)
$ErrorActionPreference = 'Stop'
try {
    $launcher = Get-Process -Id $LauncherPid -ErrorAction SilentlyContinue
    if ($launcher -and $launcher.StartTime.ToUniversalTime().Ticks -eq $StartedAt) {
        if (-not $launcher.WaitForExit(86400000)) { exit 0 }
    }
    # MultiMC may save its cached old settings at shutdown. Merge only our two keys afterwards.
    $cfg = Join-Path $Instance 'instance.cfg'
    $text = [IO.File]::ReadAllText($cfg)
    $old = [regex]::Match($text, '(?m)^PreLaunchCommand=(.*)').Groups[1].Value.Trim()
    if ($old -and $old -notlike '*aoi_assistant/prelaunch/prelaunch.ps1*') { exit 0 }
    $hook = 'powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "$INST_MC_DIR/config/aoi_assistant/prelaunch/prelaunch.ps1"'
    $text = [regex]::Replace($text, '(?m)^OverrideCommands=.*', 'OverrideCommands=true')
    $text = [regex]::Replace($text, '(?m)^PreLaunchCommand=.*', ('PreLaunchCommand=' + $hook).Replace('$', '$$'))
    if ($text -notmatch '(?m)^OverrideCommands=') { $text += "`nOverrideCommands=true`n" }
    if ($text -notmatch '(?m)^PreLaunchCommand=') { $text += "`nPreLaunchCommand=$hook`n" }
    [IO.File]::WriteAllText($cfg, $text, (New-Object Text.UTF8Encoding($false)))
    [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'launcher-settings-applied.txt'), [DateTime]::UtcNow.ToString('o'))
} catch { exit 1 }
