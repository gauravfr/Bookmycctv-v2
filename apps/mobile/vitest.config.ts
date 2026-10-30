import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
export default {
  root,
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    clearMocks: true,
    env: { EXPO_PUBLIC_API_BASE_URL: 'http://127.0.0.1:3000' },
  },
};
