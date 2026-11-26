import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

describe('MailService', () => {
  const config = {
    MAIL_PROVIDER: 'smtp',
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: '465',
    SMTP_SECURE: 'true',
    SMTP_USER: 'sender@example.test',
    SMTP_PASSWORD: 'fixture-private',
    SMTP_FROM: 'UATF<sender@example.test>',
  };
  const message = {
    to: 'receiver@example.test',
    subject: 'Prueba',
    text: 'texto',
    html: '<p>texto</p>',
  };
  const inline = {
    filename: 'logo.png',
    contentType: 'image/png',
    cid: 'uatf-system-logo',
    content: Buffer.from('fixture'),
  };
  const verify = jest.fn<Promise<boolean>, []>();
  const sendMail = jest.fn<Promise<{ accepted: string[] }>, [unknown]>();

  beforeEach(() => {
    jest.clearAllMocks();
    verify.mockResolvedValue(true);
    sendMail.mockResolvedValue({ accepted: [message.to] });
    jest
      .mocked(createTransport)
      .mockReturnValue({ verify, sendMail } as unknown as ReturnType<typeof createTransport>);
  });

  afterEach(() => jest.restoreAllMocks());

  it('validates SMTP lazily and verifies TLS without sending', async () => {
    const mail = new MailService(new ConfigService(config));
    expect(createTransport).not.toHaveBeenCalled();
    await mail.verifySmtp();
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        secure: true,
        tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
        logger: false,
        debug: false,
      }),
    );
    expect(verify).toHaveBeenCalledTimes(1);
    expect(sendMail).not.toHaveBeenCalled();
    await mail.send(message);
    expect(sendMail).toHaveBeenCalledWith({ ...message, from: config.SMTP_FROM });
  });

  it.each(['EAUTH', 'ETIMEDOUT'])('reports SMTP %s without provider details', async (code) => {
    const log = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    verify.mockRejectedValueOnce(Object.assign(new Error('fixture-private'), { code }));
    await expect(new MailService(new ConfigService(config)).verifySmtp()).rejects.toThrow(
      'no está disponible',
    );
    expect(log).toHaveBeenCalledWith({ event: 'mail_provider_failure', code });
    expect(JSON.stringify(log.mock.calls)).not.toContain('fixture-private');
  });

  it('rejects invalid sender and TLS combinations before contacting SMTP', async () => {
    const invalid = { ...config, SMTP_PORT: '587' };
    await expect(new MailService(new ConfigService(invalid)).verifySmtp()).rejects.toThrow(
      'no está disponible',
    );
    await expect(
      new MailService(new ConfigService({ ...config, SMTP_FROM: 'someone@example.test' })).send(
        message,
      ),
    ).rejects.toThrow('no está disponible');
    expect(createTransport).not.toHaveBeenCalled();
  });

  it('passes image bytes to Nodemailer as an inline attachment', async () => {
    await new MailService(new ConfigService(config)).send({ ...message, inlineImages: [inline] });
    expect(sendMail).toHaveBeenCalledWith({
      ...message,
      from: config.SMTP_FROM,
      attachments: [{ ...inline, contentDisposition: 'inline' }],
    });
  });

  it('sends through Resend and never falls back to SMTP when HTTPS fails', async () => {
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{}'))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }));
    const mail = new MailService(
      new ConfigService({
        ...config,
        MAIL_PROVIDER: 'https',
        MAIL_FROM: config.SMTP_FROM,
        MAIL_API_KEY: 'test-private',
      }),
    );
    await mail.send({ ...message, inlineImages: [inline] });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        redirect: 'error',
        body: JSON.stringify({
          from: config.SMTP_FROM,
          ...message,
          attachments: [
            {
              filename: inline.filename,
              content: inline.content.toString('base64'),
              content_id: inline.cid,
              content_type: inline.contentType,
            },
          ],
        }),
      }),
    );
    await expect(mail.send(message)).rejects.toThrow('no está disponible');
    expect(createTransport).not.toHaveBeenCalled();
  });
});
