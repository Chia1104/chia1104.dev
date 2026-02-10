import type {
  S3Client,
  ObjectCannedACL,
  PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import {
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  ListBucketsCommand,
  ListObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "./env";
import { s3Client } from "./s3.client";

interface GlobalOptions {
  /**
   * The prefix to use for the keys.
   */
  prefix?: string;
  /**
   * The bucket to use for the files.
   */
  bucket?: string;
  /**
   * Whether to use ACL for the files.
   * @default false
   * @description If true, the files will be public readable ("public-read").
   */
  useACL?: boolean;
}

/**
 * The S3 service.
 * @param client - The client to use for the S3 service.
 * @param options - The options to use for the S3 service.
 */
export class S3Service {
  constructor(
    private readonly client: S3Client = s3Client,
    private readonly options: GlobalOptions = {}
  ) {}

  /**
   * Get the key for the file.
   * @param key - The key to get the full key for.
   * @returns The full key.
   */
  private getKey(key: string): string {
    return `${this.options.prefix ?? ""}${key}`;
  }

  private getBucket(bucket?: string): string {
    return bucket ?? this.options.bucket ?? env.S3_BUCKET_NAME;
  }

  private getACL(
    useACL?: boolean,
    acl?: ObjectCannedACL
  ): ObjectCannedACL | undefined {
    return useACL
      ? "public-read"
      : (acl ?? this.options.useACL)
        ? "public-read"
        : undefined;
  }

  /**
   * Create a signed URL for the file.
   * Used for uploading the file.
   * @param key - The key to create the pre-signed URL for.
   * @param bucket - The bucket to use for the file.
   * @returns The signed URL for uploading the file.
   */
  public async createSignedUrlForUpload(
    key: string,
    content: {
      sha256Checksum: string;
      type: string;
      size: number;
    },
    options?: {
      bucket?: string;
      expiresIn?: number;
      useACL?: boolean;
    }
  ): Promise<{
    url: string;
  }> {
    const command = new PutObjectCommand({
      Bucket: this.getBucket(options?.bucket),
      Key: this.getKey(key),
      ACL: this.getACL(options?.useACL),
      ChecksumSHA256: content.sha256Checksum,
      ContentType: content.type,
      ContentLength: content.size,
    });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: options?.expiresIn ?? 3600,
    });

    return {
      url,
    };
  }

  /**
   * Create a signed URL for the file.
   * Used for previewing the file.
   * @param key - The key to create the pre-signed URL for.
   * @param bucket - The bucket to use for the file.
   * @returns The signed URL for previewing the file.
   */
  public async createSignedUrlForPreview(
    key: string,
    options?: {
      bucket?: string;
      expiresIn?: number;
    }
  ): Promise<string> {
    const { bucket, ...rest } = options ?? {};
    return await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.getBucket(bucket),
        Key: this.getKey(key),
      }),
      rest
    );
  }

  /**
   * Delete the file.
   * @param key - The key to delete the file for.
   * @param bucket - The bucket to use for the file.
   * @returns The result of the delete operation.
   */
  public async deleteFile(key: string, bucket?: string) {
    return await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.getBucket(bucket),
        Key: this.getKey(key),
      })
    );
  }

  /**
   * Delete the files.
   * @param keys - The keys to delete the files for.
   * @param bucket - The bucket to use for the files.
   * @returns The result of the delete operation.
   */
  public async deleteFiles(keys: string[], bucket?: string) {
    return await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.getBucket(bucket),
        Delete: {
          Objects: keys.map((key) => ({ Key: this.getKey(key) })),
        },
      })
    );
  }

  /**
   * Get the content of the file.
   * @param key - The key to get the content for.
   * @param bucket - The bucket to use for the file.
   * @returns The content of the file.
   */
  public async getFileContent(key: string, bucket?: string): Promise<string> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.getBucket(bucket),
        Key: this.getKey(key),
      })
    );

    if (!response.Body) {
      throw new Error(`No body in response with ${key}`);
    }

    return response.Body.transformToString();
  }

  /**
   * Get the byte array of the file.
   * @param key - The key to get the byte array for.
   * @param bucket - The bucket to use for the file.
   * @returns The byte array of the file.
   */
  public async getFileByteArray(
    key: string,
    bucket?: string
  ): Promise<Uint8Array> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.getBucket(bucket),
        Key: this.getKey(key),
      })
    );

    if (!response.Body) {
      throw new Error(`No body in response with ${key}`);
    }

    return response.Body.transformToByteArray();
  }

  public async createBucket(bucket: string) {
    return await this.client.send(new CreateBucketCommand({ Bucket: bucket }));
  }

  public async deleteBucket(bucket: string) {
    return await this.client.send(new DeleteBucketCommand({ Bucket: bucket }));
  }

  public async listBuckets() {
    return await this.client.send(new ListBucketsCommand({}));
  }

  public async listObjects(bucket?: string) {
    return await this.client.send(
      new ListObjectsCommand({ Bucket: this.getBucket(bucket) })
    );
  }

  public async getObject(key: string, bucket?: string) {
    return await this.client.send(
      new GetObjectCommand({ Bucket: this.getBucket(bucket), Key: key })
    );
  }

  public async putObject(
    bucket: string,
    key: string,
    body: PutObjectCommandInput["Body"]
  ) {
    return await this.client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: body })
    );
  }

  public async deleteObject(bucket: string, key: string) {
    return await this.client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key })
    );
  }
}

export const s3Service = new S3Service();
