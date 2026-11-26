import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';
import { createTransport } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  inlineImages?: ReadonlyArray<{
    filename: string;
    contentType: string;
    cid: string;
    content: Buffer;
  }>;
}

interface MailProvider {
  send(message: MailMessage): Promise<void>;
  verify?(): Promise<void>;
}

function sender(value?: string) {
  const address = value?.match(/^[^<>\r\n]+<([^<>\r\n]+)>$/)?.[1]?.trim() ?? value;
  return address && isEmail(address) && !/[\r\n]/.test(value ?? '') ? address : undefined;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private provider?: MailProvider;

  constructor(private readonly config: ConfigService) {}

  assertConfigured() {
    if (this.provider) return;
    try {
      this.provider = this.createProvider();
    } catch (error) {
      this.logger.warn(
        error instanceof Error ? error.message : 'Configuración de correo inválida.',
      );
      throw this.unavailable();
    }
  }

  async send(message: MailMessage) {
    this.assertConfigured();
    try {
      if (!isEmail(message.to)) throw new Error('Invalid recipient');
      await this.provider!.send(message);
    } catch (error) {
      this.reportFailure(error);
      throw this.unavailable();
    }
  }

  async verifySmtp() {
    this.assertConfigured();
    if (!this.provider?.verify) throw this.unavailable();
    try {
      await this.provider.verify();
    } catch (error) {
      this.reportFailure(error);
      throw this.unavailable();
    }
  }

  private createProvider(): MailProvider {
    const get = (key: string) => this.config.get<string>(key)?.trim();
    const kind = get('MAIL_PROVIDER') || (get('SMTP_HOST') ? 'smtp' : 'disabled');
    if (kind === 'https') {
      const from = get('MAIL_FROM');
      const apiKey = get('MAIL_API_KEY');
      if (!from || !sender(from) || !apiKey)
        throw new Error('Configura MAIL_API_KEY y MAIL_FROM para Resend.');
      return {
        async send({ inlineImages, ...message }) {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from,
              ...message,
              ...(inlineImages?.length && {
                attachments: inlineImages.map(({ filename, content, cid, contentType }) => ({
                  filename,
                  content: content.toString('base64'),
                  content_id: cid,
                  content_type: contentType,
                })),
              }),
            }),
            signal: AbortSignal.timeout(7000),
            redirect: 'error',
          });
          if (!response.ok) throw new Error('HTTPS provider rejected message');
        },
      };
    }
    if (kind !== 'smtp') throw new Error('MAIL_PROVIDER debe configurar smtp o https.');
    const host = get('SMTP_HOST');
    const portText = get('SMTP_PORT');
    const secureText = get('SMTP_SECURE');
    const user = get('SMTP_USER');
    const pass = get('SMTP_PASSWORD');
    const from = get('SMTP_FROM');
    const port = Number(portText);
    if (!host || !/^[\w.-]+$/.test(host)) throw new Error('SMTP_HOST no es válido.');
    if (!portText || !/^\d+$/.test(portText) || port < 1 || port > 65535) {
      throw new Error('SMTP_PORT no es válido.');
    }
    if (
      !['true', 'false'].includes(secureText ?? '') ||
      (port === 465 && secureText !== 'true') ||
      (port === 587 && secureText !== 'false')
    ) {
      throw new Error('SMTP_SECURE no coincide con el modo TLS del puerto.');
    }
    if (!user || !isEmail(user) || !pass) throw new Error('Configura SMTP_USER y SMTP_PASSWORD.');
    if (!from || sender(from)?.toLowerCase() !== user.toLowerCase()) {
      throw new Error('SMTP_FROM debe contener la dirección autenticada de SMTP_USER.');
    }
    const secure = secureText === 'true';
    const transport = createTransport({
      host,
      port,
      secure,
      requireTLS: !secure,
      auth: { user, pass },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 7000,
      logger: false,
      debug: false,
      disableFileAccess: true,
      disableUrlAccess: true,
      tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    });
    return {
      async verify() {
        await transport.verify();
      },
      async send({ inlineImages, ...message }) {
        const result = await transport.sendMail({
          ...message,
          from,
          ...(inlineImages?.length && {
            attachments: inlineImages.map((image) => ({ ...image, contentDisposition: 'inline' })),
          }),
        });
        if (!result.accepted.includes(message.to)) throw new Error('SMTP recipient rejected');
      },
    };
  }

  private reportFailure(error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    const safeCode = ['EAUTH', 'ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'ETLS', 'EENVELOPE'].find(
      (item) => item === code,
    );
    this.logger.warn({ event: 'mail_provider_failure', code: safeCode ?? 'provider_error' });
  }

  private unavailable() {
    return new ServiceUnavailableException(
      'El servicio de correo no está disponible. Inténtalo más tarde.',
    );
  }
}
