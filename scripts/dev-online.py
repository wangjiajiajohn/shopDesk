#!/usr/bin/env python3
"""Run localhost Vite with the online API proxy configured in frontend/.env.development.local.
No backend or user data are copied locally.
"""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent.parent
STATE = ROOT / '.shopdesk-dev'
STATE.mkdir(exist_ok=True)
FILE = STATE / 'processes.json'


def alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False


def stop():
    records = json.loads(FILE.read_text()) if FILE.exists() else []
    for record in reversed(records):
        if not alive(record['pid']):
            continue
        command = subprocess.check_output(['ps', '-p', str(record['pid']), '-o', 'args='], text=True).strip()
        if record['match'] not in command:
            raise RuntimeError('Saved process no longer matches; refusing to stop it')
        os.killpg(record['pid'], signal.SIGTERM)
    FILE.unlink(missing_ok=True)


def start():
    if FILE.exists():
        records = json.loads(FILE.read_text())
        if all(alive(record['pid']) for record in records):
            print('Local frontend development process already running.')
            return
        stop()
        time.sleep(.5)
    records = []
    for name, args, cwd, match in [
        ('vite', ['npm', 'run', 'dev'], ROOT / 'frontend', 'npm run dev'),
    ]:
        log = open(STATE / (name + '.log'), 'ab')
        process = subprocess.Popen(args, cwd=cwd, stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)
        records.append({'pid': process.pid, 'match': match, 'name': name})
        FILE.write_text(json.dumps(records))
        time.sleep(1)
        if process.poll() is not None:
            stop()
            raise RuntimeError(name + ' failed; inspect .shopdesk-dev logs')
    print('Local frontend development process running.')


if __name__ == '__main__':
    action = sys.argv[1] if len(sys.argv) > 1 else 'status'
    if action == 'start':
        start()
    elif action == 'stop':
        stop()
        print('Local frontend development stopped.')
    elif action == 'status':
        records = json.loads(FILE.read_text()) if FILE.exists() else []
        print({record['name']: alive(record['pid']) for record in records})
    else:
        raise SystemExit('Usage: dev-online.py start|stop|status')
