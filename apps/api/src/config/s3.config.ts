export const s3Config = () => ({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  region: process.env.AWS_REGION || 'us-east-1',
  dealAttachmentsBucket: process.env.AWS_DEAL_ATTACHMENTS_S3_BUCKET_NAME || '',
});
