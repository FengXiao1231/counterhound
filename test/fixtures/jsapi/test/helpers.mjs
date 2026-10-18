import app from '../src/app.js';

/** Start the app on a free port and return its base URL and a stop function. */
export function startApp() {
  const server = app.listen(0);
  return { base: `http://127.0.0.1:${server.address().port}`, stop: () => server.close() };
}
