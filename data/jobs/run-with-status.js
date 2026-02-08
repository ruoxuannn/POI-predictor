#!/usr/bin/env node
/**
 * Runs pipeline with status file and stop-file check. Fetches run in parallel; then OSM normalize; then merge.
 * Env: PIPELINE_STATUS_FILE, PIPELINE_STOP_FILE.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DATA_DIR = path.resolve(__dirname, '..');
const statusPath = process.env.PIPELINE_STATUS_FILE || path.join(DATA_DIR, '.pipeline-status.json');
const stopPath = process.env.PIPELINE_STOP_FILE || path.join(DATA_DIR, '.pipeline-stop');

function writeStatus(obj) {
  try {
    fs.writeFileSync(statusPath, JSON.stringify({ ...obj, lastUpdated: new Date().toISOString() }, null, 2));
  } catch (e) {
    console.error(e);
  }
}

function stopRequested() {
  try {
    return fs.existsSync(stopPath);
  } catch {
    return false;
  }
}

function runOne(scriptPath, stepIndex, stepStatus, write) {
  return new Promise((resolve) => {
    const full = path.join(DATA_DIR, scriptPath);
    if (!fs.existsSync(full)) {
      stepStatus[stepIndex].status = 'interrupted';
      write();
      resolve({ ok: false });
      return;
    }
    const child = spawn('node', [full], { cwd: DATA_DIR, stdio: 'inherit', shell: true });
    const interval = setInterval(() => {
      if (stopRequested()) {
        clearInterval(interval);
        try {
          child.kill('SIGTERM');
        } catch (_) {}
        stepStatus[stepIndex].status = 'interrupted';
        write();
        resolve({ stopped: true });
      }
    }, 500);
    child.on('close', (code) => {
      clearInterval(interval);
      stepStatus[stepIndex].status = stopRequested() ? 'interrupted' : (code === 0 ? 'done' : 'interrupted');
      if (stepStatus[stepIndex].status === 'done') stepStatus[stepIndex].progress = 100;
      write();
      resolve({ ok: code === 0, stopped: stopRequested() });
    });
  });
}

async function main() {
  const schedulePath = path.join(DATA_DIR, 'config', 'schedule.json');
  const schedule = fs.existsSync(schedulePath) ? JSON.parse(fs.readFileSync(schedulePath, 'utf8')) : { sources: [] };

  const fetchSteps = [];
  let normalizeStep = null;
  for (const s of schedule.sources || []) {
    if (s.disabled) continue;
    if (s.script) fetchSteps.push({ name: s.name + ' (fetch)', script: s.script, estimatedSeconds: s.estimated_seconds });
    if (s.then) normalizeStep = { name: s.name + ' (normalize)', script: s.then, estimatedSeconds: s.then_estimated_seconds };
  }
  const steps = [...fetchSteps];
  if (normalizeStep) steps.push(normalizeStep);
  steps.push({ name: 'Merge & revenue proxy', script: 'merge', estimatedSeconds: schedule.merge_estimated_seconds || 15 });

  const parallelEnd = fetchSteps.length;

  const stepStatus = steps.map((s) => ({ name: s.name, status: 'pending', estimatedSeconds: s.estimatedSeconds }));
  const write = () => writeStatus({ running: true, interrupted: false, currentStepIndex: null, steps: stepStatus });

  writeStatus({ running: true, interrupted: false, currentStepIndex: null, steps: stepStatus });

  if (stopRequested()) {
    stepStatus[0].status = 'interrupted';
    writeStatus({ running: false, interrupted: true, currentStepIndex: 0, steps: stepStatus });
    try {
      fs.unlinkSync(stopPath);
    } catch (_) {}
    process.exit(1);
  }

  for (let i = 0; i < parallelEnd; i++) {
    stepStatus[i].status = 'running';
    stepStatus[i].startedAt = new Date().toISOString();
  }
  write();

  const parallelPromises = [];
  for (let i = 0; i < parallelEnd; i++) {
    parallelPromises.push(runOne(steps[i].script, i, stepStatus, write));
  }
  const parallelResults = await Promise.all(parallelPromises);
  if (parallelResults.some((r) => r.stopped)) {
    writeStatus({ running: false, interrupted: true, currentStepIndex: null, steps: stepStatus });
    try {
      fs.unlinkSync(stopPath);
    } catch (_) {}
    process.exit(1);
  }

  if (parallelEnd >= steps.length - 1) {
    try {
      fs.unlinkSync(stopPath);
    } catch (_) {}
    writeStatus({ running: false, interrupted: false, currentStepIndex: null, steps: stepStatus });
    return;
  }

  for (let i = parallelEnd; i < steps.length; i++) {
    if (stopRequested()) {
      stepStatus[i].status = 'interrupted';
      writeStatus({ running: false, interrupted: true, currentStepIndex: i, steps: stepStatus });
      try {
        fs.unlinkSync(stopPath);
      } catch (_) {}
      process.exit(1);
    }
    stepStatus[i].status = 'running';
    stepStatus[i].startedAt = new Date().toISOString();
    write();

    if (steps[i].script === 'merge') {
      const result = await new Promise((resolve) => {
        const child = spawn('node', ['jobs/run.js'], { cwd: DATA_DIR, stdio: 'inherit', shell: true });
        const interval = setInterval(() => {
          if (stopRequested()) {
            clearInterval(interval);
            try {
              child.kill('SIGTERM');
            } catch (_) {}
            resolve({ stopped: true });
          }
        }, 500);
        child.on('close', (code) => {
          clearInterval(interval);
          resolve({ stopped: false, ok: code === 0 });
        });
      });
      if (result.stopped) {
        stepStatus[i].status = 'interrupted';
        writeStatus({ running: false, interrupted: true, currentStepIndex: i, steps: stepStatus });
        try {
          fs.unlinkSync(stopPath);
        } catch (_) {}
        process.exit(1);
      }
      stepStatus[i].status = result.ok ? 'done' : 'interrupted';
      if (stepStatus[i].status === 'done') stepStatus[i].progress = 100;
    } else {
      const result = await runOne(steps[i].script, i, stepStatus, write);
      if (result.stopped) {
        stepStatus[i].status = 'interrupted';
        writeStatus({ running: false, interrupted: true, currentStepIndex: i, steps: stepStatus });
        try {
          fs.unlinkSync(stopPath);
        } catch (_) {}
        process.exit(1);
      }
    }
    if (stepStatus[i].status === 'done') stepStatus[i].progress = 100;
    write();
  }

  try {
    fs.unlinkSync(stopPath);
  } catch (_) {}
  writeStatus({ running: false, interrupted: false, currentStepIndex: null, steps: stepStatus });
}

main().catch((e) => {
  console.error(e);
  try {
    const raw = fs.readFileSync(statusPath, 'utf8');
    const data = JSON.parse(raw);
    data.running = false;
    data.interrupted = true;
    fs.writeFileSync(statusPath, JSON.stringify(data, null, 2));
  } catch (_) {}
  process.exit(1);
});
