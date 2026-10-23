import * as React from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { AxiosError, AxiosHeaders } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { checkRegistration } from '@/api/auth.service';
import VerifyAccount from './VerifyAccount';

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof React>('react');

  return { ...actual, useState: vi.fn(actual.useState), useRef: vi.fn(actual.useRef) };
});
vi.mock('@/api/auth.service', () => ({ checkRegistration: vi.fn() }));
vi.mock('@/components/auth/LoginBrandPanel', () => ({ default: () => null }));
vi.mock('@components/layout/shared/ModeDropdown', () => ({ default: () => null }));

afterEach(() => vi.resetAllMocks());

// Follow Login's handler/SSR tests: this project has no browser DOM test dependency.
function mount() {
  const values: unknown[] = ['', { status: 'IDLE' }, false];
  const lock = { current: false };

  function render() {
    for (let index = 0; index < values.length; index++) {
      vi.mocked(React.useState).mockImplementationOnce((() => [
        values[index],
        (value: unknown) => {
          values[index] = value;
        },
      ]) as typeof React.useState);
    }

    vi.mocked(React.useRef).mockImplementationOnce(() => lock);

    return VerifyAccount();
  }

  type Props = {
    component?: string;
    name?: string;
    children?: React.ReactNode;
    onSubmit?: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  };

  function find(node: React.ReactNode, predicate: (props: Props) => boolean): Props {
    for (const child of React.Children.toArray(node)) {
      if (!React.isValidElement<Props>(child)) continue;
      if (predicate(child.props)) return child.props;
      const nested = find(child.props.children, predicate);

      if (Object.keys(nested).length) return nested;
    }

    return {};
  }

  return {
    html: () => renderToStaticMarkup(render()),
    change: (value: string) =>
      find(render(), (props) => props.name === 'ru').onChange!({
        target: { value },
      } as React.ChangeEvent<HTMLInputElement>),
    submit: () =>
      find(render(), (props) => props.component === 'form').onSubmit!({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent<HTMLFormElement>),
  };
}

describe('VerifyAccount', () => {
  it('renders RU with visible label, autocomplete and login navigation', () => {
    const html = mount().html();

    expect(html).toContain('Verifica tu cuenta');
    expect(html).toContain('for="ru"');
    expect(html).toContain('name="ru"');
    expect(html).toContain('autoComplete="username"');
    expect(html).toContain('href="/login"');
    expect(html).not.toContain('href="/register"');
    expect(html).not.toContain('href="/forgot-password"');
  });

  it.each(['', '   '])('rejects empty RU %j locally', async (ru) => {
    const view = mount();

    view.change(ru);
    await view.submit();
    expect(checkRegistration).not.toHaveBeenCalled();
    expect(view.html()).toContain('Ingresa tu RU.');
  });

  it.each([
    [{ registered: true, status: 'ACTIVE' }, 'Tu cuenta ya está registrada.'],
    [{ registered: true, status: 'INACTIVE' }, 'actualmente no está habilitada.'],
    [{ registered: false, status: 'NOT_FOUND' }, 'No encontramos una cuenta asociada a este RU.'],
  ] as const)('renders %j and clears it after editing RU', async (result, message) => {
    vi.mocked(checkRegistration).mockResolvedValueOnce(result);
    const view = mount();

    view.change(' 001aB ');
    await view.submit();
    expect(checkRegistration).toHaveBeenCalledExactlyOnceWith('001aB');
    expect(view.html()).toContain(message);
    if (result.status === 'ACTIVE') expect(view.html()).toContain('Puedes iniciar sesión con tus credenciales.');
    if (result.status === 'NOT_FOUND') expect(view.html()).toContain('realice tu matrícula.');
    if (result.status === 'INACTIVE') expect(view.html()).toContain('Comunícate con el responsable del sistema');
    view.change('456');
    expect(view.html()).not.toContain(message);
  });

  it.each([500, 429])('handles HTTP %s without reporting NOT_FOUND or retrying', async (status) => {
    vi.mocked(checkRegistration).mockRejectedValueOnce(
      new AxiosError('failure', undefined, undefined, undefined, {
        status,
        statusText: 'Error',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: {},
      }),
    );
    const view = mount();

    view.change('123');
    await view.submit();
    expect(view.html()).toContain(
      status === 429 ? 'Has realizado demasiados intentos.' : 'No pudimos verificar tu registro en este momento.',
    );
    expect(view.html()).not.toContain('No encontramos una cuenta');
    expect(checkRegistration).toHaveBeenCalledTimes(1);
  });

  it('locks repeated Enter/click submits synchronously and disables controls until completion', async () => {
    let release!: (result: { registered: false; status: 'NOT_FOUND' }) => void;

    vi.mocked(checkRegistration).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const view = mount();

    view.change('123');
    const pending = view.submit();

    await view.submit();
    await view.submit();
    expect(checkRegistration).toHaveBeenCalledTimes(1);
    const html = view.html();

    expect(html).toContain('Verificando...');
    expect(html).toContain('role="progressbar"');
    expect(html.match(/<input\b[^>]*name="ru"[^>]*>/)?.[0]).toContain('disabled=""');
    expect(html.match(/<button\b[^>]*type="submit"[^>]*>/)?.[0]).toContain('disabled=""');
    release({ registered: false, status: 'NOT_FOUND' });
    await pending;
    expect(view.html()).not.toContain('Verificando...');
  });
});
