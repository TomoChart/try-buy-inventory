/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx,ts,tsx,mdx}",
    "./components/**/*.{js,jsx,ts,tsx,mdx}",
    "./app/**/*.{js,jsx,ts,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        'samsung-blue': '#1428A0',
        'samsung-blue-dark': '#1428A0',
        'samsung-blue-light': '#1B4FD9'
      }
    }
  },
  plugins: []
};
