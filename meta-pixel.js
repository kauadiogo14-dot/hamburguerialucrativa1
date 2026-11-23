(() => {
  'use strict';

  if (window.__hamburgueriaViewContentStarted) return;
  window.__hamburgueriaViewContentStarted = true;

  const pixelId = '1648222293456055';
  const pageUrl = new URL(window.location.href);
  pageUrl.hash = '';
  const randomBytes = crypto.getRandomValues(new Uint8Array(16));
  const eventId = 'vc_' + Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');

  function readCookie(name) {
    try {
      const cookie = document.cookie.split('; ').find(value => value.startsWith(name + '='));
      return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : '';
    } catch {
      return '';
    }
  }

  // Preserve a real Meta click ID, including its original letter casing.
  let clickCookie = readCookie('_fbc');
  const clickId = pageUrl.searchParams.get('fbclid');
  if (clickId && /^[A-Za-z0-9_-]{1,1000}$/.test(clickId) && clickCookie.split('.')[3] !== clickId) {
    const domainIndex = Math.max(0, window.location.hostname.split('.').length - 1);
    clickCookie = `fb.${domainIndex}.${Date.now()}.${clickId}`;
    try {
      const secure = window.location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `_fbc=${encodeURIComponent(clickCookie)}; Max-Age=7776000; Path=/; SameSite=Lax${secure}`;
    } catch {
      // The server event can still use the click ID when cookies are unavailable.
    }
  }

  // Meta's queue lets ViewContent run as soon as the SDK finishes loading.
  if (!window.fbq) {
    const fbq = function () {
      if (fbq.callMethod) fbq.callMethod.apply(fbq, arguments);
      else fbq.queue.push(arguments);
    };
    window.fbq = fbq;
    if (!window._fbq) window._fbq = fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);
  }

  window.fbq('init', pixelId);
  window.fbq('trackSingle', pixelId, 'ViewContent', {
    content_name: 'Hamburgueria Lucrativa'
  }, { eventID: eventId });

  async function sendToServer(payload) {
    // A retry reuses the event ID so it represents the same page visit.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch('/api/view-content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          keepalive: true,
          body: JSON.stringify(payload)
        });
        if (response.ok) return;
        if (response.status < 500 && response.status !== 429) break;
      } catch {
        // Network failures get one retry without affecting the page controls.
      }
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.warn('ViewContent: o envio pelo servidor falhou. Confira os logs da Vercel.');
  }

  let serverEventStarted = false;
  function sendServerEvent() {
    if (serverEventStarted) return;
    serverEventStarted = true;
    window.removeEventListener('pagehide', sendServerEvent);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    void sendToServer({
      event_id: eventId,
      event_source_url: pageUrl.href,
      fbp: readCookie('_fbp'),
      fbc: readCookie('_fbc') || clickCookie
    });
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') sendServerEvent();
  }

  // Give the SDK a brief chance to create _fbp, but also send on a quick exit.
  window.addEventListener('pagehide', sendServerEvent);
  document.addEventListener('visibilitychange', onVisibilityChange);
  setTimeout(sendServerEvent, 800);
})();
