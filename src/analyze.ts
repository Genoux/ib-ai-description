import { prepareAndAnalyzeBatches } from './execute/batchAnalyze';

async function main() {
  console.log('Starting batch analysis process...');
  await prepareAndAnalyzeBatches();
  console.log('Batch analysis process completed.');
}

main().catch(console.error);