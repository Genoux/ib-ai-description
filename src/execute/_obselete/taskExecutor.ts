import OpenAI from 'openai';
import { ProfileData, ExecutionResult } from '../../shared/types';
import { CONFIG } from '../../shared/config';

const openai = new OpenAI({
  apiKey: CONFIG.OPENAI_API_KEY,
});

export async function executeTask(profile: ProfileData): Promise<ExecutionResult> {
  const messages = createMessages(profile);

  if (CONFIG.TEST_MODE) {
    // Simulate API response in test mode
    console.log(`Test mode: Simulating API call for profile ${profile.username}`);
    return {
      profileData: profile,
      description: "This is a test description for " + profile.username,
      inputTokens: 50,
      outputTokens: 20,
      totalTokens: 70,
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      max_completion_tokens : 300,
    });

    const completion = response.choices[0].message.content || '';
    const usage = response.usage;

    if (!usage) {
      throw new Error('Usage data not available');
    }

    return {
      profileData: profile,
      description: completion,
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    };
  } catch (error) {
    console.error(`Error processing profile: ${profile.username}`, error);
    throw error;
  }
}

function createMessages(profile: ProfileData): Array<OpenAI.Chat.ChatCompletionMessageParam> {
  return [
    {
      role: 'system',
      content: 'You are a professional content writer creating concise, factual descriptions for social media influencers. Focus on key information and avoid use of emojis or excessive enthusiasm.'
    },
    {
      role: 'user',
      content: `Create a brief, professional description of approximately 25 words for the following social media profile. Focus on their profession and main content themes. Avoid using hashtags, emojis, or mentioning follower count.
Profile details:
${JSON.stringify(profile, null, 2)}`
    }
  ];
}