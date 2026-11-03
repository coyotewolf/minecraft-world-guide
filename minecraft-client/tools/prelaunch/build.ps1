param([Parameter(Mandatory=$true)][string]$Jdk, [Parameter(Mandatory=$true)][string]$Gson)
$ErrorActionPreference = 'Stop'
$outputRoot = Join-Path $PSScriptRoot 'build'
$classes = Join-Path $outputRoot 'classes'
New-Item -ItemType Directory -Force -Path $classes | Out-Null
$modRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$sources = @(
    (Join-Path $modRoot 'src/main/java/io/github/coyotewolf/aoi/update/ReleaseManifest.java'),
    (Join-Path $modRoot 'src/main/java/io/github/coyotewolf/aoi/update/UpdateLease.java'),
    (Join-Path $PSScriptRoot 'src/io/github/coyotewolf/aoi/update/PrelaunchUpdater.java'),
    (Join-Path $PSScriptRoot 'src/io/github/coyotewolf/aoi/update/PrelaunchChecks.java')
)
& (Join-Path $Jdk 'bin/javac.exe') --release 17 -encoding UTF-8 -cp $Gson -d $classes @sources
if ($LASTEXITCODE) { throw 'Compilation failed' }
& (Join-Path $Jdk 'bin/java.exe') -cp "$classes;$Gson" io.github.coyotewolf.aoi.update.PrelaunchChecks
if ($LASTEXITCODE) { throw 'Verification failed' }
$bundle = Join-Path $outputRoot 'bundle'
New-Item -ItemType Directory -Force -Path $bundle | Out-Null
Push-Location $bundle
try { & (Join-Path $Jdk 'bin/jar.exe') xf $Gson } finally { Pop-Location }
if ($LASTEXITCODE) { throw 'Gson extraction failed' }
Copy-Item -LiteralPath (Join-Path $classes 'io') -Destination $bundle -Recurse -Force
Remove-Item -LiteralPath (Join-Path $bundle 'io/github/coyotewolf/aoi/update/PrelaunchChecks.class')
Remove-Item -LiteralPath (Join-Path $bundle 'META-INF/MANIFEST.MF') -ErrorAction SilentlyContinue
& (Join-Path $Jdk 'bin/jar.exe') --create --file (Join-Path $outputRoot 'updater.jar') --main-class io.github.coyotewolf.aoi.update.PrelaunchUpdater -C $bundle .
if ($LASTEXITCODE) { throw 'Packaging failed' }
Write-Output ('Built pre-launch updater: ' + (Join-Path $outputRoot 'updater.jar'))
