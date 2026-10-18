// Downloads an uploaded file from private storage. Admin only (see _middleware.js).
export async function onRequestGet({ request, env }) {
  const key = new URL(request.url).searchParams.get('key') || '';
  if (!/^(orders|confessions)\//.test(key)) return new Response('Not found', { status: 404 });
  const obj = await env.FILES.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'content-disposition': `attachment; filename="${key.split('/').pop()}"`,
    },
  });
}
