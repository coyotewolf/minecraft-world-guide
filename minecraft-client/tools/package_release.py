"""Package a checked client build plus the three changed Worker source files.

Run with the bundled Python runtime after verifyClient/build and GUI verification.
This tool does not deploy services, install into a game instance or read credentials.
"""
from pathlib import Path
import hashlib
import json
import re
import shutil
import struct
import zipfile

root = Path(__file__).resolve().parents[1]
site = root.parent
version = re.search(r"^version='([^']+)'", (root / 'build.gradle').read_text(encoding='utf-8'), re.M).group(1)
jar = root / f'build/libs/aoi-ai-assistant-1.20.1-{version}.jar'
gui = json.loads((root / 'run/gui-verification.json').read_text(encoding='utf-8'))
assert gui.get('passed') is True, 'GUI verification must pass before packaging'
command_gui = json.loads((root / 'run/command-ui-verification.json').read_text(encoding='utf-8'))
assert command_gui.get('passed') is True, 'Native command UI must pass before packaging'
log = (root / 'verification.log').read_bytes().decode('utf-8', errors='replace')
assert 'Client verification passed:' in log and 'BUILD SUCCESSFUL' in log
assert 'Command verification passed:' in log
assert 'Remembered login verification passed:' in log
worker_log = (root / 'all-worker-tests.log').read_bytes().decode('utf-8', errors='replace')
assert re.search(r'pass [0-9]+', worker_log) and re.search(r'fail 0', worker_log)

patterns = [rb'sb_secret_[A-Za-z0-9_-]+', rb'AIza[0-9A-Za-z_-]{30,}',
            rb'sk-(?:proj-)?[A-Za-z0-9_-]{25,}', rb'eyJhbGciOi[A-Za-z0-9_.-]{40,}',
            rb'mock-password', rb'mock-token']
classes = 0
with zipfile.ZipFile(jar) as archive:
    assert archive.testzip() is None
    names = archive.namelist()
    assert not any('aoichecks' in n or 'Verification' in n or 'ClientChecks' in n for n in names)
    for required in ('META-INF/mods.toml', 'assets/aoi_assistant/lang/zh_tw.json',
                     'io/github/coyotewolf/aoi/AoiAssistantMod.class',
                     'io/github/coyotewolf/aoi/client/CrosshairTarget.class',
                     'io/github/coyotewolf/aoi/model/TargetQuestion.class',
                     'io/github/coyotewolf/aoi/security/WindowsSessionStore.class',
                     'io/github/coyotewolf/aoi/client/GameScene.class',
                     'io/github/coyotewolf/aoi/model/SceneSelection.class'):
        assert required in names
    assert f'version="{version}"'.encode() in archive.read('META-INF/mods.toml')
    for name in names:
        data = archive.read(name)
        assert not any(re.search(pattern, data) for pattern in patterns), 'Credential/test fixture in JAR: ' + name
        if name.endswith('.class'):
            classes += 1
            assert data[:4] == b'\xca\xfe\xba\xbe'
            assert struct.unpack('>H', data[6:8])[0] == 61, 'Expected Java 17 bytecode: ' + name

release = root / f'release/2026-10-10-v{version}'
release.mkdir(parents=True, exist_ok=True)
shipped = release / jar.name
shutil.copy2(jar, shipped)
source = release / f'aoi-ai-assistant-{version}-source.zip'
excluded = {'build', 'run', '.gradle', 'release', '__pycache__'}
entries = {}
for path in root.rglob('*'):
    rel = path.relative_to(root)
    if path.is_file() and not excluded.intersection(rel.parts) and path.suffix not in {'.log', '.dpapi', '.tmp'}:
        entries['minecraft-client/' + rel.as_posix()] = path
for name in ('worker.js', 'client-access.js', 'client-access.test.js', 'core.js', 'game-context.js', 'game-context.test.js'):
    entries['cloud-ai/' + name] = site / 'cloud-ai' / name
with zipfile.ZipFile(source, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name, path in sorted(entries.items()):
        info = zipfile.ZipInfo(name, (2026, 10, 10, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, path.read_bytes())
with zipfile.ZipFile(source) as archive:
    assert archive.testzip() is None

hashes = '\n'.join(hashlib.sha256(p.read_bytes()).hexdigest() + '  ' + p.name
                   for p in (shipped, source)) + '\n'
(release / 'SHA256SUMS.txt').write_text(hashes, encoding='utf-8')
report = {'jar': shipped.name, 'sha256': hashlib.sha256(shipped.read_bytes()).hexdigest(),
          'javaClassMajor': 61, 'classesChecked': classes, 'secretScan': 'passed',
          'testClassesExcluded': True, 'zipIntegrity': 'passed', 'gui': gui,
          'nativeCommandGui': command_gui,
          'crosshairTargetAcceptance': 'actual modpack world and real cloud account not tested',
          'cloudChangesInThisRelease': False,
          'gameSceneAcceptance': 'actual modpack container, JEI and dragon view not tested; source/API/native GUI checks passed',
          'rememberedLoginVerification': 'real Windows DPAPI and separate JVM restart with mock auth; real account restart not tested',
          'productionDeployment': 'not performed', 'actualModpackCloudAcceptance': 'not performed'}
deployment = root / 'DEPLOYMENT-RESULT.json'
if deployment.exists():
    report['previousNativeEntryDeployment'] = json.loads(deployment.read_text(encoding='utf-8'))
scene_deployment = root / 'SCENE-DEPLOYMENT.json'
if scene_deployment.exists():
    report['productionDeployment'] = json.loads(scene_deployment.read_text(encoding='utf-8'))
(release / 'release-checks.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'jar': str(shipped), 'source': str(source), 'classes': classes,
                  'sha256': report['sha256']}, ensure_ascii=True))
