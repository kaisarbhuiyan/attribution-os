/**
 * Attribution OS — Lightweight First-Party JS Tracking Pixel
 * 
 * Instructions:
 * 1. Place this script in the <head> of your website or load it via Google Tag Manager.
 * 2. In production, change the `COLLECTOR_URL` variable to your SaaS endpoint (e.g. https://api.attributionos.com/v1/event).
 */
(function() {
  const COLLECTOR_URL = "https://api.attributionos.com/v1/event";
  const COOKIE_NAME = "_aos_visitor_id";
  const COOKIE_EXPIRY_DAYS = 365;

  // 1. Helper to generate a unique UUIDv4
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // 2. Cookie management helpers (First-party cookies bypass Safari/iOS ITP blocklists)
  function setCookie(name, value, days) {
    let expires = "";
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = "; expires=" + date.toUTCString();
    }
    // Set cookie on the root domain to track subdomains, with SameSite=Lax
    const domain = window.location.hostname.replace('www.', '');
    document.cookie = `${name}=${value}${expires}; path=/; domain=.${domain}; SameSite=Lax; Secure`;
  }

  function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }

  // 3. Resolve or initialize Visitor ID
  let visitorId = getCookie(COOKIE_NAME);
  if (!visitorId) {
    visitorId = generateUUID();
    setCookie(COOKIE_NAME, visitorId, COOKIE_EXPIRY_DAYS);
  }

  // 4. Parse UTM parameters & Click IDs
  function parseUTMs() {
    const urlParams = new URLSearchParams(window.location.search);
    const params = {};
    const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid', 'ttclid'];
    
    utmKeys.forEach(key => {
      const val = urlParams.get(key);
      if (val) params[key] = val;
    });

    // Fallback: If no utm_source is set but referrer is present, log organic/referral source
    if (!params.utm_source && document.referrer) {
      try {
        const referrerUrl = new URL(document.referrer);
        if (referrerUrl.hostname !== window.location.hostname) {
          params.utm_source = referrerUrl.hostname;
          params.utm_medium = "referral";
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }

    return params;
  }

  // 5. Send event payload to SaaS Collector
  function sendEvent(eventType, eventData = {}) {
    const utms = parseUTMs();
    const payload = {
      visitor_id: visitorId,
      event_type: eventType,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      referrer: document.referrer,
      user_agent: navigator.userAgent,
      // Campaign details
      utm_source: utms.utm_source || null,
      utm_medium: utms.utm_medium || null,
      utm_campaign: utms.utm_campaign || null,
      gclid: utms.gclid || null,
      fbclid: utms.fbclid || null,
      // Event values (revenue etc)
      value: eventData.value || null,
      currency: eventData.currency || "USD",
      metadata: eventData.metadata || {}
    };

    // Use beacon API if available (highly reliable on page exit), fallback to fetch
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon(COLLECTOR_URL, blob);
    } else {
      fetch(COLLECTOR_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(err => console.error("[AOS Pixel] Log failure:", err));
    }
  }

  // 6. Initialize Global SDK Namespace
  window.AOS = {
    visitorId: visitorId,
    track: sendEvent,
    trackPurchase: function(value, currency = "USD", metadata = {}) {
      sendEvent("purchase", { value: value, currency: currency, metadata: metadata });
    },
    trackLead: function(leadType, metadata = {}) {
      sendEvent("lead", { metadata: { ...metadata, lead_type: leadType } });
    }
  };

  // 7. Auto-track page_view on script load
  sendEvent("page_view");
})();
