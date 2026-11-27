'use client';

import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';

type SectionItem = { id: string; label: string; icon?: ReactNode };

function getScrollRoot(element: HTMLElement) {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (/^(auto|scroll|overlay)$/.test(getComputedStyle(parent).overflowY) && parent !== document.scrollingElement) {
      return parent;
    }
  }

  return null;
}

function getViewport(root: HTMLElement | null) {
  return root
    ? {
        top: root.getBoundingClientRect().top + root.clientTop,
        height: root.clientHeight,
        scroll: root.scrollTop,
        limit: root.scrollHeight - root.clientHeight,
      }
    : {
        top: 0,
        height: window.innerHeight,
        scroll: window.scrollY,
        limit: (document.scrollingElement?.scrollHeight ?? window.innerHeight) - window.innerHeight,
      };
}

function getScrollMargin(section: HTMLElement) {
  return Number.parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
}

export default function SectionNavigation({
  label,
  items,
  scrollable = false,
}: {
  label: string;
  items: readonly SectionItem[];
  scrollable?: boolean;
}) {
  const nav = useRef<HTMLElement>(null);
  const destination = useRef<{ section: HTMLElement; sectionTop: number; top: number; arrived: boolean } | null>(null);
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const bar = nav.current;

    if (!bar) return;
    const root = getScrollRoot(bar);
    const scroller = root ?? window;
    const scrollEvents = root ?? document;
    const sections = items.map(({ id }) => document.getElementById(id)).filter((section) => section !== null);
    let frame = 0;

    const update = () => {
      frame = 0;
      const viewport = getViewport(root);
      const requested = destination.current;

      if (requested) {
        const sectionTop = requested.section.getBoundingClientRect().top - viewport.top + viewport.scroll;
        const layoutChanged = Math.abs(sectionTop - requested.sectionTop) > 1;

        // Keep the requested link active during smooth scrolling and at a clamped destination.
        if (!layoutChanged && Math.abs(viewport.scroll - requested.top) <= 1) {
          requested.arrived = true;

          return;
        }

        if (!layoutChanged && !requested.arrived) return;
        destination.current = null;
      }

      const boundary = Math.max(viewport.top, bar.getBoundingClientRect().bottom) + 2;
      const last = sections.at(-1);
      const atEnd = viewport.limit > 1 && viewport.scroll >= viewport.limit - 1;

      const reached = sections
        .filter((section) => section.getBoundingClientRect().top <= boundary + getScrollMargin(section))
        .at(-1);

      const row =
        atEnd && last && last.getBoundingClientRect().top < viewport.top + viewport.height
          ? last
          : (reached ?? sections[0]);

      if (!row) return;

      const rowTop = row.getBoundingClientRect().top;

      const rowIds = sections
        .filter((section) => Math.abs(section.getBoundingClientRect().top - rowTop) <= 1)
        .map((section) => section.id);

      setActive((current) => (current && rowIds.includes(current) ? current : rowIds[0]));
    };

    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    function finishScroll() {
      const requested = destination.current;

      if (requested && Math.abs(getViewport(root).scroll - requested.top) > 1) {
        destination.current = null;
        schedule();
      }
    }

    scroller.addEventListener('scroll', schedule, { passive: true });
    scrollEvents.addEventListener('scrollend', finishScroll);
    window.addEventListener('resize', schedule);
    const observer = new ResizeObserver(schedule);

    observer.observe(bar);
    if (root) observer.observe(root);
    sections.forEach((section) => observer.observe(section));
    schedule();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      scroller.removeEventListener('scroll', schedule);
      scrollEvents.removeEventListener('scrollend', finishScroll);
      window.removeEventListener('resize', schedule);
    };
  }, [items]);

  function goTo(event: MouseEvent<HTMLAnchorElement>, id: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const bar = nav.current;
    const section = document.getElementById(id);

    if (!bar || !section) return;
    event.preventDefault();
    const root = getScrollRoot(bar);
    const viewport = getViewport(root);
    const stickyTop = Number.parseFloat(getComputedStyle(bar).top) || 0;
    const sectionTop = section.getBoundingClientRect().top - viewport.top + viewport.scroll;
    const offset = bar.offsetHeight + stickyTop + getScrollMargin(section);
    const top = Math.max(0, Math.min(viewport.limit, sectionTop - offset));
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
    const arrived = Math.abs(top - viewport.scroll) <= 1;

    section.focus({ preventScroll: true });
    setActive(id);
    destination.current = { section, sectionTop, top, arrived };
    if (!arrived) (root ?? window).scrollTo({ top, behavior });
  }

  return (
    <Box
      component='nav'
      aria-label={label}
      ref={nav}
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 1,
        bgcolor: 'background.default',
        borderBottom: 1,
        borderColor: 'divider',
        display: 'flex',
        flexWrap: scrollable ? 'nowrap' : 'wrap',
        overflowX: scrollable ? 'auto' : undefined,
        minWidth: 0,
      }}
    >
      {items.map(({ id, label: itemLabel, icon }) => (
        <ButtonBase
          key={id}
          component='a'
          href={`#${id}`}
          aria-current={active === id ? 'location' : undefined}
          onClick={(event) => goTo(event, id)}
          sx={{
            gap: 1,
            minHeight: 48,
            maxWidth: '100%',
            flexShrink: scrollable ? 0 : undefined,
            px: { xs: 2, sm: 4 },
            py: 1,
            color: 'text.secondary',
            typography: 'button',
            overflowWrap: 'anywhere',
            borderBottom: '2px solid transparent',
            '&[aria-current]': { color: 'primary.main', borderColor: 'primary.main' },
            '&:hover': { bgcolor: 'action.hover' },
            '&.Mui-focusVisible': { outline: '2px solid currentColor', outlineOffset: -2 },
          }}
        >
          {icon}
          <span>{itemLabel}</span>
        </ButtonBase>
      ))}
    </Box>
  );
}
