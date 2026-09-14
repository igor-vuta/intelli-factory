"""Release guards without a VM, Docker daemon, or application database."""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SCRIPTS = Path(__file__).resolve().parents[1]
SHA = "a" * 40


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.repo = self.root / "repo"
        self.bin = self.root / "bin"
        self.bin.mkdir()
        (self.repo / "deploy/oracle").mkdir(parents=True)
        self.log = self.root / "commands"
        self.archive = self.root / "images.gz"
        self.archive.write_bytes(b"tested images")
        self.env = dict(os.environ, PATH=f"{self.bin}:{os.environ['PATH']}", LOG=str(self.log))
        for command in ["git", "docker", "sudo", "flock", "gunzip", "sha256sum"]:
            self.command(command, '''#!/usr/bin/env python3
import hashlib, os, pathlib, sys
name = pathlib.Path(sys.argv[0]).name
args = sys.argv[1:]
with open(os.environ['LOG'], 'a') as log:
    log.write(name + ' ' + ' '.join(args) + '\\n')
if name == 'git':
    if args == ['status', '--porcelain']: print(os.environ.get('DIRTY', ''), end='')
    elif args == ['branch', '--show-current']: print(os.environ.get('BRANCH', 'production'))
    elif args[:1] == ['rev-parse']: print(os.environ.get('TIP', 'a' * 40))
elif name == 'sha256sum':
    expected, path = sys.stdin.read().strip().split('  ', 1)
    sys.exit(0 if hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest() == expected else 1)
elif name == 'gunzip': print('image data')
elif name in ['sudo', 'docker']:
    if 'load' in args:
        sys.stdin.read()
    if 'pg_dump' in args:
        print('backup')
        sys.exit(int(os.environ.get('BACKUP_FAIL', '0')))
    if 'pg_restore' in args:
        sys.stdin.read()
        sys.exit(int(os.environ.get('RESTORE_FAIL', '0')))
    if args[-1:] == ['backend'] and 'up' in args:
        sys.exit(int(os.environ.get('HEALTH_FAIL', '0')))
''')
        (self.repo / "deploy/oracle/deploy.sh").write_text('echo deploy >> "$LOG"\n')

    def command(self, name, content):
        path = self.bin / name
        path.write_text(content)
        path.chmod(0o755)

    def release(self, **env):
        checksum = hashlib.sha256(self.archive.read_bytes()).hexdigest()
        return subprocess.run(
            ['bash', str(SCRIPTS / 'release.sh'), str(self.repo), SHA, str(self.archive), checksum],
            env=dict(self.env, **env), capture_output=True, text=True,
        )

    def commands(self):
        return self.log.read_text() if self.log.exists() else ''

    def test_dirty_checkout_never_loads_or_checks_out(self):
        self.assertNotEqual(self.release(DIRTY=' M application').returncode, 0)
        self.assertNotIn('docker', self.commands())
        self.assertNotIn('git checkout', self.commands())

    def test_stale_release_never_loads_images(self):
        self.assertNotEqual(self.release(TIP='b' * 40).returncode, 0)
        self.assertNotIn('docker', self.commands())

    def test_bad_archive_never_fetches_or_loads(self):
        result = subprocess.run(
            ['bash', str(SCRIPTS / 'release.sh'), str(self.repo), SHA, str(self.archive), '0' * 64],
            env=self.env, capture_output=True,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('git fetch', self.commands())
        self.assertNotIn('docker', self.commands())

    def test_verified_images_load_before_checkout_and_deploy(self):
        self.assertEqual(self.release().returncode, 0)
        commands = self.commands()
        self.assertLess(commands.index('docker load'), commands.index('git checkout'))
        self.assertLess(commands.index('git checkout'), commands.index('\ndeploy'))
        self.assertFalse(self.archive.exists())

    def deploy(self, **env):
        shutil.copy(SCRIPTS / 'deploy.sh', self.repo / 'deploy/oracle/deploy.sh')
        (self.repo / 'deploy/oracle/.env').touch()
        return subprocess.run(['bash', str(self.repo / 'deploy/oracle/deploy.sh')],
                              env=dict(self.env, **env), capture_output=True, text=True)

    def test_backup_failure_stops_before_migrations(self):
        self.assertNotEqual(self.deploy(BACKUP_FAIL='1').returncode, 0)
        self.assertNotIn('run --rm', self.commands())

    def test_unreadable_backup_stops_before_migrations(self):
        self.assertNotEqual(self.deploy(RESTORE_FAIL='1').returncode, 0)
        self.assertNotIn('run --rm', self.commands())

    def test_backend_health_failure_stops_before_frontend(self):
        self.assertNotEqual(self.deploy(HEALTH_FAIL='1').returncode, 0)
        self.assertNotIn('180 frontend', self.commands())

    def test_nonproduction_branch_cannot_deploy(self):
        self.assertNotEqual(self.deploy(BRANCH='main').returncode, 0)
        self.assertNotIn('docker', self.commands())


if __name__ == '__main__':
    unittest.main()
