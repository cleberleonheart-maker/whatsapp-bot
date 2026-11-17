import { startBot } from './src/client.js';

startBot().catch((error) => {
  console.error('Falha fatal ao iniciar o bot:', error);
  process.exit(1);
});
