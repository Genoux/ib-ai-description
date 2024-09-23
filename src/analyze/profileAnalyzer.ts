import { ProfileData } from '../shared/types';
import { encode, encodeChat } from 'gpt-tokenizer';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const pricingConfig = {
    inputCostPerMillionTokens: 5,  // $0.03 per 1K tokens
    outputCostPerMillionTokens: 15  // $0.06 per 1K tokens
};

export function analyzeProfile(profile: ProfileData) {
  const chatInput = simulateChatInput(profile);
  const inputTokens = encodeChat(chatInput, 'gpt-4o').length;
  const outputTokens = estimateOutputTokens(profile);
  const estimatedCost = calculateCost(inputTokens, outputTokens);

  console.log({
    username: profile.username,
    inputTokens,
    outputTokens,
    estimatedCost
  });

  return {
    totalEstimatedInputTokens: inputTokens,
    totalEstimatedOutputTokens: outputTokens,
    estimatedCost,
  };
}

function simulateChatInput(profile: ProfileData): ReadonlyArray<ChatMessage> {
  return [
    { role: 'system', content: 'You are a helpful assistant that creates brief profile descriptions.' },
    { role: 'user', content: `Please provide a brief description for the following profile:\n${JSON.stringify(profile, null, 2)}` },
    { role: 'assistant', content: 'Certainly! I\'ll create a brief description based on the provided profile information.' }
  ];
}

function estimateOutputTokens(profile: ProfileData): number {
  // Create a sample output based on the profile data
  const sampleOutput = `${profile.fullname} is a ${profile.bio.split(' ')[0]} from ${profile.location}. With ${profile.followers} followers, they engage their audience with content related to ${profile.hashtags}.`;
  return encode(sampleOutput).length;
}

function calculateCost(inputTokens: number, outputTokens: number): number {
  const { inputCostPerMillionTokens, outputCostPerMillionTokens } = pricingConfig;
  const inputCost = (inputTokens / 1000000) * inputCostPerMillionTokens;
  const outputCost = (outputTokens / 1000000) * outputCostPerMillionTokens;
  return inputCost + outputCost;
}