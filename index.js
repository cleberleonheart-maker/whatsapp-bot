import { startBot } from './src/client.js';
import { releaseInstanceLock } from './src/instance-lock.js';

startBot().catch((error) => {
  releaseInstanceLock();
  console.error('Falha fatal ao iniciar o bot:', error);
  process.exit(1);
});
