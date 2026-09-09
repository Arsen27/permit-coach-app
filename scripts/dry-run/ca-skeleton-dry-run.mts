// Proves the git-delivery path for a skeleton-built release against PGlite:
// the server's content tree holds ca-class-c 3.3.0 (seeded, on both channels)
// and 4.0.0 (built by scripts/build-state-course.mjs). import_content_tree
// registers 4.0.0 and merges its questions into the working bank;
// publish_staging + publish_bank_staging make a dev device see it.
import { createApp } from '../../server/src/index.js';
import { createContentDb } from '../../server/src/testContent.js';

process.env.STAGING_KEY = 'dry-run-key';
delete process.env.MCP_TOKEN;

const { db } = await createContentDb({ courses: ['ca-class-c'], versions: ['3.3.0'], channels: true });
const app = await createApp({ db });

let id = 0;
const call = async (name: string, args: Record<string, unknown> = {}) => {
  const response = await app.request('/mcp?key=dry-run-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: (id += 1), method: 'tools/call', params: { name, arguments: args } }),
  });
  const body: any = await response.json().catch(() => null);
  const text = body?.result?.content?.[0]?.text ?? '';
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* text */ }
  return { isError: body?.result?.isError === true, text, data };
};
const show = (label: string, result: { isError: boolean; text: string; data: any }, max = 700) => {
  console.log(`\n=== ${label} ===`);
  console.log(result.isError ? `REFUSED: ${result.text}` : result.text.slice(0, max));
  if (result.isError) process.exitCode = 1;
  return result;
};

show('channel_status before', await call('channel_status', { course: 'ca-class-c' }));
show('import_content_tree 4.0.0', await call('import_content_tree', { course: 'ca-class-c', versions: ['4.0.0'] }), 900);
show('publish_staging 4.0.0', await call('publish_staging', { course: 'ca-class-c', version: '4.0.0', reason: 'skeleton dry run' }));
show('publish_bank_staging', await call('publish_bank_staging', { course: 'ca-class-c' }));
show('channel_status after', await call('channel_status', { course: 'ca-class-c' }));
const outline = show('get_outline latest', await call('get_outline', { course: 'ca-class-c' }), 400);
console.log('modules', outline.data?.modules?.length, 'lessons', outline.data?.modules?.reduce((n: number, m: any) => n + m.lessons.length, 0));
show('read_lesson ca-speed-and-space', await call('read_lesson', { course: 'ca-class-c', lesson: 'ca-speed-and-space' }), 1200);

// What a device sees.
const get = async (url: string) => {
  const response = await app.request(url, { headers: { 'x-staging-key': 'dry-run-key' } });
  return { status: response.status, body: await response.json().catch(() => null) };
};
const bank = await get('/v1/bank/ca-class-c/doc?channel=staging');
const bankIds = new Set((bank.body?.questions ?? []).map((q: any) => q.questionId));
const out = await get('/v1/course/ca-class-c/outline?channel=staging');
console.log('\nstaging outline status', out.status, 'version', out.body?.deliveryVersion ?? out.body?.version);
const lessonDoc = await get('/v1/course/ca-class-c/lesson/ca-speed-and-space?channel=staging');
const refs: string[] = lessonDoc.body?.lesson?.questionIds ?? [];
console.log('bank status', bank.status, 'questions', bankIds.size, '| lesson refs present in bank:', refs.filter(r => bankIds.has(r)).length, '/', refs.length);
const missing = [...new Set(
  (out.body?.modules ?? []).flatMap((m: any) => (m.lessons ?? []).flatMap((l: any) => l.questionIds ?? l.testQuestionIds ?? [])),
)].filter((q: any) => !bankIds.has(q));
console.log('question ids referenced by the staging outline but missing from the bank:', missing.length);
await db.close?.();
