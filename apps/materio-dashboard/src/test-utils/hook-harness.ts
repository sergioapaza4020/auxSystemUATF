import * as React from 'react';

import { vi } from 'vitest';

// Node-only hook harness, matching the existing tests without adding a DOM dependency.
// State persists across renders; effects honor dependencies and run their cleanup.
export function hookHarness<T>(renderHook: () => T) {
  const states: unknown[] = [];
  const refs: { current: unknown }[] = [];
  const callbacks: { value: unknown; deps?: React.DependencyList }[] = [];
  const memos: { value: unknown; deps?: React.DependencyList }[] = [];
  const effects: { deps?: React.DependencyList; cleanup?: () => void }[] = [];

  const same = (a?: React.DependencyList, b?: React.DependencyList) =>
    !!a && !!b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));

  const render = () => {
    let stateIndex = 0;
    let refIndex = 0;
    let callbackIndex = 0;
    let memoIndex = 0;
    let effectIndex = 0;
    const pending: (() => void)[] = [];

    vi.mocked(React.useState).mockImplementation(((initial: unknown) => {
      const index = stateIndex++;

      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;

      return [
        states[index],
        (value: unknown) => {
          states[index] = typeof value === 'function' ? value(states[index]) : value;
        },
      ];
    }) as unknown as typeof React.useState);
    vi.mocked(React.useRef).mockImplementation(((initial: unknown) => {
      const index = refIndex++;

      refs[index] ??= { current: initial };

      return refs[index];
    }) as unknown as typeof React.useRef);
    vi.mocked(React.useCallback).mockImplementation(((value: unknown, deps: React.DependencyList) => {
      const index = callbackIndex++;

      if (!same(callbacks[index]?.deps, deps)) callbacks[index] = { value, deps };

      return callbacks[index].value;
    }) as typeof React.useCallback);
    vi.mocked(React.useMemo).mockImplementation(((factory: () => unknown, deps?: React.DependencyList) => {
      const index = memoIndex++;

      if (!same(memos[index]?.deps, deps)) memos[index] = { value: factory(), deps };

      return memos[index].value;
    }) as typeof React.useMemo);
    vi.mocked(React.useEffect).mockImplementation((effect, deps) => {
      const index = effectIndex++;

      if (!same(effects[index]?.deps, deps))
        pending.push(() => {
          effects[index]?.cleanup?.();
          effects[index] = { deps, cleanup: effect() || undefined };
        });
    });
    const result = renderHook();

    pending.forEach((effect) => effect());

    return result;
  };

  return { render, unmount: () => effects.forEach((effect) => effect.cleanup?.()) };
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;

  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });

  return { promise, resolve, reject };
}

export function elements<P>(tree: React.ReactNode, type: unknown): React.ReactElement<P>[] {
  const found: React.ReactElement<P>[] = [];

  const walk = (nodes: React.ReactNode) =>
    React.Children.forEach(nodes, (child) => {
      if (!React.isValidElement<{ children?: React.ReactNode }>(child)) return;
      if (child.type === type) found.push(child as React.ReactElement<P>);
      walk(child.props.children);
    });

  walk(tree);

  return found;
}
