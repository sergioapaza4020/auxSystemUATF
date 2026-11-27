import { createTransport } from 'nodemailer';
import sharp from 'sharp';
import { diagnosticEmail, emailChangeNotice, verificationEmail } from './institutional-email';

const address = 'nuevo@example.test';
const link = 'https://frontend.test/account/verify-email?view=mail&locale=es#token=fixture';

describe('institutional email', () => {
  it('includes the PNG as an inline MIME part with a matching HTML Content-ID', async () => {
    const message = await verificationEmail(address, link);
    const [image] = message.inlineImages ?? [];
    expect(image).toMatchObject({
      cid: 'uatf-system-logo',
      filename: 'logo.png',
      contentType: 'image/png',
    });
    expect(await sharp(image.content).metadata()).toMatchObject({ format: 'png' });
    expect(message.html).toContain('src="cid:uatf-system-logo"');
    expect(message.html).toContain('alt="Logo del Sistema Académico UATF"');
    expect(message.html.indexOf('src="cid:')).toBeLessThan(
      message.html.indexOf('>Sistema Académico UATF</td>'),
    );

    const { inlineImages, ...parts } = message;
    const transport = createTransport({ streamTransport: true, buffer: true });
    const result = await transport.sendMail({
      ...parts,
      from: 'uatf@example.test',
      attachments: inlineImages?.map((asset) => ({ ...asset, contentDisposition: 'inline' })),
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    const raw = (result.message as Buffer).toString('utf8');
    expect(raw).toMatch(/Content-Type: multipart\/alternative/i);
    expect(raw).toMatch(/Content-Type: multipart\/related/i);
    expect(raw).toMatch(/Content-ID: <uatf-system-logo>/i);
    expect(raw).toMatch(/Content-Disposition: inline; filename=logo\.png/i);
    expect(raw).toMatch(/Content-Type: text\/plain/i);
  });

  it('keeps the link intact in plain text and escapes dynamic HTML', async () => {
    const message = await verificationEmail('"<X>"@example.test', link);
    expect(message.subject).toBe('Confirma tu nuevo correo electrónico');
    expect(message.html).toContain('&quot;&lt;X&gt;&quot;@example.test');
    expect(message.html).toContain('view=mail&amp;locale=es#token=fixture');
    expect(message.html).not.toContain('<X>');
    expect(message.text).toContain(link);
    expect(message.text).toContain('Este enlace vence en 15 minutos.');
    expect(message.text).toContain('Tu correo actual seguirá siendo el mismo.');
    expect(message.text).not.toMatch(/cid:|<p>/);
  });

  it('reuses the institutional header in the notice and keeps the diagnostic link synthetic', async () => {
    const notice = await emailChangeNotice(address);
    const diagnostic = await diagnosticEmail(address);
    expect(notice.html).toContain('src="cid:uatf-system-logo"');
    expect(notice.html).not.toContain('<a href=');
    expect(notice.text).toContain('contacta al administrador');
    expect(diagnostic.html).toContain('href="https://example.invalid/"');
    expect(diagnostic.text).not.toContain('#token=');
  });

  it('keeps the title and action when the PNG cannot be read', async () => {
    try {
      await jest.isolateModulesAsync(async () => {
        jest.doMock('node:fs/promises', () => ({
          readFile: jest.fn().mockRejectedValue(new Error('unavailable PNG')),
        }));
        const { verificationEmail: renderWithoutLogo } = jest.requireActual<{
          verificationEmail: typeof verificationEmail;
        }>('./institutional-email');
        const message = await renderWithoutLogo(address, link);
        expect(message.inlineImages).toBeUndefined();
        expect(message.html).not.toContain('cid:');
        expect(message.html).toContain('Sistema Académico UATF');
        expect(message.html).toContain('Confirmar correo electrónico</a>');
      });
    } finally {
      jest.dontMock('node:fs/promises');
    }
  });
});
