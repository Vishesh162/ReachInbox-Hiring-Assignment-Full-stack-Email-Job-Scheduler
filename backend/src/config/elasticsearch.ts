import { Client } from '@elastic/elasticsearch';
import { env } from './env.js';

let esClient: Client | null = null;
let isEsAvailable = false;

try {
  esClient = new Client({
    node: env.ELASTICSEARCH_NODE,
    requestTimeout: 3000,
    maxRetries: 2,
  });
} catch (err: any) {
  console.warn('[Elasticsearch Init Warning]', err.message);
}

export async function checkElasticsearchHealth(): Promise<boolean> {
  if (!esClient) return false;
  try {
    await esClient.ping();
    isEsAvailable = true;
    console.log('[Elasticsearch] Connected and healthy');
    return true;
  } catch (err: any) {
    isEsAvailable = false;
    console.warn('[Elasticsearch] Unavailable or not responding:', err.message);
    return false;
  }
}

export function getEsClient(): Client | null {
  return esClient;
}

export function isElasticsearchReady(): boolean {
  return isEsAvailable;
}
