import { readFile } from 'fs/promises';
import path from 'path';

const DATA = path.join(process.cwd(), '..', 'data');
const STATUS_FILE = path.join(DATA, '.pipeline-status.json');

export async function GET() {
  try {
    const raw = await readFile(STATUS_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Response.json(data);
  } catch {
    return Response.json({
      running: false,
      interrupted: false,
      currentStepIndex: null,
      steps: [],
      lastUpdated: null,
    });
  }
}
