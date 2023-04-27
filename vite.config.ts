import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import glsl from 'vite-plugin-glsl';
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5000,
  },
  plugins: [
    react(),
    glsl({
      include: ['**/*.glsl', '**/*.vert', '**/*.frag'],
      warnDuplicatedImports: true,
      defaultExtension: 'glsl',
      compress: false,
      root: '/',
    }),
  ],
});
