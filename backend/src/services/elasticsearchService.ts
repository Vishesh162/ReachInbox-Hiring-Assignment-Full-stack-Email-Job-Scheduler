import { getEsClient, isElasticsearchReady } from '../config/elasticsearch.js';

export { isElasticsearchReady };

export const EMAILS_INDEX = 'reachinbox-emails';

export interface EmailDocument {
  id: string;
  campaignId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledFor: string;
  sentAt?: string | null;
  error?: string | null;
  createdAt: string;
}

/**
 * Ensures the Elasticsearch index and mapping exist
 */
export async function initializeElasticsearchIndex() {
  const es = getEsClient();
  if (!es) return;

  try {
    const exists = await es.indices.exists({ index: EMAILS_INDEX });
    if (!exists) {
      await es.indices.create({
        index: EMAILS_INDEX,
        mappings: {
          properties: {
            id: { type: 'keyword' },
            campaignId: { type: 'keyword' },
            senderId: { type: 'keyword' },
            recipient: { type: 'keyword' },
            subject: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            body: { type: 'text' },
            status: { type: 'keyword' },
            scheduledFor: { type: 'date' },
            sentAt: { type: 'date' },
            error: { type: 'text' },
            createdAt: { type: 'date' },
          },
        },
      });
      console.log(`[Elasticsearch] Created index '${EMAILS_INDEX}'`);
    }
  } catch (err: any) {
    console.warn('[Elasticsearch] Could not initialize index:', err.message);
  }
}

/**
 * Upsert email document into Elasticsearch
 */
export async function indexEmailDocument(doc: EmailDocument) {
  const es = getEsClient();
  if (!es) return;

  try {
    await es.update({
      index: EMAILS_INDEX,
      id: doc.id,
      doc,
      doc_as_upsert: true,
    });
  } catch (err: any) {
    console.warn(`[Elasticsearch] Failed to index document ${doc.id}:`, err.message);
  }
}

/**
 * Search emails by query string, status, or sender
 */
export async function searchEmails({
  query,
  status,
  senderId,
  page = 1,
  limit = 20,
}: {
  query?: string;
  status?: string;
  senderId?: string;
  page?: number;
  limit?: number;
}) {
  const es = getEsClient();
  if (!es) {
    return { total: 0, hits: [], esAvailable: false };
  }

  const mustClauses: any[] = [];

  if (status && status.trim()) {
    mustClauses.push({ term: { status: status.trim() } });
  }

  if (senderId && senderId.trim()) {
    mustClauses.push({ term: { senderId: senderId.trim() } });
  }

  if (query && query.trim()) {
    mustClauses.push({
      multi_match: {
        query: query.trim(),
        fields: ['recipient^3', 'subject^2', 'body'],
        fuzziness: 'AUTO',
      },
    });
  }

  const from = (page - 1) * limit;

  try {
    const response = await es.search({
      index: EMAILS_INDEX,
      from,
      size: limit,
      query: mustClauses.length > 0 ? { bool: { must: mustClauses } } : { match_all: {} },
      sort: [{ scheduledFor: { order: 'desc' } }],
    });

    const total = typeof response.hits.total === 'number'
      ? response.hits.total
      : (response.hits.total?.value || 0);

    const hits = response.hits.hits.map((h: any) => h._source);

    return { total, hits, esAvailable: true };
  } catch (err: any) {
    console.warn('[Elasticsearch Search Error]', err.message);
    return { total: 0, hits: [], esAvailable: false, error: err.message };
  }
}
