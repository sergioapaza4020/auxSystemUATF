import { Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { MailMessage } from 'src/services/mail/mail.service';

const systemName = 'Sistema Académico UATF';
const logoCid = 'uatf-system-logo';
const logger = new Logger('InstitutionalEmail');
let logo: Promise<Buffer | undefined> | undefined;

function loadLogo() {
  logo ??= readFile(join(__dirname, 'assets', 'logo.png'))
    .then((asset) =>
      sharp(asset).resize(132, 132, { fit: 'inside', withoutEnlargement: true }).png().toBuffer(),
    )
    .catch(() => {
      logger.warn('No se pudo cargar core/mail/assets/logo.png. Se usará el encabezado de texto.');
      return undefined;
    });
  return logo;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

interface InstitutionalContent {
  to: string;
  subject: string;
  title: string;
  description: string;
  note: string;
  destination?: string;
  action?: { label: string; url: string };
  expiry?: string;
  code?: string;
  brand?: string;
}

async function renderInstitutionalEmail(content: InstitutionalContent): Promise<MailMessage> {
  const image = await loadLogo();
  const {
    title,
    description,
    note,
    destination,
    action,
    expiry,
    code,
    brand = systemName,
  } = content;
  const text = [
    brand,
    title,
    'Hola:',
    description,
    code,
    destination,
    action && `${action.label}: ${action.url}`,
    expiry,
    note,
    content.brand ? `${brand} · Mensaje automático` : 'Mensaje automático',
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    to: content.to,
    subject: content.subject,
    text,
    ...(image && {
      inlineImages: [
        { filename: 'logo.png', contentType: 'image/png', cid: logoCid, content: image },
      ],
    }),
    html: `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    @media screen and (max-width: 480px) {
      .outer { padding: 12px !important; }
      .section { padding-left: 20px !important; padding-right: 20px !important; }
      .headline { font-size: 25px !important; line-height: 31px !important; }
      .action { width: 100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#F3F6FC;color:#172B4D;font-family:Arial,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#F3F6FC">
    <tr><td class="outer" align="center" style="padding:32px 16px">
      <!--[if mso]><table role="presentation" width="600" align="center"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#FFFFFF"
        style="width:100%;max-width:600px;border:1px solid #DCE6F3;border-radius:12px;border-spacing:0;table-layout:fixed">
        <tr><td class="section" bgcolor="#102A56" style="padding:20px 32px;border-radius:11px 11px 0 0">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
            ${
              image
                ? `<td width="56" valign="middle" style="width:56px;padding:0">
              <img src="cid:${logoCid}" width="44" alt="Logo del Sistema Académico UATF"
                style="display:block;width:44px;height:auto;border:0;color:#FFFFFF;font-size:10px">
            </td>`
                : ''
            }
            <td valign="middle" style="color:#FFFFFF;font:700 19px/25px Arial,sans-serif">${escapeHtml(brand)}</td>
          </tr></table>
        </td></tr>
        <tr><td class="section" style="padding:32px 32px 26px">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:16px"><tr>
            <td aria-hidden="true" align="center" valign="middle" bgcolor="#E5F6F3" width="44" height="44"
              style="width:44px;height:44px;border-radius:22px;font:bold 23px/44px Arial,sans-serif;color:#11776C">✓</td>
          </tr></table>
          <h1 class="headline" style="margin:0 0 18px;color:#102A56;font:bold 30px/36px Arial,sans-serif">${escapeHtml(title)}</h1>
          <p style="margin:0 0 8px;font:16px/24px Arial,sans-serif">Hola:</p>
          <p style="margin:0 0 18px;font:16px/25px Arial,sans-serif">${escapeHtml(description)}</p>
          ${
            destination
              ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
            style="width:100%;table-layout:fixed;margin-bottom:24px">
            <tr><td bgcolor="#EAF2FF" style="padding:14px 16px;border-radius:8px">
              <p style="margin:0 0 4px;color:#5D6B82;font:bold 13px/18px Arial,sans-serif">Nueva dirección</p>
              <p style="margin:0;color:#102A56;font:bold 16px/23px Arial,sans-serif;overflow-wrap:anywhere;word-break:break-all">${escapeHtml(destination)}</p>
            </td></tr>
          </table>`
              : ''
          }
          ${
            action
              ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr><td align="center" style="padding:0 0 18px">
              <table class="action" role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                <tr><td align="center" bgcolor="#0050C8" style="border-radius:8px;mso-padding-alt:14px 22px">
                  <a href="${escapeHtml(action.url)}" style="display:block;padding:14px 22px;color:#FFFFFF;text-decoration:none;font:bold 16px/22px Arial,sans-serif;mso-padding-alt:0">${escapeHtml(action.label)}</a>
                </td></tr>
              </table>
            </td></tr>
          </table>`
              : ''
          }
          ${code ? `<p align="center" style="padding:14px;background:#EAF2FF;color:#102A56;font:bold 28px monospace;border-radius:8px">${escapeHtml(code)}</p>` : ''}
          ${expiry ? `<p align="center" style="margin:0 0 18px;color:#102A56;font:bold 14px/20px Arial,sans-serif">${escapeHtml(expiry)}</p>` : ''}
          <p style="margin:0;color:#5D6B82;font:14px/22px Arial,sans-serif">${escapeHtml(note)}</p>
        </td></tr>
        <tr><td class="section" align="center" bgcolor="#F8FAFE"
          style="padding:18px 32px;border-top:1px solid #E2EAF6;border-radius:0 0 11px 11px;color:#5D6B82;font:13px/20px Arial,sans-serif">
          ${escapeHtml(brand)} · Mensaje automático
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`,
  };
}

export function verificationEmail(to: string, link: string) {
  const title = 'Confirma tu nuevo correo electrónico';
  return renderInstitutionalEmail({
    to,
    subject: title,
    title,
    destination: to,
    description:
      'Recibimos una solicitud para actualizar el correo electrónico de tu cuenta. Confirma la nueva dirección para completar el cambio.',
    action: { label: 'Confirmar correo electrónico', url: link },
    expiry: 'Este enlace vence en 15 minutos.',
    note: 'Si no solicitaste este cambio, puedes ignorar este mensaje. Tu correo actual seguirá siendo el mismo.',
  });
}

export function emailChangeNotice(to: string) {
  const title = 'Se actualizó el correo de tu cuenta';
  return renderInstitutionalEmail({
    to,
    subject: title,
    title,
    description: 'El correo asociado a tu cuenta del Sistema Académico UATF cambió.',
    note: 'Si no reconoces esta operación, contacta al administrador del sistema.',
  });
}

export function diagnosticEmail(to: string) {
  return renderInstitutionalEmail({
    to,
    subject: '[Prueba local] Sistema Académico UATF',
    title: 'Prueba de correo institucional',
    description:
      'Este mensaje permite comprobar el encabezado y el diseño del correo de verificación.',
    action: { label: 'Botón de muestra', url: 'https://example.invalid/' },
    note: 'El botón es de demostración y no realiza cambios en tu cuenta.',
  });
}

export function recoveryCodeEmail(to: string, code: string, administratorLink?: string) {
  return renderInstitutionalEmail({
    to,
    brand: 'SIGAD UATF',
    subject: administratorLink
      ? 'Restablecimiento de contraseña solicitado — SIGAD UATF'
      : 'Recupera tu contraseña — SIGAD UATF',
    title: 'Recupera tu contraseña',
    description: administratorLink
      ? 'Un administrador solicitó restablecer la contraseña de tu cuenta. Abre el enlace e introduce este código:'
      : 'Recibimos una solicitud para restablecer la contraseña de tu cuenta. Utiliza el siguiente código:',
    action: administratorLink ? { label: 'Verificar código', url: administratorLink } : undefined,
    code: `${code.slice(0, 3)} ${code.slice(3)}`,
    expiry: 'Este código vence en 10 minutos.',
    note: administratorLink
      ? 'Si no reconoces esta solicitud, comunícate con el administrador del sistema.'
      : 'Si no solicitaste este cambio, puedes ignorar el mensaje. Tu contraseña actual seguirá siendo válida.',
  });
}

export function passwordResetNotice(to: string) {
  const title = 'Se actualizó la contraseña de tu cuenta';
  return renderInstitutionalEmail({
    to,
    brand: 'SIGAD UATF',
    subject: title,
    title,
    description: 'La contraseña de tu cuenta fue restablecida correctamente.',
    note: 'Si no realizaste este cambio, comunícate con el administrador del sistema.',
  });
}
