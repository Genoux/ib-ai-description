import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { executeTask } from './taskExecutor';
import { CONFIG } from '@/shared/config';
import { ExecutionResult, ProfileData } from '@/shared/types';

function readProfileData(filePath: string): any[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { data } = matter(content);
  return data.profiles || [];
}

export async function runExecution(sampleFile?: string): Promise<void> {
  const files = sampleFile ? [sampleFile] : fs.readdirSync(CONFIG.PROFILES_DIR);
  const results: ExecutionResult[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const file of files) {
    if (path.extname(file) === '.md') {
      const filePath = path.join(CONFIG.PROFILES_DIR, file);
      const profiles = readProfileData(filePath);
      
      if (Array.isArray(profiles)) {
        const updatedProfiles = [];
        for (const profile of profiles) {
          try {
            const result = await executeTask(profile as ProfileData);
            results.push(result);
            totalInputTokens += result.inputTokens;
            totalOutputTokens += result.outputTokens;

            // Add description to the profile
            updatedProfiles.push({
              ...profile,
              description: result.description
            });

            // Simple rate limiting: wait for 1 second between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
            console.error(`Failed to process profile: ${(profile as ProfileData).username}`, error);
            updatedProfiles.push(profile); // Keep original profile if processing failed
          }
        }
        
        // Write updated profiles back to file in output directory
        await writeUpdatedProfiles(file, updatedProfiles);
      } else {
        console.error(`Unexpected data format in file: ${file}`);
      }
    }
  }

  const executionResult = {
    profiles: results,
    totalProfiles: results.length,
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    averageTokensPerProfile: Math.round((totalInputTokens + totalOutputTokens) / results.length),
  };

  if (!fs.existsSync(CONFIG.RESULTS_DIR)) {
    fs.mkdirSync(CONFIG.RESULTS_DIR, { recursive: true });
  }

  fs.writeFileSync(
    path.join(CONFIG.RESULTS_DIR, 'execution_results-[gpt4o].json'),
    JSON.stringify(executionResult, null, 2)
  );

  console.log(`Execution complete. Total profiles processed: ${results.length}`);
  console.log(`Total tokens used: ${totalInputTokens + totalOutputTokens}`);
}

async function writeUpdatedProfiles(filename: string, profiles: any[]): Promise<void> {
  const outputDir = path.join(CONFIG.RESULTS_DIR, 'updated_profiles');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, filename);
  const content = matter.stringify('', { profiles });
  
  fs.writeFileSync(outputPath, content);
  console.log(`Updated profiles written to: ${outputPath}`);
}

// Function to run the execution for a sample file
export async function runSampleExecution(): Promise<void> {
  const sampleFile = 'sample.md';
  console.log(`Running sample execution on file: ${sampleFile}`);
  await runExecution(sampleFile);
}