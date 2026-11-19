import type { NangoAction, IngestInput, IngestOutput } from '../../models';
import { layout, unifiedBody } from '../contract.ts';

/**
 * Ingest a note as knowledge into HydraDB through the Nango proxy.
 * @param nango - The Nango action context.
 * @param input - The note text and optional title.
 * @returns An object reporting whether the ingest was accepted.
 */
export default async function runAction(nango: NangoAction, input: IngestInput): Promise<IngestOutput> {
	const { database, collection = '', layout: selectedLayout } = await nango.getMetadata<{ database: string; collection?: string; layout?: string }>();
	let res;
	if (layout(selectedLayout) === 'unified') {
		res = await nango.proxy({
			method: 'POST', endpoint: '/context/ingest',
			headers: { 'Content-Type': 'application/json' },
			data: unifiedBody(database, collection, input.context, input.text, input.title, `nango-${Date.now()}`),
		});
	} else {
		if (input.context !== undefined) throw new Error('context requires unified layout');
		if (typeof input.text !== 'string' || !input.text.trim()) throw new Error('text is required for split ingestion');
		const item = { id: `nango-${Date.now()}`, title: input.title || 'note', content: { text: input.text }, infer: true };
		const boundary = `----hydradb${Date.now()}`;
		const field = (name: string, value: string) =>
			`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
		const body =
			field('tenant_id', database) +
			field('sub_tenant_id', collection) +
			field('type', 'knowledge') +
			field('app_knowledge', JSON.stringify([item])) +
			`--${boundary}--\r\n`;
		res = await nango.proxy({
			method: 'POST',
			endpoint: '/context/ingest',
			headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
			data: body,
		});
	}
	const payload = (res.data?.data ?? res.data) || {};
	const results = Array.isArray(payload.results) ? payload.results : [];
	const itemFailed = results.some((r: any) => r && (r.status === 'failed' || r.error || r.error_code));
	const accepted = results.some((r: any) => r && !(r.status === 'failed' || r.error || r.error_code));
	const successCount = Number(payload.success_count ?? 0);
	const success =
		!itemFailed && Number(payload.failed_count ?? 0) === 0 && (successCount >= 1 || accepted);
	return { success };
}
