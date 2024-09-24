import { deployBatches } from './execute/batchDeploy';

async function main() {
  console.log('Starting batch analysis process...');
  await deployBatches();
  console.log('Batch analysis process completed.');
}

main().catch(console.error);