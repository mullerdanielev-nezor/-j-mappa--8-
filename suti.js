// Sütikezelés: hozzájárulás kérése kategóriánként, Google Consent Mode v2, és a mérőkódok
// (Google Analytics 4, Meta Pixel) betöltése CSAK a látogató hozzájárulása után.
//
// BEÁLLÍTÁS: írd be az azonosítókat. Üresen hagyva az adott eszköz nem töltődik be.
var SUTI_BEALLITAS = {
  GA4_AZONOSITO: '',        // pl. 'G-XXXXXXXXXX'
  META_PIXEL_AZONOSITO: '1500364028565532',
  VERZIO: 1,                // ha új sütit/eszközt vezetsz be, növeld: mindenkitől újra kérünk hozzájárulást
  LEJARAT_NAP: 180          // ennyi nap után újra megkérdezzük a látogatót
};

(function () {
  var B = SUTI_BEALLITAS;
  var SUTI_NEV = 'uv4you_suti_hozzajarulas';
  var SCRIPT_SRC = document.currentScript ? document.currentScript.src : '';
  var SUTIK_URL = SCRIPT_SRC ? SCRIPT_SRC.replace(/suti\.js.*$/, 'sutik.html') : 'sutik.html';

  // --- Google Consent Mode v2: alapból minden mérés tiltva ---
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });

  // A korábbi, csak tájékoztató sáv bejegyzésének eltávolítása.
  try { localStorage.removeItem('uv4you-suti-ok'); } catch (e) {}

  // --- Hozzájárulás olvasása / írása ---
  function olvas() {
    var m = document.cookie.match(new RegExp('(?:^|; )' + SUTI_NEV + '=([^;]*)'));
    if (!m) return null;
    try {
      var d = JSON.parse(decodeURIComponent(m[1]));
      return d && d.v === B.VERZIO ? d : null;
    } catch (e) { return null; }
  }

  function ir(statisztika, marketing) {
    var d = { v: B.VERZIO, s: !!statisztika, m: !!marketing, t: new Date().toISOString() };
    var lejar = new Date(Date.now() + B.LEJARAT_NAP * 864e5).toUTCString();
    var biztonsagos = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = SUTI_NEV + '=' + encodeURIComponent(JSON.stringify(d)) + '; expires=' + lejar + '; path=/; SameSite=Lax' + biztonsagos;
    return d;
  }

  // Sütik törlése név (vagy előtag) alapján, a domain összes szintjén.
  function torol(minta) {
    var nevek = document.cookie.split('; ').map(function (c) { return c.split('=')[0]; });
    var host = location.hostname.split('.');
    var domainek = [''];
    for (var i = 0; i < host.length - 1; i++) domainek.push('; domain=.' + host.slice(i).join('.'));
    nevek.forEach(function (n) {
      if (!minta.test(n)) return;
      domainek.forEach(function (dm) {
        document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + dm;
      });
    });
  }

  // --- Mérőkódok betöltése ---
  var betoltve = { s: false, m: false };

  function scriptBetolt(src) {
    var s = document.createElement('script');
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }

  function alkalmaz(d) {
    gtag('consent', 'update', {
      analytics_storage: d.s ? 'granted' : 'denied',
      ad_storage: d.m ? 'granted' : 'denied',
      ad_user_data: d.m ? 'granted' : 'denied',
      ad_personalization: d.m ? 'granted' : 'denied'
    });

    if (d.s && !betoltve.s && B.GA4_AZONOSITO) {
      betoltve.s = true;
      scriptBetolt('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(B.GA4_AZONOSITO));
      gtag('js', new Date());
      gtag('config', B.GA4_AZONOSITO);
    }

    if (d.m && !betoltve.m && B.META_PIXEL_AZONOSITO) {
      betoltve.m = true;
      /* Meta Pixel alapkód */
      !function (f, b, e, v, n, t, s) {
        if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
        if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
        t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
      }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', B.META_PIXEL_AZONOSITO);
      fbq('track', 'PageView');
    }

    // Bármilyen további kód, amit így jelölsz meg a HTML-ben:
    // <script type="text/plain" data-suti-kategoria="statisztika|marketing"> ... </script>
    document.querySelectorAll('script[type="text/plain"][data-suti-kategoria]').forEach(function (el) {
      var kat = el.getAttribute('data-suti-kategoria');
      if ((kat === 'statisztika' && d.s) || (kat === 'marketing' && d.m)) {
        var uj = document.createElement('script');
        if (el.src) uj.src = el.src; else uj.textContent = el.textContent;
        el.parentNode.replaceChild(uj, el);
      }
    });

    // "Érdeklődő" (Lead) konverzió a köszönjük oldalon. Frissítésre nem számol újra.
    if (document.body.getAttribute('data-konverzio') === 'ajanlatkeres') {
      var mar = false;
      try { mar = sessionStorage.getItem('uv4you-lead-elkuldve') === '1'; } catch (e) {}
      var elment = false;
      if (!mar && d.s && B.GA4_AZONOSITO) { gtag('event', 'generate_lead'); elment = true; }
      if (!mar && d.m && B.META_PIXEL_AZONOSITO) { fbq('track', 'Lead'); elment = true; }
      if (elment) { try { sessionStorage.setItem('uv4you-lead-elkuldve', '1'); } catch (e) {} }
    }
  }

  function mentes(statisztika, marketing) {
    var elozo = olvas();
    var d = ir(statisztika, marketing);
    // Visszavonás: a már lerakott sütiket töröljük, és újratöltünk, hogy a futó kódok leálljanak.
    var visszavont = elozo && ((elozo.s && !d.s) || (elozo.m && !d.m));
    if (!d.s) torol(/^_ga/);
    if (!d.m) torol(/^(_fbp|_fbc)$/);
    savBezar();
    ablakBezar();
    if (visszavont) { location.reload(); return; }
    alkalmaz(d);
  }

  // --- Felület: sáv ("Elfogadom" / "Elutasítom" / "Beállítások") és beállítási ablak ---
  var STILUS = '' +
    '#suti-sav{position:fixed;left:16px;right:16px;bottom:16px;z-index:90;max-width:720px;margin:0 auto;background:#fff;color:#0b0b12;border:1.5px solid #d3d5de;border-radius:16px;box-shadow:0 16px 48px rgba(11,11,18,.18);padding:20px 22px;font-family:Manrope,system-ui,sans-serif;font-size:15px;line-height:1.55;box-sizing:border-box}' +
    '#suti-sav h2,#suti-ablak h2{margin:0 0 6px;font-family:Archivo,sans-serif;font-weight:800;font-size:20px;letter-spacing:-.01em}' +
    '#suti-sav p{margin:0 0 16px;color:#33354a}' +
    '.suti-gombok{display:flex;flex-wrap:wrap;gap:10px}' +
    '.suti-gomb{font:inherit;font-weight:800;font-size:16px;min-height:48px;padding:0 20px;border-radius:9px;cursor:pointer;flex:1 1 150px;border:2px solid #6a2bff;background:#6a2bff;color:#fff}' +
    '.suti-gomb.masodlagos{background:#fff;color:#4a1fd6}' +
    '.suti-gomb:focus-visible,.suti-kapcsolo input:focus-visible+span{outline:3px solid #0b0b12;outline-offset:2px}' +
    '#suti-hatter{position:fixed;inset:0;z-index:95;background:rgba(11,11,18,.55);display:flex;align-items:center;justify-content:center;padding:16px}' +
    '#suti-ablak{background:#fff;color:#0b0b12;border-radius:16px;max-width:620px;width:100%;max-height:calc(100vh - 32px);overflow:auto;padding:24px;font-family:Manrope,system-ui,sans-serif;font-size:15px;line-height:1.55;box-sizing:border-box}' +
    '#suti-ablak>p{margin:0 0 18px;color:#33354a}' +
    '.suti-kat{border-top:1.5px solid #e3e4ea;padding:16px 0}' +
    '.suti-kat-fej{display:flex;align-items:center;justify-content:space-between;gap:16px}' +
    '.suti-kat-fej strong{font-family:Archivo,sans-serif;font-size:17px}' +
    '.suti-kat p{margin:6px 0 0;color:#4a4d5a}' +
    '.suti-kapcsolo{position:relative;display:inline-flex;align-items:center;gap:8px;cursor:pointer;flex:none;min-height:44px}' +
    '.suti-kapcsolo input{position:absolute;opacity:0;width:1px;height:1px}' +
    '.suti-kapcsolo span{width:46px;height:26px;border-radius:13px;background:#c4c6d0;position:relative;transition:background .2s}' +
    '.suti-kapcsolo span::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .2s}' +
    '.suti-kapcsolo input:checked+span{background:#6a2bff}' +
    '.suti-kapcsolo input:checked+span::after{transform:translateX(20px)}' +
    '.suti-kapcsolo input:disabled+span{opacity:.55;cursor:not-allowed}' +
    '.suti-kapcsolo em{font-style:normal;font-size:13px;color:#4a4d5a}' +
    '#suti-ablak .suti-gombok{margin-top:8px}';

  function stilus() {
    if (document.getElementById('suti-stilus')) return;
    var s = document.createElement('style');
    s.id = 'suti-stilus';
    s.textContent = STILUS;
    document.head.appendChild(s);
  }

  function savMutat() {
    stilus();
    if (document.getElementById('suti-sav')) return;
    var sav = document.createElement('div');
    sav.id = 'suti-sav';
    sav.setAttribute('role', 'region');
    sav.setAttribute('aria-label', 'Sütik');
    sav.innerHTML =
      '<h2>Sütiket használunk</h2>' +
      '<p>A weboldal működéséhez szükséges sütik mindig aktívak. Ha elfogadod, statisztikai sütikkel (Google Analytics) mérjük a látogatottságot, marketing sütikkel (Meta Pixel) pedig a hirdetéseink eredményességét. A Beállításokban kategóriánként is választhatsz. <a href="' + SUTIK_URL + '" style="color:#4a1fd6;font-weight:700">Részletek a sütikről</a></p>' +
      '<div class="suti-gombok">' +
      '<button type="button" class="suti-gomb" data-suti="mind">Elfogadom</button>' +
      '<button type="button" class="suti-gomb" data-suti="semmi">Elutasítom</button>' +
      '<button type="button" class="suti-gomb masodlagos" data-suti="beallitas">Beállítások</button>' +
      '</div>';
    sav.addEventListener('click', function (e) {
      var g = e.target.getAttribute && e.target.getAttribute('data-suti');
      if (g === 'mind') mentes(true, true);
      else if (g === 'semmi') mentes(false, false);
      else if (g === 'beallitas') ablakMutat();
    });
    document.body.appendChild(sav);
  }

  function savBezar() {
    var sav = document.getElementById('suti-sav');
    if (sav) sav.remove();
  }

  var elozoFokusz = null;

  function kategoria(id, cim, leiras, bekapcsolva, tiltott) {
    return '<div class="suti-kat"><div class="suti-kat-fej"><strong id="' + id + '-cim">' + cim + '</strong>' +
      '<label class="suti-kapcsolo"><input type="checkbox" id="' + id + '" aria-labelledby="' + id + '-cim"' +
      (bekapcsolva ? ' checked' : '') + (tiltott ? ' disabled' : '') + '><span></span>' +
      (tiltott ? '<em>Mindig aktív</em>' : '') + '</label></div><p>' + leiras + '</p></div>';
  }

  function ablakMutat() {
    stilus();
    if (document.getElementById('suti-hatter')) return;
    var d = olvas() || { s: false, m: false };
    elozoFokusz = document.activeElement;
    var hatter = document.createElement('div');
    hatter.id = 'suti-hatter';
    hatter.innerHTML =
      '<div id="suti-ablak" role="dialog" aria-modal="true" aria-labelledby="suti-ablak-cim">' +
      '<h2 id="suti-ablak-cim">Sütibeállítások</h2>' +
      '<p>Válaszd ki, mely sütiket engeded. A döntésedet később is megváltoztathatod az oldal alján a „Sütibeállítások” linkkel. Részletek: <a href="' + SUTIK_URL + '" style="color:#4a1fd6;font-weight:700">Sütik</a>.</p>' +
      kategoria('suti-k-szukseges', 'Szükséges sütik', 'Az oldal alapvető működéséhez kellenek, például ez tárolja a sütikkel kapcsolatos döntésedet. Nem kapcsolhatók ki.', true, true) +
      kategoria('suti-k-statisztika', 'Statisztikai sütik', 'Azt mérik, hány látogató érkezik, és mely oldalakat nézik meg (Google Analytics). Ebből tudjuk javítani az oldalt.', d.s, false) +
      kategoria('suti-k-marketing', 'Marketing sütik', 'A hirdetéseink eredményességét mérik, és lehetővé teszik, hogy a Facebookon és az Instagramon releváns hirdetést mutassunk neked (Meta Pixel).', d.m, false) +
      '<div class="suti-gombok">' +
      '<button type="button" class="suti-gomb" data-suti="mentes">Mentés</button>' +
      '<button type="button" class="suti-gomb" data-suti="mind">Elfogadom mind</button>' +
      '<button type="button" class="suti-gomb" data-suti="semmi">Elutasítom mind</button>' +
      '</div></div>';
    hatter.addEventListener('click', function (e) {
      if (e.target === hatter) { ablakBezar(); return; }
      var g = e.target.getAttribute && e.target.getAttribute('data-suti');
      if (g === 'mentes') mentes(document.getElementById('suti-k-statisztika').checked, document.getElementById('suti-k-marketing').checked);
      else if (g === 'mind') mentes(true, true);
      else if (g === 'semmi') mentes(false, false);
    });
    hatter.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { ablakBezar(); return; }
      if (e.key !== 'Tab') return;
      var f = hatter.querySelectorAll('a[href], button, input:not([disabled])');
      var elso = f[0], utolso = f[f.length - 1];
      if (e.shiftKey && document.activeElement === elso) { e.preventDefault(); utolso.focus(); }
      else if (!e.shiftKey && document.activeElement === utolso) { e.preventDefault(); elso.focus(); }
    });
    document.body.appendChild(hatter);
    document.getElementById('suti-k-statisztika').focus();
  }

  function ablakBezar() {
    var h = document.getElementById('suti-hatter');
    if (!h) return;
    h.remove();
    if (elozoFokusz && elozoFokusz.focus) elozoFokusz.focus();
  }

  window.sutiBeallitasok = ablakMutat;

  function indul() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest && e.target.closest('[data-suti-beallitasok]');
      if (el) { e.preventDefault(); ablakMutat(); }
    });
    var d = olvas();
    if (d) alkalmaz(d);
    else savMutat();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', indul);
  else indul();
})();
