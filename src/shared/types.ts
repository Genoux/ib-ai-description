export interface ProfileData {
  username: string;
  fullname: string;
  bio: string;
  location: string;
  followers: number;
  engagement: number;
  hashtags: string;
}

export interface AnalysisResult {
  totalProfiles: number;
  totalEstimatedInputTokens: number;
  totalEstimatedOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  averageEstimatedTokensPerProfile: number;
}

export interface ExecutionResult {
  profileData: ProfileData;
  description: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}