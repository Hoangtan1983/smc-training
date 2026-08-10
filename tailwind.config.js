/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        smc: {
          50: '#F0F7FF',
          100: '#E0F0FF',
          200: '#B8DEFF',
          300: '#85C8FF',
          400: '#4DA3FF',
          500: '#007AFF',
          600: '#0062CC',
          700: '#004D99',
          800: '#003A73',
          900: '#00284D',
          950: '#001A33',
        },
        accent: {
          50: '#F0FDFB',
          100: '#D2F9F2',
          200: '#A5F3E5',
          300: '#6DEAD4',
          400: '#3DDBC4',
          500: '#5AC8FA',
          600: '#3DB8E5',
          700: '#2AA0CF',
          800: '#1A86B5',
          900: '#0D6A96',
        },
        ios: {
          red: '#FF3B30',
          orange: '#FF9500',
          yellow: '#FFCC00',
          green: '#34C759',
          teal: '#5AC8FA',
          purple: '#AF52DE',
          pink: '#FF2D55',
          gray: '#8E8E93',
          gray2: '#AEAEB2',
          gray3: '#C7C7CC',
          gray4: '#D1D1D6',
          gray5: '#E5E5EA',
          gray6: '#F2F2F7',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Text"', '"Helvetica Neue"', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'ios': '0.625rem',
        'ios-lg': '0.75rem',
        'ios-xl': '1rem',
        'ios-2xl': '1.25rem',
        'ios-3xl': '1.5rem',
        'ios-full': '9999px',
      },
      animation: {
        'fade-in': 'iosFadeIn 0.35s ease-out',
        'slide-up': 'iosSlideUp 0.45s cubic-bezier(0.22, 0.61, 0.36, 1)',
        'slide-down': 'iosSlideDown 0.35s cubic-bezier(0.22, 0.61, 0.36, 1)',
        'scale-in': 'iosScaleIn 0.3s cubic-bezier(0.22, 0.61, 0.36, 1)',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        iosFadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        iosSlideUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        iosSlideDown: {
          '0%': { opacity: '0', transform: 'translateY(-12px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        iosScaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      boxShadow: {
        'ios': '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
        'ios-md': '0 2px 12px rgba(0,0,0,0.06)',
        'ios-lg': '0 4px 24px rgba(0,0,0,0.08)',
        'ios-btn': '0 1px 3px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
};
