export function buildDiagnostics(serverUrl, result) {
  const code = result?.code || 'UNKNOWN';
  const checks = [];

  if (!serverUrl) {
    checks.push('Enter the base server URL, for example https://127.0.0.1.');
  } else {
    checks.push(`URL tested: ${serverUrl}`);
  }

  if (code === 'DNS') {
    checks.push('Check the hostname spelling and local DNS/VPN state.');
  } else if (code === 'REFUSED') {
    checks.push('The host was reachable but no server accepted the connection on that port.');
  } else if (code === 'TIMEOUT') {
    checks.push('The request timed out. Check firewall, VPN, and reverse proxy routes.');
  } else if (code === 'TLS') {
    checks.push('The certificate is not trusted. Use a real certificate or explicitly trust your local host.');
  } else if (code === 'SETUP_REQUIRED') {
    checks.push('Open this server in a browser and complete EvilTime setup first.');
  } else if (code === 'NOT_TIMETRACKER') {
    checks.push('Do not include /api/v1/info in the desktop field; enter the base URL only.');
  } else if (code === 'UNAUTHORIZED') {
    checks.push('Check username and password, then sign in again.');
  } else {
    checks.push('Confirm the EvilTime web app is open in a browser on the same URL.');
  }

  return {
    code,
    message: result?.message || 'Unknown error',
    checks,
    technical: JSON.stringify(
      {
        serverUrl,
        code,
        message: result?.message,
        online: navigator.onLine,
        userAgent: navigator.userAgent,
        time: new Date().toISOString(),
      },
      null,
      2,
    ),
  };
}
