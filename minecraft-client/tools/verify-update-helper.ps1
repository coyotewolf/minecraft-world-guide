param([Parameter(Mandatory=$true)][string]$Site)
$ErrorActionPreference='Stop'
$mod=Split-Path $PSScriptRoot -Parent
$version=[regex]::Match([IO.File]::ReadAllText((Join-Path $mod 'build.gradle')),"(?m)^version='([^']+)'").Groups[1].Value
$helper=Join-Path $mod 'src/main/resources/aoi-update/apply-update.ps1'
$candidates=@(Get-ChildItem -LiteralPath (Join-Path (Resolve-Path -LiteralPath $Site).Path 'downloads') -File | Where-Object {$_.Name -match '^aoi-ai-assistant-1\.20\.1-(\d+\.\d+\.\d+)\.jar$' -and [version]$Matches[1] -lt [version]$version} | Sort-Object {[version]([regex]::Match($_.Name,'(\d+\.\d+\.\d+)\.jar$').Groups[1].Value)} -Descending)
if(-not $candidates.Count){throw 'A prior release is required for update fixtures'}
$oldJar=$candidates[0].FullName
$newName='aoi-ai-assistant-1.20.1-'+$version+'.jar'
$newJar=Join-Path $mod ('build/libs/'+$newName)
$fixtureRoot=Join-Path $mod ('build/update-fixtures-'+[guid]::NewGuid())
$checks=@()
foreach($case in @('success','detached','disabled','bad-hash','destination-exists','ambiguous','changed-old','path-traversal','locked-old','rollback')){
 $instance=Join-Path $fixtureRoot "$case/.minecraft"
 $mods=Join-Path $instance 'mods'
 $state=Join-Path $instance 'config/aoi_assistant/update'
 New-Item -ItemType Directory -Path $mods,$state -Force | Out-Null
 $oldName=Split-Path $oldJar -Leaf
 Copy-Item -LiteralPath $oldJar -Destination (Join-Path $mods $oldName)
 Copy-Item -LiteralPath $newJar -Destination (Join-Path $state 'staged.jar')
 Copy-Item -LiteralPath $helper -Destination (Join-Path $state 'apply-update.ps1')
 $plan=@{version=$version;sha256=(Get-FileHash -LiteralPath $newJar).Hash.ToLowerInvariant();bytes=(Get-Item -LiteralPath $newJar).Length;oldFile=$oldName;oldSha256=(Get-FileHash -LiteralPath $oldJar).Hash.ToLowerInvariant();processStartedAt=0}
 $fakeId=99999999
 if($case -in @('success','detached')){$child=Start-Process powershell.exe -WindowStyle Hidden -PassThru -ArgumentList '-NoProfile -Command "Start-Sleep -Seconds 2"';$fakeId=$child.Id;$plan.processStartedAt=($child.StartTime.ToUniversalTime()-[datetime]'1970-01-01').TotalMilliseconds}
 if($case -eq 'disabled'){Set-Content -LiteralPath (Join-Path $instance 'config/aoi_assistant-client.toml') -Value 'autoUpdate=false'}
 if($case -eq 'bad-hash'){$plan.sha256='0'*64}
 if($case -eq 'destination-exists'){Copy-Item -LiteralPath $oldJar -Destination (Join-Path $mods $newName)}
 if($case -eq 'ambiguous'){Copy-Item -LiteralPath $oldJar -Destination (Join-Path $mods 'aoi-ai-assistant-1.20.1-0.0.0.jar')}
 if($case -eq 'changed-old'){$plan.oldSha256='0'*64}
 if($case -eq 'path-traversal'){$plan.oldFile='../elsewhere.jar'}
 $plan|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $state 'pending.json') -Encoding UTF8
 $locked=$null
 if($case -eq 'locked-old'){$locked=[IO.File]::Open((Join-Path $mods $oldName),[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)}
 if($case -eq 'rollback'){$locked=[IO.File]::Open((Join-Path $state 'staged.jar'),[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)}
 $started=Get-Date
 if($case -eq 'detached'){
  $psFile=(Get-Command powershell.exe).Source
  $arguments='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+(Join-Path $state 'apply-update.ps1')+'" -GameProcessId '+$fakeId
  $command="Start-Process -FilePath '"+$psFile.Replace("'","''")+"' -WindowStyle Hidden -ArgumentList '"+$arguments.Replace("'","''")+"'"
  & powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -Command $command
  $deadline=(Get-Date).AddSeconds(15)
  while(-not(Test-Path -LiteralPath (Join-Path $state 'result.json')) -and (Get-Date) -lt $deadline){Start-Sleep -Milliseconds 100}
 }else{& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $state 'apply-update.ps1') -GameProcessId $fakeId}
 if($locked){$locked.Dispose()}
 $result=Get-Content -LiteralPath (Join-Path $state 'result.json') -Raw | ConvertFrom-Json
 if($case -in @('success','detached')){
  if(-not $result.success -or (Test-Path -LiteralPath (Join-Path $mods $oldName)) -or (Get-FileHash -LiteralPath (Join-Path $mods $newName)).Hash -ne (Get-FileHash -LiteralPath $newJar).Hash){throw "Success fixture failed: $($result.error)"}
  if(-not(Test-Path -LiteralPath (Join-Path $result.backup $oldName))){throw 'Backup missing'}
  if(((Get-Date)-$started).TotalSeconds -lt 1){throw 'Helper did not wait for game exit'}
 }else{if($result.success -or -not(Test-Path -LiteralPath (Join-Path $mods $oldName)) -or -not(Test-Path -LiteralPath (Join-Path $state 'staged.jar'))){throw "Unsafe failure: $case"}}
 $checks+=$case
}
@{passed=$true;version=$version;jarHash=(Get-FileHash -LiteralPath $newJar).Hash.ToLowerInvariant();checks=$checks;scope='isolated fixture directories and temporary dummy process only';fixtureRoot=$fixtureRoot}|ConvertTo-Json -Depth 3|Set-Content -LiteralPath (Join-Path $mod 'build/update-helper-checks.json') -Encoding UTF8
Write-Output 'Update helper checks passed: 10 scenarios'
