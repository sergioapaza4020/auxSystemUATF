import {
  DeleteObjectCommand,
  GetBucketAclCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { AvatarStorage } from './avatar-storage.service';

jest.mock('@aws-sdk/client-s3', () => ({
  ...jest.requireActual<typeof import('@aws-sdk/client-s3')>('@aws-sdk/client-s3'),
  S3Client: jest.fn(),
}));

describe('AvatarStorage', () => {
  const send = jest.fn<Promise<unknown>, [unknown]>();
  const destroy = jest.fn();
  const key = 'avatars/1/3f5556d2-1565-455a-9ecc-a0a1c3e7e3c0.webp';
  const headers = { Grants: [{ Grantee: { Type: 'CanonicalUser' }, Permission: 'FULL_CONTROL' }] };

  beforeEach(() => {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      AVATAR_STORAGE_BUCKET: 'profile-pictures',
      AWS_ENDPOINT_URL_S3: 'https://storage.test.invalid',
      AWS_REGION: 'us-east-1',
      AWS_ACCESS_KEY_ID: 'test-only',
      AWS_SECRET_ACCESS_KEY: 'test-only',
    });
    send.mockReset();
    jest.mocked(S3Client).mockImplementation(() => ({ send, destroy }) as unknown as S3Client);
  });

  afterEach(() => jest.restoreAllMocks());

  it('requires a private bucket and uses path-style requests without granting public access', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 403 }));
    const body = Buffer.from('body');
    const source = Readable.from(body);
    send
      .mockResolvedValueOnce(headers)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        Body: source,
        ContentType: 'image/webp',
        ContentLength: body.length,
      })
      .mockResolvedValueOnce({});
    const storage = new AvatarStorage();

    await storage.put(key, body);
    await expect(storage.get(key)).resolves.toBe(source);
    await storage.remove(key);
    expect(S3Client).toHaveBeenCalledWith(expect.objectContaining({ forcePathStyle: true }));
    expect(send.mock.calls.map(([command]) => (command as object).constructor)).toEqual([
      GetBucketAclCommand,
      PutObjectCommand,
      GetObjectCommand,
      DeleteObjectCommand,
    ]);
    const put = send.mock.calls[1][0] as PutObjectCommand;
    expect(put.input).toEqual({
      Bucket: 'profile-pictures',
      Key: key,
      Body: body,
      ContentType: 'image/webp',
      CacheControl: 'private, no-store',
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    [404, headers],
    [403, { Grants: [{ Grantee: { URI: 'http://acs.amazonaws.com/groups/global/AllUsers' } }] }],
  ])('rejects a storage endpoint that fails its private access check (%s)', async (status, acl) => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status }));
    send.mockResolvedValueOnce(acl);
    await expect(new AvatarStorage().put(key, Buffer.from('image'))).rejects.toThrow(
      'almacenamiento privado',
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalled();
  });
});
