param([Parameter(Mandatory=$true)][string]$Site,[string]$Version,[switch]$Publish)
$ErrorActionPreference='Stop'
$mod=Split-Path $PSScriptRoot -Parent
$siteRoot=(Resolve-Path -LiteralPath $Site).Path
$runtime=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies'
$node=Join-Path $runtime 'node/bin/node.exe'
$python=Join-Path $runtime 'python/python.exe'
$git=Join-Path $runtime 'native/git/cmd/git.exe'
$bundledJdk=Join-Path ([IO.Path]::GetFullPath((Join-Path $mod '../../..'))) 'work/keysearch-mod/runtime/jdk-17.0.20.1+1'
if(Test-Path -LiteralPath $bundledJdk){$env:JAVA_HOME=$bundledJdk}
if($Publish){
 & $git -C $siteRoot diff --cached --quiet
 if($LASTEXITCODE){throw 'Existing staged changes must be handled before publishing.'}
 & $git -C $siteRoot fetch origin main
 if($LASTEXITCODE){throw 'Cannot refresh release repository'}
 & $git -C $siteRoot merge-base --is-ancestor origin/main HEAD
 if($LASTEXITCODE){throw 'Release repository is outdated; update it before publishing.'}
}
if($Version){
 if($Version -notmatch '^(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})\.(0|[1-9][0-9]{0,5})$'){throw 'Invalid version'}
 $build=Join-Path $mod 'build.gradle';$text=[IO.File]::ReadAllText($build);$text=[regex]::Replace($text,"(?m)^version='[^']+'","version='$Version'");[IO.File]::WriteAllText($build,$text,[Text.UTF8Encoding]::new($false))
 $toml=Join-Path $mod 'src/main/resources/META-INF/mods.toml';$text=[IO.File]::ReadAllText($toml);$text=[regex]::Replace($text,'(?m)^version="[^"]+"',('version="'+$Version+'"'));[IO.File]::WriteAllText($toml,$text,[Text.UTF8Encoding]::new($false))
}
Push-Location $mod
try{& cmd.exe /d /c 'gradlew.bat verifyUpdates verifyAnnouncements verifyClient verifyCommands build > update-verification.log 2>&1';if($LASTEXITCODE){throw 'Mod verification failed'}; & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'verify-update-helper.ps1') -Site $siteRoot;if($LASTEXITCODE){throw 'Update helper verification failed'}; & $python (Join-Path $PSScriptRoot 'publish_release.py') --site $siteRoot --node $node;if($LASTEXITCODE){throw 'Release packaging failed'}}finally{Pop-Location}
if($Publish){
 $actualVersion=[regex]::Match([IO.File]::ReadAllText((Join-Path $mod 'build.gradle')),"(?m)^version='([^']+)'").Groups[1].Value
 & $git -C $siteRoot add -- ai-guide.js downloads/aoi-assistant-latest.json "downloads/aoi-ai-assistant-1.20.1-$actualVersion.jar" "downloads/aoi-ai-assistant-1.20.1-$actualVersion.sha256" "downloads/aoi-ai-assistant-$actualVersion-source.zip"
 if($LASTEXITCODE){throw 'Cannot stage release'}
 & $git -C $siteRoot commit -m 'Publish signed assistant update'
 if($LASTEXITCODE){throw 'Cannot commit release'}
 & $git -C $siteRoot push origin HEAD:main
 if($LASTEXITCODE){throw 'Cannot publish release'}
}
