import { S3Client } from "@aws-sdk/client-s3";

let cachedClient: S3Client | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} environment variable`);
  }
  return value;
}

export function getS3Config() {
  const bucket = getRequiredEnv("S3_BUCKET");
  const region = getRequiredEnv("S3_REGION");
  const endpoint = process.env.S3_ENDPOINT?.trim();

  return {
    bucket,
    region,
    endpoint: endpoint || undefined,
  };
}

export function getS3Client(): S3Client {
  if (cachedClient) {
    return cachedClient;
  }

  const { region, endpoint } = getS3Config();
  const accessKeyId = getRequiredEnv("S3_ACCESS_KEY_ID");
  const secretAccessKey = getRequiredEnv("S3_SECRET_ACCESS_KEY");

  cachedClient = new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return cachedClient;
}
