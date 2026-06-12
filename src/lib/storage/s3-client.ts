/**
 * S3 client singleton for avatar uploads.
 * Uses the same AWS credentials configured for VOD storage.
 */

import { S3Client } from '@aws-sdk/client-s3';

let _s3: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!_s3) {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION ?? 'eu-central-1';

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS credentials are not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.');
    }

    _s3 = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return _s3;
}

export function getS3Bucket(): string {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) {
    throw new Error('AWS_S3_BUCKET is not configured.');
  }
  return bucket;
}

export function getCdnBaseUrl(): string {
  return process.env.BUNNY_CDN_BASE_URL?.replace(/\/$/, '') ?? '';
}
