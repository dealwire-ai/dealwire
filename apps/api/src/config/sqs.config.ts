export interface SQSConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  normalizedEmailQueueUrl: string;
  underwritingQueueUrl: string;
}

export const sqsConfig = (): SQSConfig => ({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  region: process.env.AWS_REGION || 'us-east-1',
  normalizedEmailQueueUrl: process.env.AWS_NORMALIZED_EMAIL_QUEUE_URL || '',
  underwritingQueueUrl: process.env.AWS_UNDERWRITING_QUEUE_URL || '',
});
