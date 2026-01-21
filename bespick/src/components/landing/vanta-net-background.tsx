'use client';

import Script from 'next/script';
import * as React from 'react';

type VantaNetEffect = {
  destroy: () => void;
};

type ScriptLoadState = {
  three: boolean;
  vanta: boolean;
};

declare global {
  interface Window {
    THREE?: unknown;
    VANTA?: {
      NET?: (options: Record<string, unknown>) => VantaNetEffect;
    };
  }
}

const parseHsl = (raw: string) => {
  const parts = raw.trim().split(/\s+/);
  if (parts.length < 3) return null;
  const h = Number.parseFloat(parts[0]);
  const s = Number.parseFloat(parts[1].replace('%', ''));
  const l = Number.parseFloat(parts[2].replace('%', ''));
  if ([h, s, l].some((value) => Number.isNaN(value))) return null;
  return { h, s, l };
};

const hslToHex = (h: number, s: number, l: number) => {
  const hue = ((h % 360) + 360) % 360;
  const saturation = Math.min(100, Math.max(0, s)) / 100;
  const lightness = Math.min(100, Math.max(0, l)) / 100;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const toHex = (value: number) =>
    Math.round((value + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const getHexFromCssVar = (name: string, fallback: string) => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  const parsed = raw ? parseHsl(raw) : null;
  if (!parsed) return fallback;
  return hslToHex(parsed.h, parsed.s, parsed.l);
};

export function VantaNetBackground() {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const vantaRef = React.useRef<VantaNetEffect | null>(null);
  const scriptState = React.useRef<ScriptLoadState>({
    three: false,
    vanta: false,
  });
  const [ready, setReady] = React.useState(false);

  const markLoaded = React.useCallback((key: keyof ScriptLoadState) => {
    scriptState.current[key] = true;
    if (
      scriptState.current.three &&
      scriptState.current.vanta &&
      typeof window !== 'undefined' &&
      window.THREE &&
      window.VANTA?.NET
    ) {
      setReady(true);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.THREE) {
      scriptState.current.three = true;
    }
    if (window.VANTA?.NET) {
      scriptState.current.vanta = true;
    }
    if (scriptState.current.three && scriptState.current.vanta) {
      setReady(true);
    }
  }, []);

  React.useEffect(() => {
    if (!ready) return;
    const element = containerRef.current;
    const init = () => {
      if (!element || !window.VANTA?.NET || !window.THREE) return;
      vantaRef.current?.destroy();
      const backgroundFallback =
        getComputedStyle(document.body).backgroundColor || '#111111';
      const backgroundColor = getHexFromCssVar(
        '--background',
        backgroundFallback,
      );
      const accentColor = getHexFromCssVar('--accent', '#21a123');
      vantaRef.current = window.VANTA.NET({
        el: element,
        THREE: window.THREE,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.0,
        minWidth: 200.0,
        scale: 1.0,
        scaleMobile: 1.0,
        color: accentColor,
        backgroundColor,
        points: 13.0,
        maxDistance: 18.0,
      });
    };

    init();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = () => init();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleThemeChange);
    } else if (typeof media.addListener === 'function') {
      media.addListener(handleThemeChange);
    }

    return () => {
      if (typeof media.removeEventListener === 'function') {
        media.removeEventListener('change', handleThemeChange);
      } else if (typeof media.removeListener === 'function') {
        media.removeListener(handleThemeChange);
      }
      vantaRef.current?.destroy();
      vantaRef.current = null;
    };
  }, [ready]);

  return (
    <>
      <Script
        src='/vendor/three.r134.min.js'
        strategy='afterInteractive'
        onLoad={() => markLoaded('three')}
      />
      <Script
        src='/vendor/vanta.net.min.js'
        strategy='afterInteractive'
        onLoad={() => markLoaded('vanta')}
      />
      <div
        ref={containerRef}
        className='pointer-events-none absolute inset-0 -z-10 bg-background'
        aria-hidden='true'
      />
    </>
  );
}
