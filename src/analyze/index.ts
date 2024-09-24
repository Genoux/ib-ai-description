import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { analyzeProfile, calculateCost } from './profileAnalyzer';
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
  console.log('Starting analysis...');

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
        console.log(`Profile ${totalProfiles}: Cost $${result.estimatedCost.toFixed(6)}`);
        if (totalProfiles % 1000 === 0) {
          console.log(`Processed ${totalProfiles} profiles:`);
          console.log({
            totalEstimatedInputTokens,
            totalEstimatedOutputTokens,
            totalCost: totalCost.toFixed(6)
          });
        }
      }
    }
  }

  const finalCost = calculateCost(totalEstimatedInputTokens, totalEstimatedOutputTokens);
  console.log(`Final calculated cost: $${finalCost.toFixed(4)}`);
  
  const analysisResult: AnalysisResult = {
    totalProfiles,
    totalEstimatedInputTokens,
    totalEstimatedOutputTokens,
    totalTokens: totalEstimatedInputTokens + totalEstimatedOutputTokens,
    totalCost: finalCost,
    averageEstimatedTokensPerProfile: Math.round((totalEstimatedInputTokens + totalEstimatedOutputTokens) / totalProfiles),
  };

  if (!fs.existsSync(CONFIG.RESULTS_DIR)) {
    fs.mkdirSync(CONFIG.RESULTS_DIR, { recursive: true });
  }

  fs.writeFileSync(
    path.join(CONFIG.RESULTS_DIR, 'analysis.json'),
    JSON.stringify(analysisResult, null, 2)
  );

  console.log(`Analysis complete. Total estimated cost: $${totalCost}`);
  console.log(`Total profiles analyzed: ${totalProfiles}`);
}