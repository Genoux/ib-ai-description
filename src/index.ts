import { runAnalysis } from './analyze';
import { runExecution, runSampleExecution } from './execute';

async function main() {
 //console.log('Starting analysis...');
  //await runAnalysis();

  console.log('\nStarting execution...');
  await runSampleExecution();

  console.log('\nAll tasks completed.');
}

main().catch(console.error);