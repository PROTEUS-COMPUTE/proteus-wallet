import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
  // <html class="dark"> is set in index.html: the explorer has one theme, the
  // landing's night charter, so the chart registry's dark variables apply.
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'brand-lime': '#9fff00',
        'brand-lime-deep': '#8fe600',
        // Night charter, shared with the landing. The legacy names are remapped
        // in place rather than renamed: the explorer only ever had one theme, so
        // every `text-ink` / `text-muted` in the app turns over with this block.
        'bg-base': '#000000',
        'bg-2': '#141414',
        surface: '#0a0a0a',
        ink: '#f7f7f4',
        'ink-soft': '#b8b8b8',
        muted: '#8c8c8c',
        faint: '#5c5c5c',
        night: '#000000',
        bone: '#f7f7f4',
        smoke: '#b8b8b8',
        ash: '#8c8c8c',
        line: '#3d3d3d',
        chart: {
          'tooltip-background': 'var(--chart-tooltip-background)',
          'tooltip-foreground': 'var(--chart-tooltip-foreground)',
          'tooltip-muted': 'var(--chart-tooltip-muted)',
          label: 'var(--chart-label)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['"PT Serif"', ...defaultTheme.fontFamily.serif],
        mono: ['"JetBrains Mono"', ...defaultTheme.fontFamily.mono],
      },
      boxShadow: {
        card: 'none',
      },
      maxWidth: {
        content: '1200px',
      },
    },
  },
  plugins: [],
};
