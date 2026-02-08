import { spawn } from 'child_process';
import path from 'path';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { setPipelineProcess, getPipelineProcess } from '../state.js';

const DATA = path.join(process.cwd(), '..', 'data');
const STATUS_FILE = path.join(DATA, '.pipeline-status.json');
const STOP_FILE = path.join(DATA, '.pipeline-stop');
const RUNNER = path.join(DATA, 'jobs', 'run-with-status.js');

export async function POST() {
  if (getPipelineProcess()) {
    return Response.json({ ok: false, error: 'Pipeline already running' }, { status: 409 });
  }
  if (!existsSync(RUNNER)) {
    return Response.json({ ok: false, error: 'Runner not found' }, { status: 500 });
  }
  try {
    if (existsSync(STOP_FILE)) unlinkSync(STOP_FILE);
  } catch (_) {}
  writeFileSync(STATUS_FILE, JSON.stringify({
    running: true,
    interrupted: false,
    currentStepIndex: null,
    steps: [],
    lastUpdated: new Date().toISOString(),
  }, null, 2));
  const child = spawn('node', [RUNNER], {
    cwd: DATA,
    env: { ...process.env, PIPELINE_STATUS_FILE: STATUS_FILE, PIPELINE_STOP_FILE: STOP_FILE },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  setPipelineProcess(child);
  child.on('close', () => setPipelineProcess(null));
  child.stdout?.on('data', () => {});
  child.stderr?.on('data', () => {});
  return Response.json({ ok: true });
}
