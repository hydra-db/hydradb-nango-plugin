import { layout } from './contract.ts';

export function queryBody(metadata: { database: string; collection?: string; layout?: string }, input: { query: string; kind?: string; maxResults?: number }) {
	return {
		database: metadata.database,
		collection: metadata.collection || '',
		query: input.query,
		...(layout(metadata.layout) === 'split' && { type: input.kind || 'knowledge' }),
		mode: 'fast',
		max_results: input.maxResults ?? 6,
		graph_context: true,
	};
}
