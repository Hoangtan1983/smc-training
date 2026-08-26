import { defineConfig } from 'vite'

// https://vite.dev/config/
// LƯU Ý: bỏ @vitejs/plugin-react (babel) do treo khi build production;
// dùng esbuild JSX automatic (React 17+) thay thế — nhanh và ổn định.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
})
