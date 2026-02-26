/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Space Grotesk', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
  safelist: [
    // 動態顏色類別
    'bg-blue-500', 'bg-blue-500/10', 'bg-blue-500/20',
    'bg-orange-500', 'bg-orange-500/10', 'bg-orange-500/20',
    'bg-purple-500', 'bg-purple-500/10', 'bg-purple-500/20',
    'bg-emerald-500', 'bg-emerald-500/20',
    'bg-amber-500', 'bg-amber-500/20',
    'bg-red-500', 'bg-red-500/20',
    'bg-cyan-500', 'bg-cyan-500/20',
    'bg-pink-500', 'bg-pink-500/20',
    'text-blue-400', 'text-blue-500',
    'text-orange-400', 'text-orange-500',
    'text-purple-400', 'text-purple-500',
    'text-emerald-400', 'text-emerald-500',
    'text-amber-400', 'text-amber-500',
    'text-red-400', 'text-red-500',
    'text-cyan-400', 'text-cyan-500',
    'text-pink-400', 'text-pink-500',
    'from-blue-500', 'to-cyan-400',
    'from-orange-500', 'to-amber-400',
    'from-purple-500', 'to-pink-400',
    'from-indigo-500', 'to-purple-600',
    'border-blue-500/30', 'border-blue-500/50',
    'border-orange-500/30', 'border-orange-500/50',
    'border-purple-500/30', 'border-purple-500/50',
    'border-emerald-500/30', 'border-emerald-500/50',
    'border-amber-500/30', 'border-amber-500/50',
    'border-cyan-500/30', 'border-cyan-500/50',
    'border-pink-500/30', 'border-pink-500/50',
    'border-red-500/30', 'border-red-500/50',
    'shadow-emerald-500/20', 'shadow-emerald-500/30',
    'shadow-red-500/20', 'shadow-red-500/30',
    'shadow-indigo-500/20', 'shadow-indigo-500/30',
    // SystemView getLatencyColor 動態類別
    'text-slate-400', 'bg-slate-500',
  ],
}
