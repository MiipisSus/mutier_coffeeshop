/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html'],
  theme: {
    extend: {
      colors: {
        cream:           '#F6EADA',
        'cream-soft':    '#FBF3E5',
        'milk-tea':      '#E2C9A6',
        'milk-tea-deep': '#C9A679',
        coffee:          '#3B2418',
        'coffee-soft':   '#5A3A27',
        'coffee-ink':    '#2A1810',
        blush:           '#C77A66',
        'blush-soft':    '#E2A493',
        sage:            '#8FA870',
        'sage-soft':     '#B8C99A',
        'pink-mist':     '#F3DCD1',
        butter:          '#F4D9A4',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        body:    ['Nunito', 'Klee One', 'sans-serif'],
        hand:    ['Caveat', 'Klee One', 'cursive'],
      },
      boxShadow: {
        warm: '0 30px 60px -20px rgba(59, 36, 24, 0.18)',
        soft: '0 8px 20px -8px rgba(59, 36, 24, 0.15)',
      },
      keyframes: {
        wobble: {
          '0%, 100%': { transform: 'rotate(-3deg)', borderRadius: '50% 50% 48% 52% / 52% 48% 50% 50%' },
          '50%':      { transform: 'rotate(3deg)',  borderRadius: '48% 52% 50% 50% / 48% 52% 52% 48%' },
        },
        fadeSlide: {
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(-1deg)' },
          '50%':      { transform: 'translateY(-14px) rotate(1deg)' },
        },
        rise: {
          '0%':   { opacity: '0', transform: 'translateY(0) scaleY(0.4)' },
          '30%':  { opacity: '0.8' },
          '100%': { opacity: '0', transform: 'translateY(-50px) scaleY(1.2)' },
        },
        morph: {
          '0%, 100%': { borderRadius: '50% 50% 48% 52% / 56% 44% 52% 48%', transform: 'rotate(0deg) translateY(0)' },
          '33%':      { borderRadius: '48% 52% 56% 44% / 48% 52% 44% 56%', transform: 'rotate(40deg) translateY(-10px)' },
          '66%':      { borderRadius: '56% 44% 50% 50% / 44% 56% 48% 52%', transform: 'rotate(-25deg) translateY(8px)' },
        },
        beanSpin: {
          '0%, 100%': { transform: 'rotate(-25deg) translateY(0)' },
          '50%':      { transform: 'rotate(20deg) translateY(-12px)' },
        },
        marquee: {
          'to': { transform: 'translateX(-50%)' },
        },
        pulse2: {
          '0%, 100%': { boxShadow: '0 0 0 4px rgba(199, 122, 102, 0.25)' },
          '50%':      { boxShadow: '0 0 0 8px rgba(199, 122, 102, 0.05)' },
        },
      },
      animation: {
        wobble:    'wobble 6s ease-in-out infinite',
        float:     'float 7s ease-in-out infinite',
        rise:      'rise 3s ease-in-out infinite',
        morph:     'morph 12s ease-in-out infinite',
        'morph-slow':    'morph 14s ease-in-out infinite',
        'morph-slower':  'morph 17s ease-in-out infinite reverse',
        'spin-bean':     'beanSpin 9s ease-in-out infinite',
        'spin-bean-rev': 'beanSpin 11s ease-in-out infinite reverse',
        'spin-bean-slow':'beanSpin 13s ease-in-out infinite',
        marquee:   'marquee 30s linear infinite',
        'fade-slide-tag':     'fadeSlide 0.9s 0.2s ease-out forwards',
        'fade-slide-line-1':  'fadeSlide 0.9s 0.35s ease-out forwards',
        'fade-slide-line-2':  'fadeSlide 0.9s 0.5s ease-out forwards',
        'fade-slide-desc':    'fadeSlide 0.9s 0.7s ease-out forwards',
        'fade-slide-actions': 'fadeSlide 0.9s 0.9s ease-out forwards',
        'fade-slide-visual':  'fadeSlide 1.2s 0.4s ease-out forwards',
        'pulse-ring':         'pulse2 2s infinite',
      },
    },
  },
  plugins: [],
};
