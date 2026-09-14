import { app } from './app.js';
const port = Number(process.env.PORT || 8787);
const server = app.listen(port, () => console.log('API listening on http://localhost:' + port));
server.requestTimeout = 30000;
server.headersTimeout = 15000;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
