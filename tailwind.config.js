module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      'sm': '350px',
      'md': '640px',
      'lg': '768px',
      'xl': '1024px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        'primary': '#2B2E4A',
        'secondary': '#ff9b1a',
        'sec-text': '#444444',
        'success': '#4caf50',
        'info': '#2196f3',
        'warning': '#ff9800',
        'danger': '#f44336',
        'light': '#fafafa',
        'dark': '#212121',
        'white': '#ffffff',
        'black': '#000000',
        'code': '#24292e',
      },
      keyframes: {
        wave: {
          '0%': { transform: 'rotate(0.0deg)' },
          '10%': { transform: 'rotate(14deg)' },
          '20%': { transform: 'rotate(-8deg)' },
          '30%': { transform: 'rotate(14deg)' },
          '40%': { transform: 'rotate(-4deg)' },
          '50%': { transform: 'rotate(10.0deg)' },
          '60%': { transform: 'rotate(0.0deg)' },
          '100%': { transform: 'rotate(0.0deg)' },
        },
      },
      animation: {
        'waving-hand': 'wave 5s ease 1s infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/line-clamp'),
  ],
  // future: {
  //   removeDeprecatedGapUtilities: true,
  //   purgeLayersByDefault: true
  // },
  // purge: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class'
}
