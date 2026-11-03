$ErrorActionPreference = 'Stop'
try {
    $gameRoot = [IO.Path]::GetFullPath($env:INST_MC_DIR)
    if (-not (Test-Path -LiteralPath (Join-Path $gameRoot 'mods'))) { throw 'Invalid Minecraft directory' }
    $instanceRoot = Split-Path $gameRoot -Parent
    $runningGame = @(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
        $_.Name -match '^java(w)?\.exe$' -and $_.CommandLine -and
        $_.CommandLine.Replace('/', '\').IndexOf($instanceRoot.Replace('/', '\'), [StringComparison]::OrdinalIgnoreCase) -ge 0
    })
    if ($runningGame.Count) { Write-Output 'AOI: instance still running; pre-launch update skipped'; exit 0 }
    $javaBinary = $env:INST_JAVA
    if (-not $javaBinary) { throw 'Launcher did not provide INST_JAVA' }
    # Console JVM ensures synchronous output/exit status; same runtime as Minecraft.
    if ([IO.Path]::GetFileName($javaBinary) -eq 'javaw.exe') {
        $consoleJava = Join-Path (Split-Path $javaBinary -Parent) 'java.exe'
        if (Test-Path -LiteralPath $consoleJava) { $javaBinary = $consoleJava }
    }
    & $javaBinary -Xmx64m -jar (Join-Path $PSScriptRoot 'updater.jar') $gameRoot
    exit $LASTEXITCODE
} catch {
    Write-Output 'AOI: pre-launch check unavailable; existing mod retained.'
    exit 0
}
