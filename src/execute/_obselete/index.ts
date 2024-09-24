import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { executeTask } from './taskExecutor';
import { CONFIG } from '@/shared/config';
import { ExecutionResult, ProfileData } from '@/shared/types';
import { DateTime } from 'luxon';

const TPM_LIMIT = 30000;
const TPD_LIMIT = 90000;

let tokenUsagePerMinute = 0;
let tokenUsagePerDay = 0;
let lastMinuteReset = DateTime.now();
let lastDayReset = DateTime.now().startOf('day');

function resetTokenUsage() {
  const now = DateTime.now();
  if (now.diff(lastMinuteReset, 'minutes').minutes >= 1) {
    tokenUsagePerMinute = 0;
    lastMinuteReset = now;
  }
  if (now.diff(lastDayReset, 'days').days >= 1) {
    tokenUsagePerDay = 0;
    lastDayReset = now.startOf('day');
  }
}

function updateTokenUsage(tokens: number) {
  resetTokenUsage();
  tokenUsagePerMinute += tokens;
  tokenUsagePerDay += tokens;
}

async function dynamicDelay(tokens: number) {
  updateTokenUsage(tokens);
  const remainingTPM = TPM_LIMIT - tokenUsagePerMinute;
  const delay = Math.max(1000, 60000 / (remainingTPM / tokens));
  await new Promise(resolve => setTimeout(resolve, delay));
}

function readProfileData(filePath: string): any[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { data } = matter(content);
  return data.profiles || [];
}

export async function runExecution(sampleFile?: string, limit?: number): Promise<void> {
  console.log(`Running in ${CONFIG.TEST_MODE ? 'TEST' : 'LIVE'} mode`);

  const files = sampleFile 
    ? [sampleFile] 
    : getAllMdFiles(CONFIG.PROFILES_DIR);

  const filesToProcess = limit ? files.slice(0, limit) : files;

  console.log(`Total files to process: ${filesToProcess.length}`);

  const results: ExecutionResult[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let i = 0; i < filesToProcess.length; i++) {
    const file = filesToProcess[i];
    console.log(`\nProcessing file ${i + 1} of ${filesToProcess.length}: ${file}`);

    const filePath = path.join(CONFIG.PROFILES_DIR, file);
    const profiles = readProfileData(filePath);
    
    console.log(`Found ${profiles.length} profiles in file`);

    if (Array.isArray(profiles)) {
      const updatedProfiles = [];
      for (let j = 0; j < profiles.length; j++) {
        const profile = profiles[j];
        console.log(`Processing profile ${j + 1} of ${profiles.length}: ${(profile as ProfileData).username}`);
        try {
          const result = await executeTask(profile as ProfileData);
          results.push(result);
          totalInputTokens += result.inputTokens;
          totalOutputTokens += result.outputTokens;
          updatedProfiles.push({
            ...profile,
            description: result.description
          });
          console.log(`Profile processed successfully. Tokens used: ${result.totalTokens}`);
          
          // Check if we're approaching the daily limit
          if (tokenUsagePerDay + result.totalTokens > TPD_LIMIT * 0.95) {
            console.log("Approaching daily token limit. Stopping execution.");
            return;
          }

          await dynamicDelay(result.totalTokens);
        } catch (error) {
          console.error(`Failed to process profile: ${(profile as ProfileData).username}`, error);
          updatedProfiles.push(profile);
        }
      }
      
      await writeUpdatedProfiles(file, updatedProfiles);
      console.log(`Updated profiles written for file: ${file}`);
    } else {
      console.error(`Unexpected data format in file: ${file}`);
    }

    console.log(`\nCompleted processing file ${i + 1} of ${filesToProcess.length}`);
    console.log(`Current total tokens used: ${totalInputTokens + totalOutputTokens}`);
  }

  const executionResult = {
    profiles: results,
    totalProfiles: results.length,
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    averageTokensPerProfile: Math.round((totalInputTokens + totalOutputTokens) / results.length),
  };

  if (CONFIG.TEST_MODE) {
    console.log('Test mode: Execution result would be written to:', path.join(CONFIG.RESULTS_DIR, 'execution_results-[gpt4o].json'));
  } else {
    if (!fs.existsSync(CONFIG.RESULTS_DIR)) {
      fs.mkdirSync(CONFIG.RESULTS_DIR, { recursive: true });
    }
    const resultPath = path.join(CONFIG.RESULTS_DIR, 'execution_results-[gpt4o].json');
    fs.writeFileSync(resultPath, JSON.stringify(executionResult, null, 2));
    console.log(`Execution results written to: ${resultPath}`);
  }

  console.log(`\nExecution complete. Total profiles processed: ${results.length}`);
  console.log(`Total tokens used: ${totalInputTokens + totalOutputTokens}`);
  console.log(`Average tokens per profile: ${executionResult.averageTokensPerProfile}`);
}

async function writeUpdatedProfiles(filename: string, profiles: any[]): Promise<void> {
  const outputDir = path.join(CONFIG.RESULTS_DIR, 'updated_profiles');
  const fullOutputPath = path.join(outputDir, filename);
 
  if (CONFIG.TEST_MODE) {
    console.log(`Test mode: Would write updated profiles to ${fullOutputPath}`);
    return;
  }

  const dirName = path.dirname(fullOutputPath);
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true });
  }
  const content = matter.stringify('', { profiles });
 
  fs.writeFileSync(fullOutputPath, content);
  console.log(`Updated profiles written to: ${fullOutputPath}`);
}

function getAllMdFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllMdFiles(file));
    } else {
      if (path.extname(file) === '.md') {
        results.push(path.relative(CONFIG.PROFILES_DIR, file));
      }
    }
  });

  return results;
}