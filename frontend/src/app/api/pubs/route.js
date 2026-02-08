import { readFile } from 'fs/promises';
import path from 'path';

// Frontend can run separately: reads from repo/data when available; missing file → []
const DATA = path.join(process.cwd(), '..', 'data');

export async function GET(request) {
  try {
    const raw = await readFile(path.join(DATA, 'storage', 'pubs_merged.json'), 'utf8');
    const data = JSON.parse(raw);
    const list = Array.isArray(data) ? data : [];
    const all = request.nextUrl?.searchParams?.get('all') === '1';
    const result = all ? list : list.filter((p) => p.insurable === true);
    return Response.json(result);
  } catch (e) {
    return Response.json([], { status: 200 });
  }
}
