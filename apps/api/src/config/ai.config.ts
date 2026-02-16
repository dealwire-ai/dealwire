export interface AIConfig {
  openaiApiKey: string;
  openaiModel: string;
  openaiScreeningModel: string;
  openaiTemperature: number;
}

export const aiConfig = (): AIConfig => {
  const apiKey = process.env.OPENAI_API_KEY || '';

  if (!apiKey || !apiKey.trim()) {
    throw new Error('OPENAI_API_KEY must be provided and cannot be empty');
  }

  return {
    openaiApiKey: apiKey.trim(),
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    openaiScreeningModel: process.env.OPENAI_SCREENING_MODEL || 'gpt-4o',
    openaiTemperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.0'),
  };
};
