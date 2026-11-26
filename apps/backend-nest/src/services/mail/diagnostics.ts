import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';
import { diagnosticEmail } from '../../core/mail/institutional-email';
import { MailService } from './mail.service';

async function main() {
  const mail = new MailService(new ConfigService());
  if (process.argv[2] === 'verify') {
    await mail.verifySmtp();
    console.log('Conexión TLS y autenticación SMTP verificadas.');
    return;
  }
  if (
    process.argv[2] !== 'send' ||
    process.env.NODE_ENV === 'production' ||
    (process.env.MAIL_PROVIDER && process.env.MAIL_PROVIDER !== 'smtp') ||
    process.env.RENDER
  ) {
    throw new Error('Local SMTP only');
  }
  const to = process.env.MAIL_TEST_TO?.trim();
  if (!to || !isEmail(to)) {
    console.error('Configura un destinatario privado válido en MAIL_TEST_TO.');
    process.exitCode = 1;
    return;
  }
  await mail.send(await diagnosticEmail(to));
  console.log('SMTP aceptó el mensaje. La entrega final requiere confirmación del destinatario.');
}

void main().catch(() => {
  console.error('El diagnóstico de correo no pudo completarse.');
  process.exitCode = 1;
});
