import { prepareBatchesForPlatforms } from './execute/batchGenerate';

async function main() {
  console.log('Starting batch execution process...');
  await prepareBatchesForPlatforms();
  console.log('Batch submission process completed.');
}

main().catch(console.error);