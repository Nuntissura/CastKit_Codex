import React from 'react';

export function useElementWidth<T extends HTMLElement>(): readonly [React.RefObject<T | null>, number] {
  const ref = React.useRef<T | null>(null);
  const [width, setWidth] = React.useState<number>(0);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      setWidth(el.getBoundingClientRect().width);
    };

    update();

    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width] as const;
}

