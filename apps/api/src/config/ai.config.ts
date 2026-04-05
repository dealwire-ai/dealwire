export interface AIConfig {
  openaiApiKey: string;
  openaiTemperature: number;
}

export const aiConfig = (): AIConfig => {
  const apiKey = process.env.OPENAI_API_KEY || '';

  if (!apiKey || !apiKey.trim()) {
    throw new Error('OPENAI_API_KEY must be provided and cannot be empty');
  }

  return {
    openaiApiKey: apiKey.trim(),
    openaiTemperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.0'),
  };
};
