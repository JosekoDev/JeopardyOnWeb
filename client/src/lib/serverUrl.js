const configuredServerUrl = import.meta.env.VITE_SERVER_URL;

function normalizeUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

export function getServerUrl() {
  if (configuredServerUrl) return normalizeUrl(configuredServerUrl);
  if (typeof window === 'undefined') return '';

  const { protocol, hostname, port } = window.location;
  // Use same-origin when served from production/tunnel/LAN (no explicit dev port).
  if (!port || port === '3010') return '';

  // During dev/preview, route API/socket traffic to the same machine's server.
  return `${protocol}//${hostname}:3010`;
}

