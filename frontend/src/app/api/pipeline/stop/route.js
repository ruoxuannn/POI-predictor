import { writeFileSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import { getPipelineProcess, setPipelineProcess } from '../state.js';

const DATA = path.join(process.cwd(), '..', 'data');
const STATUS_FILE = path.join(DATA, '.pipeline-status.json');
const STOP_FILE = path.join(DATA, '.pipeline-stop');

export async function POST() {
  const child = getPipelineProcess();
  if (child) {
    try {
      writeFileSync(STOP_FILE, '1');
      child.kill('SIGTERM');
    } catch (_) {}
    setPipelineProcess(null);
  }
  if (existsSync(STATUS_FILE)) {
    try {
      const data = JSON.parse(readFileSync(STATUS_FILE, 'utf8'));
      data.running = false;
      data.interrupted = true;
      if (data.steps && data.currentStepIndex != null && data.steps[data.currentStepIndex]) {
        data.steps[data.currentStepIndex].status = 'interrupted';
      }
      data.lastUpdated = new Date().toISOString();
      writeFileSync(STATUS_FILE, JSON.stringify(data, null, 2));
    } catch (_) {}
  }
  return Response.json({ ok: true });
}
