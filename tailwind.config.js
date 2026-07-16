/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./app.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
      },
      animation: {
        'slide-in-right': 'slideInRight 0.3s ease-out',
        shimmer: 'shimmer 2s infinite linear',
        'fade-in': 'fadeIn 0.2s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      colors: {
        gblue: {
          DEFAULT: '#1A73E8',
          50: '#E8F0FE',
          100: '#D2E3FC',
          200: '#AECBFA',
          300: '#8AB4F8',
          400: '#669DF6',
          500: '#4285F4',
          600: '#1A73E8',
          700: '#1967D2',
          800: '#185ABC',
          900: '#174EA6',
        },
        gsurface: {
          light: '#F8F9FA',
          dark: '#1E1E1E',
          'card-light': '#FFFFFF',
          'card-dark': '#292A2D',
          'elevated-dark': '#333538',
        },
        gtext: {
          primary: '#202124',
          secondary: '#5F6368',
          'primary-dark': '#E8EAED',
          'secondary-dark': '#9AA0A6',
        },
        gborder: {
          light: '#DADCE0',
          dark: '#3C4043',
        },
        ggreen: {
          DEFAULT: '#34A853',
          50: '#E6F4EA',
          100: '#CEEAD6',
          600: '#1E8E3E',
          700: '#188038',
        },
        gsuccess: {
          DEFAULT: '#34A853',
          50: '#E6F4EA',
          600: '#1E8E3E',
        },
        gyellow: {
          DEFAULT: '#FBBC04',
          50: '#FEF7E0',
          600: '#F9AB00',
        },
        gwarning: {
          DEFAULT: '#FBBC04',
          50: '#FEF7E0',
        },
        gred: {
          DEFAULT: '#EA4335',
          50: '#FCE8E6',
          600: '#D93025',
          700: '#C5221F',
        },
        gerror: {
          DEFAULT: '#EA4335',
          50: '#FCE8E6',
          600: '#D93025',
        },
      },
      borderRadius: {
        gcard: '12px',
        gbtn: '8px',
        gpill: '24px',
      },
      boxShadow: {
        gcard: '0 1px 3px 0 rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)',
        'gcard-sm': '0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)',
        'gcard-dark': '0 1px 3px 0 rgba(0,0,0,0.5), 0 4px 8px 3px rgba(0,0,0,0.3)',
      },
    },
  },
  plugins: [],
};
