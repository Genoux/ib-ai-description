import { ProfileData } from '../shared/types';
import { encode, encodeChat } from 'gpt-tokenizer';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const pricingConfig = {
  inputCostPerToken: 0.000000075,  // $0.075 per 1M tokens
  outputCostPerToken: 0.000000300  // $0.300 per 1M tokens
};

export function analyzeProfile(profile: ProfileData) {
  const chatInput = simulateChatInput(profile);
  const inputTokens = encodeChat(chatInput, 'gpt-4o').length;
  const outputTokens = estimateOutputTokens(profile);
  const estimatedCost = calculateCost(inputTokens, outputTokens);

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

export function calculateCost(inputTokens: number, outputTokens: number): number {
  const { inputCostPerToken, outputCostPerToken } = pricingConfig;
  const inputCost = inputTokens * inputCostPerToken;
  const outputCost = outputTokens * outputCostPerToken;
  const totalCost = inputCost + outputCost;
  console.log(`Tokens: ${inputTokens} input, ${outputTokens} output`);
  console.log(`Costs: $${inputCost.toFixed(6)} input, $${outputCost.toFixed(6)} output, $${totalCost.toFixed(6)} total`);
  return totalCost;
}