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
      },
    },
  },
  plugins: [],
  future: {
    removeDeprecatedGapUtilities: true,
    purgeLayersByDefault: true
  },
  purge: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class'
}
