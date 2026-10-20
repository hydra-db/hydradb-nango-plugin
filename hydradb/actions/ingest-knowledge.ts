import type { NangoAction, IngestInput, IngestOutput } from '../../models';

/**
 * Ingest a note as knowledge into HydraDB through the Nango proxy.
 * @param nango - The Nango action context.
 * @param input - The note text and optional title.
 * @returns An object reporting whether the ingest was accepted.
 */
export default async function runAction(nango: NangoAction, input: IngestInput): Promise<IngestOutput> {
	const { database, collection = '' } = await nango.getMetadata<{ database: string; collection?: string }>();
	const item = { id: `nango-${Date.now()}`, title: input.title || 'note', content: { text: input.text }, infer: true };
	const boundary = `----hydradb${Date.now()}`;
	const field = (name: string, value: string) =>
		`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
	const body =
		field('tenant_id', database) +
		field('sub_tenant_id', collection) +
		field('kind', 'knowledge') +
		field('app_knowledge', JSON.stringify([item])) +
		`--${boundary}--\r\n`;
	const res = await nango.proxy({
		method: 'POST',
		endpoint: '/context/ingest',
		headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
		data: body,
	});
	return { success: Boolean(res.data?.success ?? res.data?.data?.success) };
}
