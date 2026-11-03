param([Parameter(Mandatory=$true)][string]$Instance)
$ErrorActionPreference = 'Stop'
$instanceRoot = (Resolve-Path -LiteralPath $Instance).Path
$cfg = Join-Path $instanceRoot 'instance.cfg'
$text = [IO.File]::ReadAllText($cfg)
$old = [regex]::Match($text, '(?m)^PreLaunchCommand=(.*)').Groups[1].Value.Trim()
if ($old -and $old -notlike '*aoi_assistant/prelaunch/prelaunch.ps1*') { throw 'Existing pre-launch command requires manual chaining; preserved.' }
$launcherRoot = Split-Path (Split-Path $instanceRoot -Parent) -Parent
$global = [IO.File]::ReadAllText((Join-Path $launcherRoot 'multimc.cfg'))
if ($text -notmatch '(?m)^OverrideCommands=true\s*$' -and @([regex]::Matches($global, '(?m)^(PreLaunchCommand|PostExitCommand|WrapperCommand)=(.*)') | Where-Object { $_.Groups[2].Value.Trim() }).Count) { throw 'Existing global commands require manual chaining; preserved.' }
$gameRoot = Join-Path $instanceRoot '.minecraft'
if (-not (Test-Path -LiteralPath (Join-Path $gameRoot 'mods'))) { throw 'Not a Minecraft instance' }
$target = Join-Path $gameRoot 'config/aoi_assistant/prelaunch'
New-Item -ItemType Directory -Force -Path $target | Out-Null
$backup = Join-Path $target ('launcher-settings-' + [guid]::NewGuid().ToString() + '.cfg')
Copy-Item -LiteralPath $cfg -Destination $backup
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'build/updater.jar') -Destination (Join-Path $target 'updater.jar') -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'prelaunch.ps1') -Destination (Join-Path $target 'prelaunch.ps1') -Force
$hook = 'powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "$INST_MC_DIR/config/aoi_assistant/prelaunch/prelaunch.ps1"'
$text = [regex]::Replace($text, '(?m)^OverrideCommands=.*', 'OverrideCommands=true')
$text = [regex]::Replace($text, '(?m)^PreLaunchCommand=.*', ('PreLaunchCommand=' + $hook).Replace('$', '$$'))
if ($text -notmatch '(?m)^OverrideCommands=') { $text += "`nOverrideCommands=true`n" }
if ($text -notmatch '(?m)^PreLaunchCommand=') { $text += "`nPreLaunchCommand=$hook`n" }
[IO.File]::WriteAllText($cfg, $text, (New-Object Text.UTF8Encoding($false)))
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'finalize-settings.ps1') -Destination (Join-Path $target 'finalize-settings.ps1') -Force
$launcher = @(Get-Process MultiMC -ErrorAction SilentlyContinue | Where-Object { $_.Path -and (Split-Path $_.Path -Parent) -eq $launcherRoot })
foreach ($process in $launcher) {
    $ps = Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
    $argsText = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $target 'finalize-settings.ps1') + '" -LauncherPid ' + $process.Id + ' -StartedAt ' + $process.StartTime.ToUniversalTime().Ticks + ' -Instance "' + $instanceRoot + '"'
    Start-Process -FilePath $ps -WindowStyle Hidden -ArgumentList $argsText | Out-Null
}
Write-Output ('Installed. Launcher settings backup: ' + $backup)
