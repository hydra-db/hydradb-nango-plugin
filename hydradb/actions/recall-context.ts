import type { NangoAction, QueryInput, Chunk } from '../../models';

/**
 * Extract the prose from a HydraDB content envelope.
 * @param obj - A parsed envelope object.
 * @returns The text/markdown prose, or null if none is present.
 */
function proseFromEnvelope(obj: Record<string, any>): string | null {
	const content = obj['content'];
	if (content && typeof content === 'object') {
		for (const key of ['text', 'markdown']) {
			if (typeof content[key] === 'string' && content[key].trim()) return content[key];
		}
	}
	if (typeof content === 'string' && content.trim()) return content;
	if (typeof obj['text'] === 'string' && obj['text'].trim()) return obj['text'];
	return null;
}

/**
 * Unwrap a recall chunk to its prose, keeping any trailing graph enrichment.
 * @param value - The raw chunk content, possibly an envelope JSON with trailing text.
 * @returns The prose, or the input unchanged when it is not an envelope.
 */
function extractText(value: unknown): string {
	if (typeof value !== 'string') return value == null ? '' : String(value);
	const stripped = value.trim();
	if (!stripped.startsWith('{')) return value;
	let depth = 0;
	let inStr = false;
	let escaped = false;
	let end = -1;
	for (let i = 0; i < stripped.length; i++) {
		const ch = stripped[i];
		if (inStr) {
			if (escaped) escaped = false;
			else if (ch === '\\') escaped = true;
			else if (ch === '"') inStr = false;
			continue;
		}
		if (ch === '"') inStr = true;
		else if (ch === '{') depth++;
		else if (ch === '}' && --depth === 0) {
			end = i + 1;
			break;
		}
	}
	if (end === -1) return value;
	try {
		const obj = JSON.parse(stripped.slice(0, end));
		const prose = proseFromEnvelope(obj);
		if (prose === null) return value;
		const trailing = stripped.slice(end).trim();
		return trailing ? `${prose}\n\n${trailing}` : prose;
	} catch {
		return value;
	}
}

/**
 * Recall relevant context from HydraDB through the Nango proxy.
 * @param nango - The Nango action context.
 * @param input - The query, optional kind, and optional max results.
 * @returns An array of chunks, each with id, text, score, and title.
 */
export default async function runAction(nango: NangoAction, input: QueryInput): Promise<Chunk[]> {
	const { database, collection = '' } = await nango.getMetadata<{ database: string; collection?: string }>();
	const res = await nango.post({
		endpoint: '/query',
		data: {
			database,
			collection,
			query: input.query,
			kind: input.kind || 'knowledge',
			mode: 'fast',
			max_results: input.maxResults || 6,
			graph_context: true,
			...(input.includeTableSql != null && { include_table_sql: input.includeTableSql }),
			...(input.tableLimit != null && { table_limit: input.tableLimit }),
		},
	});
	const data = res.data?.data || {};
	const chunks: Record<string, any>[] = data.chunks || [];
	const extras: Record<string, any> = {};
	for (const key of ['tabular_data', 'temporal_facts', 'temporal_duration', 'temporal_filter']) {
		if (data[key] != null) extras[key] = data[key];
	}
	if (res.data?.meta?.warnings?.length) extras['warnings'] = res.data.meta.warnings;
	const rows = chunks.length ? chunks : (Object.keys(extras).length ? [{}] : []);
	return rows.map((c, i) => ({
		id: c['chunk_uuid'] || c['id'] || String(i),
		text: extractText(c['chunk_content'] ?? c['text']),
		score: c['relevancy_score'] ?? c['score'] ?? undefined,
		title: c['source_title'] || c['title'] || undefined,
		...(c['chunk_metadata'] != null && { chunk_metadata: c['chunk_metadata'] }),
		...(extras as Partial<Chunk>),
	}));
}
