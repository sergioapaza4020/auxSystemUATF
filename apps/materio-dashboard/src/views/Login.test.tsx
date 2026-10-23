import * as React from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { login } from '../api/auth.service';

import Login from './Login';

const { replace, showError } = vi.hoisted(() => ({ replace: vi.fn(), showError: vi.fn() }));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof React>('react');

  return { ...actual, useState: vi.fn(actual.useState), useRef: vi.fn(actual.useRef) };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('../api/auth.service', () => ({ login: vi.fn() }));
vi.mock('@/hooks/useSnackbar', () => ({ useSnackbar: () => ({ error: showError }) }));
vi.mock('@core/hooks/useSettings', () => ({ useSettings: () => ({ settings: { mode: 'light' } }) }));
vi.mock('@/components/auth/LoginBrandPanel', () => ({ default: () => null }));
vi.mock('@components/layout/shared/ModeDropdown', () => ({ default: () => null }));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

// Exercise the real handler with persistent hook values, then render with real MUI.
// The existing test environment has no browser DOM or client rendering dependency.
function mountLogin() {
  let showPassword = false;
  let loading = false;
  const lock = { current: false };

  const setLoading = vi.fn((value: React.SetStateAction<boolean>) => {
    loading = typeof value === 'function' ? value(loading) : value;
  });

  const setShowPassword = (value: React.SetStateAction<boolean>) => {
    showPassword = typeof value === 'function' ? value(showPassword) : value;
  };

  const nativeFormData = new FormData();

  nativeFormData.set('username', 'test-user');
  nativeFormData.set('password', 'test-password');
  vi.stubGlobal(
    'FormData',
    vi.fn(function () {
      return nativeFormData;
    }),
  );

  function render() {
    vi.mocked(React.useState)
      .mockImplementationOnce((() => [showPassword, setShowPassword]) as typeof React.useState)
      .mockImplementationOnce((() => [loading, setLoading]) as typeof React.useState);
    vi.mocked(React.useRef).mockImplementationOnce(() => lock);

    return Login({ mode: 'light' });
  }

  type FormProps = {
    component?: string;
    onSubmit?: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
    children?: React.ReactNode;
  };

  function findSubmit(node: React.ReactNode): NonNullable<FormProps['onSubmit']> | undefined {
    for (const child of React.Children.toArray(node)) {
      if (!React.isValidElement<FormProps>(child)) continue;
      if (child.props.component === 'form') return child.props.onSubmit;
      const submit = findSubmit(child.props.children);

      if (submit) return submit;
    }
  }

  const submit = findSubmit(render());

  if (!submit) throw new Error('Login form not found');

  const event = { preventDefault: vi.fn(), currentTarget: {} } as unknown as React.FormEvent<HTMLFormElement>;

  return { submit: () => submit(event), html: () => renderToStaticMarkup(render()), setLoading };
}

function expectBusy(html: string) {
  for (const name of ['username', 'password']) {
    const input = html.match(/<input\b[^>]*>/g)?.find((tag) => tag.includes(`name="${name}"`));

    expect(input).toContain('disabled=""');
  }

  const button = html.match(/<button\b[^>]*>/g)?.find((tag) => tag.includes('type="submit"'));

  expect(button).toContain('disabled=""');
  expect(html).toContain('Iniciando sesión...');
  expect(html).toContain('role="progressbar"');
}

describe('Login submit concurrency', () => {
  it('locks immediately, ignores repeated submits and stays busy after success until unmount', async () => {
    let resolveLogin = () => {};

    vi.mocked(login).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveLogin = resolve;
        }),
    );
    const view = mountLogin();
    const first = view.submit();

    expect(view.setLoading).toHaveBeenLastCalledWith(true);

    // Reuse the handler from before the busy render: fast clicks, Enter or programmatic submits.
    await view.submit();
    await view.submit();
    expect(login).toHaveBeenCalledTimes(1);
    expect(login).toHaveBeenCalledWith({ username: 'test-user', password: 'test-password' });
    expectBusy(view.html());
    resolveLogin();
    await first;
    expect(replace).toHaveBeenCalledExactlyOnceWith('/dashboard');
    expectBusy(view.html());
    await view.submit();
    expect(login).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(showError).not.toHaveBeenCalled();
  });

  it('unlocks after failure and lets the same credentials be retried', async () => {
    vi.mocked(login).mockRejectedValueOnce(new Error('Login failed')).mockResolvedValueOnce(undefined);
    const view = mountLogin();

    await view.submit();
    const html = view.html();
    const button = html.match(/<button\b[^>]*>/g)?.find((tag) => tag.includes('type="submit"'));

    expect(button).not.toContain('disabled');

    for (const name of ['username', 'password']) {
      expect(html.match(/<input\b[^>]*>/g)?.find((tag) => tag.includes(`name="${name}"`))).not.toContain('disabled');
    }

    expect(html).not.toContain('role="progressbar"');
    expect(showError).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
    await view.submit();
    expect(login).toHaveBeenCalledTimes(2);
    expect(login).toHaveBeenNthCalledWith(2, { username: 'test-user', password: 'test-password' });
    expect(replace).toHaveBeenCalledExactlyOnceWith('/dashboard');
    expectBusy(view.html());
  });
});

describe('Login credential autocomplete', () => {
  it('links registration verification to the public account check', () => {
    const html = renderToStaticMarkup(<Login mode='light' />);

    expect(html).toContain('href="/verify-account"');
    expect(html).toContain('Verificar mi registro');
    expect(html).not.toContain('href="/register"');
  });

  it('renders standard autocomplete attributes on the native form and inputs', () => {
    const html = renderToStaticMarkup(<Login mode='light' />);
    const form = html.match(/<form\b[^>]*>/)?.[0];
    const inputs = html.match(/<input\b[^>]*>/g) ?? [];
    const username = inputs.find((input) => input.includes('name="username"'));
    const password = inputs.find((input) => input.includes('name="password"'));

    expect(form).toContain('autoComplete="on"');
    expect(form).not.toContain('autoComplete="off"');
    expect(username).toContain('id="username"');
    expect(username).toContain('type="text"');
    expect(username).toContain('autoComplete="username"');
    expect(password).toContain('id="password"');
    expect(password).toContain('type="password"');
    expect(password).toContain('autoComplete="current-password"');
    expect(html).toContain('for="username"');
    expect(html).toContain('for="password"');
    expect(html).toContain('type="submit"');
  });
});
