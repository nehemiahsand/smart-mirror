#!/usr/bin/env python3
"""Exercise updater gates without touching Git remotes, containers or systemd."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
SCRIPT = Path(__file__).resolve().with_name('auto-update.sh')
class UpdaterTests(unittest.TestCase):
    def run_update(self, scenario):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);bin_dir=root/'bin';bin_dir.mkdir();project=root/'project';project.mkdir()
            for name in ['backend/src/api/nexus-routes.js','mobile-pwa/src/pages/Home.jsx']:
                p=project/name;p.parent.mkdir(parents=True,exist_ok=True);p.touch()
            stub='''#!/bin/bash
set -eu
name=$(basename "$0")
echo "$name $*" >> "$TEST_LOG"
case "$name" in
systemctl) if [ "$SCENARIO" = isolated ]; then echo /another/release; else echo "$SMART_MIRROR_PROJECT_DIR"; fi;;
git)
 case "$1" in
 status) if [ "$SCENARIO" = dirty ]; then echo ' M file'; fi;;
 fetch) if [ "$SCENARIO" = fetch-failure ]; then exit 17; fi;;
 rev-parse) if [ "$2" = HEAD ]; then echo old; else echo new; fi;;
 merge-base) echo old;;
 cat-file) true;;
 show) if [ "$SCENARIO" = plaintext ]; then echo '1883:1883'; else echo '8883:8883'; fi;;
 pull) if [ "$SCENARIO" = pull-failure ]; then exit 19; fi;;
 esac;;
docker) if [ "$SCENARIO" = build-failure ] && [ "$2" = up ]; then exit 23; fi;;
curl) true;;
esac
'''
            for name in ['systemctl','git','docker','curl']:
                p=bin_dir/name;p.write_text(stub);p.chmod(0o755)
            env={**os.environ,'PATH':str(bin_dir)+os.pathsep+os.environ['PATH'],'SMART_MIRROR_PROJECT_DIR':str(project),'SCENARIO':scenario,'TEST_LOG':str(root/'calls')}
            result=subprocess.run(['bash',str(SCRIPT)],env=env,capture_output=True,text=True)
            return result,(root/'calls').read_text()
    def test_isolated_and_dirty_releases_never_fetch_or_deploy(self):
        for scenario in ['isolated','dirty']:
            result,calls=self.run_update(scenario)
            self.assertEqual(result.returncode,0);self.assertNotIn('git fetch',calls);self.assertNotIn('docker',calls)
    def test_failures_do_not_deploy_or_claim_success(self):
        for scenario in ['fetch-failure','pull-failure','plaintext','build-failure']:
            result,calls=self.run_update(scenario)
            self.assertNotEqual(result.returncode,0);self.assertNotIn('Update deployed and health verified.',result.stdout)
            if scenario!='build-failure':self.assertNotIn('docker compose up',calls)
    def test_success_requires_fast_forward_and_health(self):
        result,calls=self.run_update('success')
        self.assertEqual(result.returncode,0,result.stderr);self.assertIn('git pull --ff-only origin main',calls);self.assertIn('curl --fail',calls);self.assertIn('health verified',result.stdout)
if __name__=='__main__':unittest.main()
