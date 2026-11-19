import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ingest from '../hydradb/actions/ingest-knowledge.ts';
import query from '../hydradb/actions/recall-context.ts';
const fixture = JSON.parse(fs.readFileSync(new URL('./unified-response.json', import.meta.url)));

async function run(action, input = {}, payload = fixture, layout, fail = false) {
  const requests = [];
  const request = async req => { requests.push(req); if (fail) throw new Error('rejected'); return { data: structuredClone(payload) }; };
  const nango = { getMetadata: async () => ({ database: 'db', collection: 'col', ...(layout !== undefined && { layout }) }), proxy: request, post: request };
  try { return { result: await action(nango, { query: 'q', text: 'note', kind: 'memory', maxResults: 0, ...input }), requests }; }
  catch (error) { error.requests = requests; throw error; }
}

test('unified chunks retain literal text and fields without fabricating chunks for roots', async () => {
  const { result, requests } = await run(query);
  assert.equal(result[0].id, 'c1');
  assert.equal(result[0].text, fixture.data.chunks[0].content);
  assert.equal(result[0].score, 0);
  assert.equal(result[0].context_id, 'ctx1');
  assert.equal(result[0].title, undefined);
  for (const key of ['enrichment', 'received_at', 'temporal', 'chunk_metadata']) assert.deepEqual(result[0][key], fixture.data.chunks[0][key]);
  for (const key of ['graph', 'forceful_relations', 'llm_prompt', 'tabular_data']) assert.deepEqual(result[0][key], fixture.data[key]);
  assert.equal(requests[0].data.type, 'memory');
  assert.equal(requests[0].data.max_results, 0);
  assert.deepEqual((await run(query, {}, { data: { ...fixture.data, chunks: [] } })).result, []);
});

test('whole-context action preserves chunkless roots without changing Chunk[]', async () => {
  const { default: recall } = await import('../hydradb/actions/recall-context-envelope.ts');
  const payload = { ...fixture, data: { ...fixture.data, chunks: [] } };
  const { result, requests } = await run(recall, {}, payload, 'unified');
  assert.deepEqual(result, payload);
  assert.equal(Object.hasOwn(requests[0].data, 'type'), false);
  assert.equal(Object.hasOwn(requests[0].data, 'kind'), false);
});

test('unified ingestion is JSON, preserves false values and uses affirmative per-item acceptance', async () => {
  const context = [{ text: 'x', context_id: 'ctx', enrich: false, upsert: false, attributes: { n: 0 }, custom_attributes: { flag: false }, acl: [] }];
  const accepted = { data: { results: [{ id: 'ctx', status: 'pending' }], success_count: 1, failed_count: 0 } };
  const { result, requests } = await run(ingest, { context }, accepted, 'unified');
  assert.deepEqual(requests[0].data, { database: 'db', collection: 'col', context });
  assert.equal(requests[0].headers['Content-Type'], 'application/json');
  assert.deepEqual(result, { success: true });
  for (const payload of [{}, { success: true }, { data: { success_count: 1, failed_count: 1 } }, { data: { results: [{ status: 'failed', error: 'bad' }] } }]) {
    assert.deepEqual((await run(ingest, {}, payload, 'unified')).result, { success: false });
  }
});

test('split serialization and prose stay unchanged, with no retries on a failed write', async () => {
  const { requests } = await run(ingest);
  assert.match(requests[0].headers['Content-Type'], /^multipart\/form-data/);
  assert.match(requests[0].data, /name="type"\r\n\r\nknowledge/);
  const old = await run(query, {}, { data: { chunks: [{ chunk_uuid: 'old', chunk_content: '{"content":{"text":"split prose"}}', relevancy_score: 0 }] } });
  assert.deepEqual(old.result, [{ id: 'old', text: 'split prose', score: 0, title: undefined }]);
  await assert.rejects(run(ingest, {}, {}, 'unified', true), e => e.requests.length === 1);
  await assert.rejects(run(ingest, {}, {}, undefined, true), e => e.requests.length === 1);
});

test('unknown keys and untrusted layout choices fail before sending', async () => {
  for (const context of [[{ text: 'x', metadata: {} }], [{ text: 'x', type: 'knowledge' }], [{ conversation: [{ role: 'user', content: 'x', name: 'bad' }] }], []]) {
    await assert.rejects(run(ingest, { context }, {}, 'unified'), e => e.requests.length === 0);
  }
  await assert.rejects(run(ingest, {}, {}, 'auto'), e => e.requests.length === 0);
  await assert.rejects(run(ingest, { context: [{ text: 'x' }] }), e => e.requests.length === 0);
  await assert.rejects(run(ingest, { text: '' }), e => e.requests.length === 0);
});

test('provider configuration retains bearer and explicit v2 header', () => {
  const provider = fs.readFileSync(new URL('../providers.snippet.yaml', import.meta.url), 'utf8');
  assert.match(provider, /authorization: Bearer \$\{apiKey\}/);
  assert.match(provider, /api-version: '2'/);
});
