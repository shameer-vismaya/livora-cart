import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { loadAppEnv } from '../config';

/** Presigned uploads to S3-compatible storage (MinIO local; S3 prod). */
@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly env = loadAppEnv();
  private readonly client = new S3Client({
    region: 'us-east-1',
    endpoint: this.env.S3_ENDPOINT,
    forcePathStyle: true, // required for MinIO
    credentials: { accessKeyId: this.env.S3_ACCESS_KEY, secretAccessKey: this.env.S3_SECRET_KEY },
  });

  async presignPut(key: string, contentType: string): Promise<string> {
    const cmd = new PutObjectCommand({
      Bucket: this.env.S3_BUCKET,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, cmd, { expiresIn: 300 });
  }

  publicUrl(key: string): string {
    const base = this.env.S3_PUBLIC_BASE_URL ?? `${this.env.S3_ENDPOINT}/${this.env.S3_BUCKET}`;
    return `${base}/${key}`;
  }
}
