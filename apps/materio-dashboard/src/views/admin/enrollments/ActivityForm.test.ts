import { createElement } from 'react';

import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ActivityForm } from './ActivityForm';

describe('Activity form', () => {
  it.each([null, { idActivity: 1, name: 'Práctica', dueDate: '2026-10-20', isActive: true }])(
    'renders creation/editing with a deadline and no manual order',
    (initialValue) => {
      const html = renderToString(createElement(ActivityForm, { initialValue, onChange: () => undefined }));

      expect(html).toContain('Nombre de la actividad');
      expect(html).toContain('Fecha de entrega');
      expect(html).not.toContain('Orden');
      expect(html).not.toContain('type="number"');
      if (initialValue) expect(html).toContain('value="20/10/2026"');
    },
  );
});
