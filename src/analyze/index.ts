import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { analyzeProfile } from './profileAnalyzer';
import { CONFIG } from '../shared/config';
import { ProfileData, AnalysisResult } from '../shared/types';

function findIndexFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findIndexFiles(fullPath));
    } else if (file === '_index.md') {
      results.push(fullPath);
    }
  }
  
  return results;
}

export async function runAnalysis(): Promise<void> {
  const indexFiles = findIndexFiles(CONFIG.PROFILES_DIR);
  let totalProfiles = 0;
  let totalEstimatedInputTokens = 0;
  let totalEstimatedOutputTokens = 0;
  let totalCost = 0;

  for (const filePath of indexFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const { data } = matter(content);
    if (data.profiles && Array.isArray(data.profiles)) {
      for (const profile of data.profiles) {
        const result = analyzeProfile(profile);
        totalProfiles++;
        totalEstimatedInputTokens += result.totalEstimatedInputTokens;
        totalEstimatedOutputTokens += result.totalEstimatedOutputTokens;
        totalCost += result.estimatedCost;

        // // Log details for every 1000th profile
        // if (totalProfiles % 1000 === 0) {
        //   console.log(`Processed ${totalProfiles} profiles:`);
        //   console.log({
        //     totalEstimatedInputTokens,
        //     totalEstimatedOutputTokens,
        //     totalCost: totalCost.toFixed(6)
        //   });
        // }
      }
    }
  }

  const analysisResult: AnalysisResult = {
    totalProfiles,
    totalEstimatedInputTokens,
    totalEstimatedOutputTokens,
    totalTokens: totalEstimatedInputTokens + totalEstimatedOutputTokens,
    totalCost,
    averageEstimatedTokensPerProfile: Math.round((totalEstimatedInputTokens + totalEstimatedOutputTokens) / totalProfiles),
  };

  if (!fs.existsSync(CONFIG.RESULTS_DIR)) {
    fs.mkdirSync(CONFIG.RESULTS_DIR, { recursive: true });
  }

  fs.writeFileSync(
    path.join(CONFIG.RESULTS_DIR, 'analysis.json'),
    JSON.stringify(analysisResult, null, 2)
  );

  console.log(`Analysis complete. Total estimated cost: $${totalCost.toFixed(2)}`);
  console.log(`Total profiles analyzed: ${totalProfiles}`);
}

// Function to run the analysis
async function main() {
  console.log('Starting analysis...');
  await runAnalysis();
  console.log('Analysis completed.');
}

// Run the main function
main().catch(console.error);