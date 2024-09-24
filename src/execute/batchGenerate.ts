import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { CONFIG } from '@/shared/config';
import { ProfileData } from '@/shared/types';
import { encode } from 'gpt-tokenizer';

// Adjust these constants

const MAX_TOKENS_PER_SESSION = 2_000_000;
const ESTIMATED_TOKENS_PER_PROFILE = 300; // Adjust based on your actual data

interface BatchInfo {
  platform: string;
  sessionNumber: number;
  batchNumber: number;
  profiles: ProfileData[];
  tokenCount: number;
  filePath: string;
}


function prepareBatchInput(profiles: ProfileData[]): string {
  const batchInput = profiles.map((profile, index) => ({
    custom_id: `profile${index}`,
    method: "POST",
    url: "/v1/chat/completions",
    body: {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a professional content writer creating concise, factual descriptions for social media influencers. Focus on key information and avoid use of emojis or excessive enthusiasm."
        },
        {
          role: "user",
          content: `Create a brief, professional description of approximately 25 words for the following social media profile. Focus on their profession and main content themes. Avoid using hashtags, emojis, mentioning follower count, or including any contact information such as email addresses or phone numbers.

Profile details:
${JSON.stringify(profile, null, 2)}`
        }
      ],
      max_tokens: 100
    }
  }));

  return batchInput.map(input => JSON.stringify(input)).join('\n');
}

function calculateTokens(input: string): number {
  return encode(input).length;
}

async function prepareBatches(): Promise<BatchInfo[]> {
  const platforms = ['instagram', 'tiktok'];
  const batches: BatchInfo[] = [];

  for (const platform of platforms) {
    const platformDir = path.join(CONFIG.PROFILES_DIR, platform);
    const allProfiles = getAllProfiles(platformDir);

    let currentBatch: ProfileData[] = [];
    let currentSessionTokens = 0;
    let currentBatchTokens = 0;
    let sessionNumber = 1;
    let batchNumber = 1;

    for (const profile of allProfiles) {
      const profileTokens = ESTIMATED_TOKENS_PER_PROFILE;

      if (currentSessionTokens + currentBatchTokens + profileTokens > MAX_TOKENS_PER_SESSION) {
        // Save current batch if it's not empty
        if (currentBatch.length > 0) {
          const batchInputContent = prepareBatchInput(currentBatch);
          const filePath = path.join(CONFIG.RESULTS_DIR, `${platform}_session${sessionNumber}_batch${batchNumber}_input.jsonl`);
          fs.writeFileSync(filePath, batchInputContent);

          batches.push({
            platform,
            sessionNumber,
            batchNumber,
            profiles: currentBatch,
            tokenCount: currentBatchTokens,
            filePath
          });

          currentSessionTokens += currentBatchTokens;
          batchNumber++;
        }

        // Start new session if adding this profile would exceed the session limit
        if (currentSessionTokens + profileTokens > MAX_TOKENS_PER_SESSION) {
          sessionNumber++;
          currentSessionTokens = 0;
          batchNumber = 1;
        }

        // Start new batch
        currentBatch = [];
        currentBatchTokens = 0;
      }

      currentBatch.push(profile);
      currentBatchTokens += profileTokens;
    }

    // Save any remaining profiles in the last batch
    if (currentBatch.length > 0) {
      const batchInputContent = prepareBatchInput(currentBatch);
      const filePath = path.join(CONFIG.RESULTS_DIR, `${platform}_session${sessionNumber}_batch${batchNumber}_input.jsonl`);
      fs.writeFileSync(filePath, batchInputContent);

      batches.push({
        platform,
        sessionNumber,
        batchNumber,
        profiles: currentBatch,
        tokenCount: currentBatchTokens,
        filePath
      });
    }
  }

  return batches;
}


export async function prepareBatchesForPlatforms() {
  console.log("Preparing batches...");
  const batches = await prepareBatches();

  displayBatchInfo(batches);

  console.log('\nBatch files have been created. You can now upload them session by session to the OpenAI dashboard.');
  console.log('Batch files are located in:', CONFIG.RESULTS_DIR);
}

function displayBatchInfo(batches: BatchInfo[]) {
  const platforms = [...new Set(batches.map(b => b.platform))];
  let totalProfiles = 0;
  let totalTokens = 0;
  let totalSessions = 0;

  console.log("\nBatch Information:");
  for (const platform of platforms) {
    const platformBatches = batches.filter(b => b.platform === platform);
    const platformProfiles = platformBatches.reduce((sum, b) => sum + b.profiles.length, 0);
    const platformTokens = platformBatches.reduce((sum, b) => sum + b.tokenCount, 0);
    const platformSessions = new Set(platformBatches.map(b => b.sessionNumber)).size;

    totalProfiles += platformProfiles;
    totalTokens += platformTokens;
    totalSessions += platformSessions;

    console.log(`\n${platform.charAt(0).toUpperCase() + platform.slice(1)}:`);
    console.log(`  Total Profiles: ${platformProfiles}`);
    console.log(`  Total Batches: ${platformBatches.length}`);
    console.log(`  Total Sessions: ${platformSessions}`);
    console.log(`  Total Tokens: ${platformTokens}`);

    // Display information for each session and batch
    for (let i = 1; i <= platformSessions; i++) {
      const sessionBatches = platformBatches.filter(b => b.sessionNumber === i);
      const sessionTokens = sessionBatches.reduce((sum, b) => sum + b.tokenCount, 0);
      console.log(`    Session ${i}: ${sessionBatches.length} batches, ${sessionTokens} tokens`);
      sessionBatches.forEach(batch => {
        console.log(`      Batch ${batch.batchNumber}: ${batch.profiles.length} profiles, ${batch.tokenCount} tokens`);
      });
    }
  }

  console.log(`\nOverall Summary:`);
  console.log(`  Total Profiles: ${totalProfiles}`);
  console.log(`  Total Batches: ${batches.length}`);
  console.log(`  Total Sessions: ${totalSessions}`);
  console.log(`  Total Tokens: ${totalTokens}`);
  console.log(`\nEstimated cost: $${(totalTokens * 0.0001 / 1000).toFixed(2)} (assuming $0.0001 per 1K tokens)`);
}

function getAllProfiles(dir: string): ProfileData[] {
  let profiles: ProfileData[] = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      profiles = profiles.concat(getAllProfiles(fullPath));
    } else if (item === '_index.md') {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const { data } = matter(content);
      if (Array.isArray(data.profiles)) {
        profiles = profiles.concat(data.profiles);
      }
    }
  }

  return profiles;
}