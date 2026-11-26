import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetBucketAclCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const bucketName = 'profile-pictures';

@Injectable()
export class AvatarStorage {
  private verified?: Promise<S3Client>;

  private connection(): Promise<S3Client> {
    this.verified ??= this.verifyPrivateBucket().catch(() => {
      this.verified = undefined;
      throw new ServiceUnavailableException(
        'No se pudo comprobar el almacenamiento privado de fotografías.',
      );
    });
    return this.verified;
  }

  private async verifyPrivateBucket() {
    const {
      AWS_ENDPOINT_URL_S3: endpoint,
      AWS_REGION: region,
      AWS_ACCESS_KEY_ID: accessKeyId,
      AWS_SECRET_ACCESS_KEY: secretAccessKey,
      AVATAR_STORAGE_BUCKET: bucket,
    } = process.env;
    if (!endpoint || !region || !accessKeyId || !secretAccessKey || bucket !== bucketName) {
      throw new ServiceUnavailableException(
        'El almacenamiento de fotografías no está configurado.',
      );
    }
    const base = new URL(endpoint);
    if (
      base.protocol !== 'https:' ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      base.pathname !== '/'
    ) {
      throw new ServiceUnavailableException('El endpoint de almacenamiento no es válido.');
    }
    const client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      maxAttempts: 2,
    });
    const abortSignal = AbortSignal.timeout(5500);
    try {
      const [acl, anonymous] = await Promise.all([
        client.send(new GetBucketAclCommand({ Bucket: bucketName }), { abortSignal }),
        fetch(new URL(`/${bucketName}/avatars/privacy-check-${randomUUID()}`, base), {
          method: 'HEAD',
          redirect: 'error',
          signal: abortSignal,
        }),
      ]);
      if (
        !acl.Grants?.length ||
        acl.Grants.some((grant) =>
          /\/(AllUsers|AuthenticatedUsers)$/.test(grant.Grantee?.URI ?? ''),
        ) ||
        (anonymous.status !== 401 && anonymous.status !== 403)
      ) {
        throw new ServiceUnavailableException('El bucket debe tener acceso privado.');
      }
      // Neon fixes the access level for the lifetime of a bucket.
      return client;
    } catch (error) {
      client.destroy();
      throw error;
    }
  }

  async put(key: string, body: Buffer) {
    await (
      await this.connection()
    ).send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: 'image/webp',
        CacheControl: 'private, no-store',
      }),
      { abortSignal: AbortSignal.timeout(8000) },
    );
  }

  async get(key: string): Promise<Readable | null> {
    try {
      const result = await (
        await this.connection()
      ).send(
        new GetObjectCommand({
          Bucket: bucketName,
          Key: key,
        }),
        { abortSignal: AbortSignal.timeout(8000) },
      );
      if (
        !(result.Body instanceof Readable) ||
        result.ContentType !== 'image/webp' ||
        !result.ContentLength ||
        result.ContentLength > AVATAR_MAX_BYTES
      ) {
        if (result.Body instanceof Readable) result.Body.destroy();
        throw new ServiceUnavailableException('La fotografía almacenada no está disponible.');
      }
      return result.Body;
    } catch (error) {
      if (error instanceof Error && error.name === 'NoSuchKey') return null;
      throw new ServiceUnavailableException('No pudimos consultar la fotografía.');
    }
  }

  async remove(key: string) {
    await (
      await this.connection()
    ).send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
      { abortSignal: AbortSignal.timeout(8000) },
    );
  }
}
