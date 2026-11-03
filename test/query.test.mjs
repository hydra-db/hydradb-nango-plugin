import { test } from 'node:test';
import assert from 'node:assert/strict';
import run from '../hydradb/actions/recall-context.ts';
const data = { chunks: [{ chunk_uuid: 'c1', chunk_content: 'hello', chunk_metadata: { row: 2 } }], tabular_data: { status: 'ok', records: [{ n: 1 }] }, temporal_facts: [{ observed_at: 123 }], temporal_duration: { from: { observed_at: 123 } } };
const meta = { warnings: [{ code: 'skipped', collections: ['private'] }] };
async function query(payload) { let request; const records = await run({ getMetadata: async () => ({database:'db'}), post: async r => {request = r; return {data: payload};} }, {query:'q', includeTableSql:true, tableLimit:5}); return {request, records}; }
test('query sends options and retains result metadata', async () => { const {request, records} = await query({data, meta}); assert.equal(request.data.include_table_sql, true); assert.equal(request.data.table_limit, 5); assert.deepEqual(records[0].chunk_metadata, data.chunks[0].chunk_metadata); assert.deepEqual(records[0].tabular_data, data.tabular_data); assert.deepEqual(records[0].temporal_facts, data.temporal_facts); assert.deepEqual(records[0].temporal_duration, data.temporal_duration); assert.deepEqual(records[0].warnings, meta.warnings); });
test('table-only response is accessible', async () => { const {records} = await query({data: {...data, chunks: []}, meta}); assert.deepEqual(records[0].tabular_data, data.tabular_data); });
test('empty response preserves empty output', async () => { const {records} = await query({data: {chunks: []}}); assert.deepEqual(records, []); });
