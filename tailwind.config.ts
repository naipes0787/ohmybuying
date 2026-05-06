import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'retro-bg': 'var(--color-bg)',
        'retro-surface': 'var(--color-surface)',
        'retro-border': 'var(--color-border)',
        'retro-text': 'var(--color-text)',
        'retro-muted': 'var(--color-muted)',
        'retro-cyan': 'var(--color-cyan)',
        'retro-green': 'var(--color-green)',
        'retro-magenta': 'var(--color-magenta)',
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      boxShadow: {
        'glow-cyan': '0 0 8px var(--color-cyan), 0 0 24px var(--color-cyan-dim)',
        'glow-green': '0 0 8px var(--color-green), 0 0 24px var(--color-green-dim)',
        'glow-magenta': '0 0 8px var(--color-magenta), 0 0 24px var(--color-magenta-dim)',
      },
      animation: {
        scanline: 'scanline 8s linear infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite alternate',
        flicker: 'flicker 4s infinite',
        'boot-in': 'bootIn 0.6s ease-out forwards',
      },
      keyframes: {
        scanline: {
          from: { backgroundPosition: '0 0' },
          to: { backgroundPosition: '0 100vh' },
        },
        glowPulse: {
          from: { opacity: '0.6' },
          to: { opacity: '1' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '92%': { opacity: '1' },
          '93%': { opacity: '0.85' },
          '94%': { opacity: '1' },
        },
        bootIn: {
          from: { opacity: '0', transform: 'scaleY(0.02) scaleX(1.05)' },
          to: { opacity: '1', transform: 'scaleY(1) scaleX(1)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
