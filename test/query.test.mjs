import { test } from 'node:test';
import assert from 'node:assert/strict';
import run from '../hydradb/actions/recall-context.ts';

const data = { llm_prompt: 'Use this context', chunks: [{ chunk_uuid: 'c1', chunk_content: 'hello', metadata: { row: 2 }, additional_metadata: { source: 'test' }, chunk_metadata: { obsolete: true } }], tabular_data: { status: 'ok', records: [{ n: 1 }] } };
async function query(payload) { let request; const records = await run({ getMetadata: async () => ({database:'db'}), post: async r => {request = r; return {data: payload};} }, {query:'q', includeTableSql:true, tableLimit:5}); return {request, records}; }
test('query sends options and retains live result fields', async () => {
  const {request, records} = await query({data, meta: {warnings: [{code: 'obsolete'}]}});
  assert.equal(request.data.include_table_sql, true);
  assert.equal(request.data.table_limit, 5);
  assert.deepEqual(records[0].metadata, data.chunks[0].metadata);
  assert.deepEqual(records[0].additional_metadata, data.chunks[0].additional_metadata);
  assert.equal(records[0].llm_prompt, data.llm_prompt);
  assert.deepEqual(records[0].tabular_data, data.tabular_data);
  assert.ok(!('chunk_metadata' in records[0]));
  assert.ok(!('warnings' in records[0]));
});
test('table-only response and prompt are accessible', async () => { const {records} = await query({data: {...data, chunks: []}}); assert.deepEqual(records[0].tabular_data, data.tabular_data); assert.equal(records[0].llm_prompt, data.llm_prompt); });
test('prompt-only response is accessible', async () => { const {records} = await query({data: {chunks: [], llm_prompt: ''}}); assert.equal(records.length, 1); assert.equal(records[0].llm_prompt, ''); });
test('empty response preserves empty output', async () => { const {records} = await query({data: {chunks: []}}); assert.deepEqual(records, []); });
