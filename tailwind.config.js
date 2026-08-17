/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'brand-lime': '#9fff00',
        'brand-lime-deep': '#7ad000',
        'bg-base': '#EDEEF5',
        'bg-2': '#E6E7F0',
        surface: '#FFFFFF',
        ink: '#1a1a1a',
        'ink-soft': '#4a4a4e',
        muted: '#8e8e8e',
        faint: '#b3b4bd',
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
      },
      boxShadow: {
        card: '0 1px 2px rgba(20,20,40,0.04), 0 8px 30px -18px rgba(20,20,60,0.18)',
      },
      maxWidth: {
        content: '1200px',
      },
    },
  },
  plugins: [],
};
