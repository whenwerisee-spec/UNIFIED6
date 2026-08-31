(async () => {
  const base = 'http://localhost:3000';
  const email = `recon+${Date.now()}@example.com`;
  const password = 'VeryStrongPassw0rd!';

  const headers = { 'Content-Type': 'application/json' };
  try {
    console.log('Registering user', email);
    let r = await fetch(`${base}/api/auth/register`, { method: 'POST', headers, body: JSON.stringify({ email, password, firstName: 'Recon', lastName: 'User', citizenship: 'US' }) });
    const reg = await r.json().catch(() => ({}));
    console.log('Register response:', reg);

    console.log('Logging in');
    r = await fetch(`${base}/api/auth/login`, { method: 'POST', headers, body: JSON.stringify({ email, password }) });
    const login = await r.json();
    console.log('Login response:', login);
    const token = login.token || (login && login.user && login.user.token) || null;
    if (!token) {
      console.error('No token returned from login; aborting.');
      process.exit(1);
    }

    console.log('Calling /internal/exchanges/sync');
    const syncRes = await fetch(`${base}/internal/exchanges/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({}) });
    const syncJson = await syncRes.json().catch(() => ({}));
    console.log('Sync result HTTP', syncRes.status);
    console.log(JSON.stringify(syncJson, null, 2));
  } catch (e) {
    console.error('Error during reconcile script', e);
    process.exit(1);
  }
})();
