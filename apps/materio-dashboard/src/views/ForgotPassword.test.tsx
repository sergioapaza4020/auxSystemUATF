import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import ForgotPassword from './ForgotPassword';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/api/password-recovery.service', () => ({ passwordRecovery: vi.fn() }));

describe('Password recovery autocomplete', () => {
  it('requests no autocomplete on the request form and native email input, with no prefilled email', () => {
    const html = renderToStaticMarkup(<ForgotPassword />);
    const forms = html.match(/<form\b[^>]*>/g) ?? [];
    const email = html.match(/<input\b[^>]*>/g)?.find((input) => input.includes('name="email"'));

    expect(forms).toHaveLength(1);
    expect(forms[0]).toContain('autoComplete="off"');
    expect(email).toContain('autoComplete="off"');
    expect(email).toContain('type="email"');
    expect(email).toContain('required=""');
    expect(email).toContain('maxLength="254"');
    expect(email).not.toMatch(/\svalue=|\sreadonly=|\sdisabled=/i);
    expect(html).not.toMatch(/onpaste=|oncopy=/i);
  });

  it('preserves the separate recovery OTP step', () => {
    const html = renderToStaticMarkup(<ForgotPassword step='verify' />);
    const code = html.match(/<input\b[^>]*>/g)?.find((input) => input.includes('id="recovery-code"'));

    expect(code).toContain('autoComplete="one-time-code"');
    expect(code).toContain('inputMode="numeric"');
    expect(code).toContain('maxLength="6"');
    expect(code).toContain('value=""');
    expect(html.match(/<form\b[^>]*>/)?.[0]).not.toContain('autoComplete="off"');
  });

  it('preserves new-password semantics in the separate reset step', () => {
    const html = renderToStaticMarkup(<ForgotPassword step='reset' />);
    const passwords = html.match(/<input\b[^>]*>/g)?.filter((input) => input.includes('type="password"')) ?? [];

    expect(passwords).toHaveLength(2);

    for (const password of passwords) {
      expect(password).toContain('autoComplete="new-password"');
      expect(password).toContain('value=""');
    }
  });
});
