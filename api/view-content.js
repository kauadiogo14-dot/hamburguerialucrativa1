import { isIP } from 'node:net';

const PIXEL_ID = '1648222293456055';
const GRAPH_VERSION = 'v25.0';

function header(request, name) {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value || '';
}

function validMetaCookie(value) {
  return typeof value === 'string' && value.length <= 1200 && /^fb\.\d+\.\d{13}\.[A-Za-z0-9_.-]+$/.test(value);
}

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'method_not_allowed' });
  }

  if (header(request, 'content-type').split(';')[0].trim().toLowerCase() !== 'application/json') {
    return response.status(415).json({ error: 'json_required' });
  }

  // Only the landing page on this same host may submit a browser request.
  let origin;
  try {
    origin = new URL(header(request, 'origin'));
  } catch {
    return response.status(403).json({ error: 'invalid_origin' });
  }
  if (!['https:', 'http:'].includes(origin.protocol) || origin.host !== header(request, 'host')) {
    return response.status(403).json({ error: 'invalid_origin' });
  }

  let body = request.body;
  try {
    if (Buffer.byteLength(JSON.stringify(body) || '') > 8192) {
      return response.status(413).json({ error: 'payload_too_large' });
    }
    if (typeof body === 'string') body = JSON.parse(body);
  } catch {
    return response.status(400).json({ error: 'invalid_json' });
  }

  if (!body || typeof body !== 'object' || typeof body.event_id !== 'string' || !/^vc_[a-f0-9]{32}$/.test(body.event_id)) {
    return response.status(400).json({ error: 'invalid_event_id' });
  }

  let sourceUrl;
  try {
    if (typeof body.event_source_url !== 'string' || body.event_source_url.length > 4096) {
      throw new Error('Invalid URL');
    }
    sourceUrl = new URL(body.event_source_url);
    if (sourceUrl.origin !== origin.origin || sourceUrl.username || sourceUrl.password) {
      throw new Error('Invalid URL');
    }
    sourceUrl.hash = '';
  } catch {
    return response.status(400).json({ error: 'invalid_source_url' });
  }

  // This variable is read exclusively on Vercel's server.
  const token = process.env.META_ACCESS_TOKEN?.trim();
  if (!token) {
    console.error('ViewContent: configure META_ACCESS_TOKEN nas variáveis de ambiente da Vercel.');
    return response.status(503).json({ error: 'tracking_not_configured' });
  }

  const userAgent = header(request, 'user-agent').slice(0, 2048);
  if (!userAgent) return response.status(400).json({ error: 'user_agent_required' });
  const userData = { client_user_agent: userAgent };
  const forwardedIp = header(request, 'x-vercel-forwarded-for') || header(request, 'x-forwarded-for');
  const ip = forwardedIp.split(',')[0].trim() || request.socket?.remoteAddress;
  if (ip && isIP(ip)) userData.client_ip_address = ip;
  if (validMetaCookie(body.fbp)) userData.fbp = body.fbp;
  if (validMetaCookie(body.fbc)) userData.fbc = body.fbc;

  const payload = {
    data: [{
      event_name: 'ViewContent',
      event_time: Math.floor(Date.now() / 1000),
      event_id: body.event_id,
      action_source: 'website',
      event_source_url: sourceUrl.href,
      user_data: userData,
      custom_data: { content_name: 'Hamburgueria Lucrativa' }
    }]
  };

  // Optional during validation in Meta's Test Events tab.
  if (process.env.META_TEST_EVENT_CODE) {
    payload.test_event_code = process.env.META_TEST_EVENT_CODE.trim();
  }

  try {
    const metaResponse = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PIXEL_ID}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });
    const result = await metaResponse.json();

    if (!metaResponse.ok || result.events_received !== 1) {
      // Log diagnostic codes only; keep tokens and visitor data out of logs.
      console.error('Meta rejeitou ViewContent', {
        status: metaResponse.status,
        code: result.error?.code,
        subcode: result.error?.error_subcode,
        trace_id: result.fbtrace_id || result.error?.fbtrace_id
      });
      return response.status(502).json({ error: 'meta_event_rejected' });
    }

    return response.status(200).json({ ok: true, event_id: body.event_id });
  } catch {
    console.error('ViewContent: falha de conexão ou resposta inválida da Meta.');
    return response.status(502).json({ error: 'meta_unavailable' });
  }
}
