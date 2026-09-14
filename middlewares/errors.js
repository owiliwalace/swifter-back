export function notFound(_req, res) { res.status(404).json({ error: 'Endpoint not found.' }); }
export function errorHandler(error, _req, res, _next) {
  const status = [400, 403, 413, 415, 503].includes(error.status) ? error.status : 500;
  // Never log request bodies, bearer tokens, callback URLs or payment credentials.
  console.error('API error', { status, type: error.name });
  res.status(status).json({ error: status === 500 ? 'The request could not be completed. Please try again.' : status === 413 ? 'Request is too large.' : 'Invalid request.' });
}
