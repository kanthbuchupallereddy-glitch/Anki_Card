import { createStudyServer } from './app.js';
import { configuredPort, LOCAL_HOST } from './config/runtime.js';

try {
  const port = configuredPort(process.env.STUDY_PORT);
  const server = createStudyServer({ port });
  server.on('error', (error: NodeJS.ErrnoException) => {
    console.error(error.code === 'EADDRINUSE' ? `Study could not start: port ${port} is already in use.` : 'Study could not start its local server.');
    process.exitCode = 1;
  });
  server.listen(port, LOCAL_HOST, () => console.log(`Study is ready at http://${LOCAL_HOST}:${port}. Keep Anki open. Press Ctrl+C to stop.`));
  let closing = false;
  const stop = () => {
    if (closing) return;
    closing = true;
    server.close();
    server.closeIdleConnections();
    setTimeout(() => server.closeAllConnections(), 5000).unref();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
} catch {
  console.error('Study could not start: check the local port configuration.');
  process.exitCode = 1;
}
