import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages: change `base` to '/<your-repo-name>/' before deploying.
// Defaults to '/pharmacy-audit/' which matches a repo named "pharmacy-audit".
export default defineConfig({
  base: process.env.GITHUB_PAGES_BASE ?? '/pharmacy-audit/',
  plugins: [react()],
})
