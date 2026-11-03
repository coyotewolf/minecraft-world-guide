param([Parameter(Mandatory=$true)][long]$GameProcessId)
$ErrorActionPreference='Stop'
$state=[IO.Path]::GetFullPath($PSScriptRoot)
$instance=[IO.Path]::GetFullPath((Join-Path $state '../../..'))
$mods=Join-Path $instance 'mods'
$lock=$null
try{
 $lock=[IO.File]::Open((Join-Path $state 'apply.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::Write,[IO.FileShare]::None)
 $plan=Get-Content -LiteralPath (Join-Path $state 'pending.json') -Raw | ConvertFrom-Json
 if($plan.version -notmatch '^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})$' -or $plan.sha256 -notmatch '^[a-f0-9]{64}$' -or $plan.oldSha256 -notmatch '^[a-f0-9]{64}$'){throw 'Invalid plan'}
 if($plan.oldFile -notmatch '^aoi-ai-assistant-1\.20\.1-\d+\.\d+\.\d+\.jar$'){throw 'Invalid old file'}
 $game=Get-Process -Id $GameProcessId -ErrorAction SilentlyContinue
 if($game){
  $started=($game.StartTime.ToUniversalTime()-[datetime]'1970-01-01').TotalMilliseconds
  if([Math]::Abs($started-[double]$plan.processStartedAt) -le 2000 -and -not $game.WaitForExit(86400000)){throw 'Wait timed out; update retained for next check'}
 }
 $config=Join-Path $instance 'config/aoi_assistant-client.toml'
 if((Test-Path -LiteralPath $config) -and (Get-Content -LiteralPath $config -Raw) -match '(?m)^\s*autoUpdate\s*=\s*false\b'){throw 'Automatic updates disabled'}
 # Fail safely if another copy of this game instance has already started.
 $processRoot=if((Split-Path $instance -Leaf) -eq '.minecraft'){Split-Path $instance -Parent}else{$instance}
 $instanceName=$processRoot.Replace('\','/').ToLowerInvariant()
 $running=Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^javaw?\.exe$' -and $_.CommandLine -and $_.CommandLine.Replace('\','/').ToLowerInvariant().Contains($instanceName) }
 if($running){throw 'Game instance still running; update retained'}
 $staged=Join-Path $state 'staged.jar'
 if((Get-Item -LiteralPath $staged).Length -ne [long]$plan.bytes -or (Get-FileHash -LiteralPath $staged -Algorithm SHA256).Hash.ToLowerInvariant() -ne $plan.sha256){throw 'Staged checksum failed'}
 $old=Join-Path $mods $plan.oldFile
 $new=Join-Path $mods ('aoi-ai-assistant-1.20.1-'+$plan.version+'.jar')
 if(Test-Path -LiteralPath $new){throw 'Destination exists; refusing overwrite'}
 $family=@(Get-ChildItem -LiteralPath $mods -File | Where-Object {$_.Name -match '^aoi-ai-assistant-1\.20\.1-\d+\.\d+\.\d+\.jar$'})
 if($family.Count -ne 1 -or $family[0].Name -ne $plan.oldFile){throw 'Ambiguous installed version'}
 if((Get-FileHash -LiteralPath $old -Algorithm SHA256).Hash.ToLowerInvariant() -ne $plan.oldSha256){throw 'Installed version changed; refusing update'}
 $backupRoot=Join-Path $instance 'aoi-assistant-backups'
 $backup=[IO.Path]::GetFullPath((Join-Path $backupRoot ('auto-'+$plan.version+'-'+[guid]::NewGuid())))
 if(-not $backup.StartsWith([IO.Path]::GetFullPath($backupRoot)+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid backup path'}
 foreach($target in @($old,$new)){if(-not [IO.Path]::GetFullPath($target).StartsWith([IO.Path]::GetFullPath($mods)+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Invalid mod target'}}
 New-Item -ItemType Directory -Path $backup | Out-Null
 Move-Item -LiteralPath $old -Destination (Join-Path $backup $plan.oldFile)
 try{Move-Item -LiteralPath $staged -Destination $new}catch{Move-Item -LiteralPath (Join-Path $backup $plan.oldFile) -Destination $old;throw}
 @{success=$true;version=$plan.version;backup=$backup}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $state 'result.json') -Encoding UTF8
 Remove-Item -LiteralPath (Join-Path $state 'pending.json')
}catch{
 @{success=$false;error=$_.Exception.Message}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $state 'result.json') -Encoding UTF8
}finally{if($lock){$lock.Dispose()}}
