import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import { CONFIG } from '@/shared/config';
import { encode } from 'gpt-tokenizer';

const openai = new OpenAI({ apiKey: CONFIG.OPENAI_API_KEY });

const BATCH_QUEUE_LIMIT = 2_000_000;

interface BatchFileInfo {
  fileName: string;
  tokenCount: number;
  filePath: string;
}

function getBatchFileInfo(filePath: string): BatchFileInfo {
  const fileName = path.basename(filePath);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const tokenCount = encode(fileContent).length;
  return { fileName, tokenCount, filePath };
}

export async function analyzeBatchFiles() {
  const batchFiles = fs.readdirSync(CONFIG.RESULTS_DIR)
    .filter(file => file.endsWith('_input.jsonl'));

  if (batchFiles.length === 0) {
    console.log('No batch files found in the results directory.');
    return;
  }

  console.log(`Found ${batchFiles.length} batch files to analyze.`);

  const batchInfos: BatchFileInfo[] = [];
  let totalTokens = 0;

  for (const file of batchFiles) {
    const filePath = path.join(CONFIG.RESULTS_DIR, file);
    const batchInfo = getBatchFileInfo(filePath);
    batchInfos.push(batchInfo);
    totalTokens += batchInfo.tokenCount;
  }

  console.log('\nBatch File Analysis:');
  batchInfos.forEach(info => {
    console.log(`${info.fileName}: ${info.tokenCount} tokens`);
  });

  console.log(`\nTotal tokens across all files: ${totalTokens}`);
  console.log(`Batch Queue Limit: ${BATCH_QUEUE_LIMIT} tokens`);

  if (totalTokens > BATCH_QUEUE_LIMIT) {
    console.log('\nWARNING: The total token count exceeds the Batch Queue Limit.');
    console.log('You may need to split your batches into smaller files.');
  } else {
    console.log('\nThe total token count is within the Batch Queue Limit.');
  }

  return batchInfos;
}

export async function prepareAndAnalyzeBatches() {
  const batchInfos = await analyzeBatchFiles();
  
  if (!batchInfos) return;

  let finalBatchInfos: BatchFileInfo[] = [];

  console.log('\nFinal Batch File Analysis (after splitting if necessary):');
  finalBatchInfos.forEach(info => {
    console.log(`${info.fileName}: ${info.tokenCount} tokens`);
  });

  const totalTokens = finalBatchInfos.reduce((sum, info) => sum + info.tokenCount, 0);
  console.log(`\nTotal tokens across all files: ${totalTokens}`);
  console.log(`Batch Queue Limit: ${BATCH_QUEUE_LIMIT} tokens`);

  if (totalTokens > BATCH_QUEUE_LIMIT) {
    console.log('\nWARNING: The total token count still exceeds the Batch Queue Limit.');
    console.log('You will need to submit these batches in multiple sessions.');
  } else {
    console.log('\nThe total token count is within the Batch Queue Limit.');
    console.log('You can proceed with batch submission.');
  }
}