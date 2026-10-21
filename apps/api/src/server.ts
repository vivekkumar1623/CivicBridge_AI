import { app } from './app.js';
import { config } from './config/index.js';
import { connectDatabase } from './config/database.js';

const PORT = config.port;

async function startServer() {
  await connectDatabase();

  app.listen(PORT, () => {
    console.log(`[API] CivicBridge API running on port ${PORT}`);
    console.log(`[API] Environment: ${config.nodeEnv}`);
    console.log(`[API] Health check: http://localhost:${PORT}/api/health`);
  });
}

startServer();
