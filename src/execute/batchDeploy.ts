import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import { CONFIG } from '@/shared/config';

const openai = new OpenAI({ apiKey: CONFIG.OPENAI_API_KEY });

const RPM_LIMIT = 500;
const BATCH_QUEUE_LIMIT = 2_000_000;

interface BatchInfo {
  fileName: string;
  filePath: string;
  tokenCount: number;
}

class RateLimiter {
  private tokens: number = RPM_LIMIT;
  private lastRefill: number = Date.now();

  async waitForToken(): Promise<void> {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    this.tokens = Math.min(RPM_LIMIT, this.tokens + timePassed * (RPM_LIMIT / 60000));
    this.lastRefill = now;

    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) * (60000 / RPM_LIMIT);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.waitForToken();
    }

    this.tokens -= 1;
  }
}

const rateLimiter = new RateLimiter();

async function getQueuedBatches(): Promise<string[]> {
  const batches = await openai.batches.list();
  return batches.data
    .filter(batch => ['pending', 'in_progress'].includes(batch.status))
    .map(batch => batch.id);
}

async function waitForQueueSpace(requiredTokens: number, currentQueuedTokens: number) {
  while (currentQueuedTokens + requiredTokens > BATCH_QUEUE_LIMIT) {
    console.log("Waiting for queue space...");
    await new Promise(resolve => setTimeout(resolve, 60000)); // Wait for 1 minute
    const queuedBatches = await getQueuedBatches();
    currentQueuedTokens = queuedBatches.length * (BATCH_QUEUE_LIMIT / 2); // Rough estimate
  }
  return currentQueuedTokens;
}

async function submitBatch(batchInfo: BatchInfo): Promise<string> {
  await rateLimiter.waitForToken();
  console.log(`Uploading batch file: ${batchInfo.fileName}`);
  const batchInputFile = await openai.files.create({
    file: fs.createReadStream(batchInfo.filePath),
    purpose: 'batch'
  });

  await rateLimiter.waitForToken();
  console.log(`Creating batch for file: ${batchInfo.fileName}`);
  const batch = await openai.batches.create({
    input_file_id: batchInputFile.id,
    endpoint: "/v1/chat/completions",
    completion_window: "24h"
  });

  console.log(`Batch created successfully for file: ${batchInfo.fileName}, Batch ID: ${batch.id}`);
  return batch.id;
}

export async function deployBatches() {
  const batchFiles = fs.readdirSync(CONFIG.RESULTS_DIR)
    .filter(file => file.endsWith('_input.jsonl'))
    .sort((a: any, b: any) => {
      const numA = parseInt(a.match(/\d+/)[0]);
      const numB = parseInt(b.match(/\d+/)[0]);
      return numA - numB;
    });

  if (batchFiles.length === 0) {
    console.log('No batch files found in the results directory.');
    return;
  }

  console.log(`Found ${batchFiles.length} batch files to deploy.`);
  console.log("Batch files in order of processing:");
  batchFiles.forEach(file => console.log(file));

  const getMaxTokensFromFile = (file: string): number | null => {
    const content = fs.readFileSync(path.join(CONFIG.RESULTS_DIR, file), 'utf-8');
    const match = content.split('\n')[0].match(/"max_tokens":(\d+)/);
    return match ? parseInt(match[1]) : null;
  };

  const batchInfos: BatchInfo[] = batchFiles.map(file => ({
    fileName: file,
    filePath: path.join(CONFIG.RESULTS_DIR, file),
    tokenCount: (getMaxTokensFromFile(file) ?? 0) * 3 // Rough estimate
  }));

  const results: { fileName: string; batchId: string; error?: string }[] = [];
  let currentQueuedTokens = 0;

  for (const batchInfo of batchInfos) {
    currentQueuedTokens = await waitForQueueSpace(batchInfo.tokenCount, currentQueuedTokens);

    try {
      const batchId = await submitBatch(batchInfo);
      currentQueuedTokens += batchInfo.tokenCount;
      results.push({ fileName: batchInfo.fileName, batchId });
    } catch (error) {
      console.error(`Failed to submit batch ${batchInfo.fileName}:`, error);
      results.push({
        fileName: batchInfo.fileName,
        batchId: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay between submissions
  }

  console.log("\nBatch Submission Results:");
  results.forEach(result => {
    if (result.error) {
      console.log(`${result.fileName}: FAILED - ${result.error}`);
    } else {
      console.log(`${result.fileName}: Submitted (Batch ID: ${result.batchId})`);
    }
  });

  console.log("\nAll batches have been submitted. Check your OpenAI dashboard for processing status.");
}