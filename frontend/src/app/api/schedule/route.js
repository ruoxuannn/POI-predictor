import { readFile } from 'fs/promises';
import path from 'path';

const DATA = path.join(process.cwd(), '..', 'data');

export async function GET() {
  try {
    const raw = await readFile(path.join(DATA, 'config', 'schedule.json'), 'utf8');
    const data = JSON.parse(raw);
    return Response.json(data);
  } catch (e) {
    return Response.json({ sources: [], merge_script: 'jobs/run.js', merge: '' }, { status: 200 });
  }
}
