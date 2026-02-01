import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

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

/**
 * Upload invoice PDF to S3
 */
export async function uploadInvoiceToS3(
  pdfBuffer: Buffer,
  orderId: string,
  fileName: string
): Promise<{ bucket: string; objectKey: string; region: string }> {
  const client = getS3Client();
  const { bucket, region } = getS3Config();
  
  const objectKey = `invoices/${orderId}/${fileName}`;
  
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    })
  );
  
  return { bucket, objectKey, region };
}

/**
 * Get invoice PDF from S3
 */
export async function getInvoiceFromS3(
  bucket: string,
  objectKey: string
): Promise<Buffer> {
  const client = getS3Client();
  
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
    })
  );
  
  if (!response.Body) {
    throw new Error("Empty response body from S3");
  }
  
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks);
}
