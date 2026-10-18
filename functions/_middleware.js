// Basic auth in front of the admin page and admin API.
export async function onRequest({ request, env, next }) {
  const path = new URL(request.url).pathname;
  if (!path.startsWith('/admin') && !path.startsWith('/api/admin')) return next();

  const expected = 'Basic ' + btoa(`${env.ADMIN_USER}:${env.ADMIN_PASSWORD}`);
  const given = request.headers.get('authorization') || '';
  if (!env.ADMIN_USER || !env.ADMIN_PASSWORD || given !== expected) {
    return new Response('Founders only.', { status: 401, headers: { 'www-authenticate': 'Basic realm="Audacity admin"' } });
  }
  return next();
}
