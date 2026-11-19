import type { NangoAction, QueryInput, ContextEnvelope } from '../../models';
import { queryBody } from '../query.ts';

export default async function runAction(nango: NangoAction, input: QueryInput): Promise<ContextEnvelope> {
	const metadata = await nango.getMetadata<{ database: string; collection?: string; layout?: string }>();
	const res = await nango.post({ endpoint: '/query', data: queryBody(metadata, input) });
	return res.data;
}
