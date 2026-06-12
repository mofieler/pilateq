/**
 * PilatesOS public schedule embed (iframe + auto-height).
 *
 * Usage — place once per page, before closing </body>:
 *   <div id="studio-schedule"></div>
 *   <script
 *     src="https://YOUR-APP/embed-schedule-loader.js"
 *     data-base-url="https://YOUR-APP"
 *     data-target="studio-schedule"
 *     async
 *   ></script>
 *
 * Optional attributes on the script tag:
 *   data-base-url   Booking app origin (defaults to script host)
 *   data-target     Element id to mount into (default: studio-schedule)
 *   data-week       Initial yyyy-MM-dd (week containing that day is shown)
 */
(function () {
  var script = document.currentScript;
  if (!script) return;

  var base = script.getAttribute('data-base-url');
  if (!base) {
    try {
      base = new URL(script.src).origin;
    } catch (e) {
      return;
    }
  }
  base = String(base).replace(/\/$/, '');

  var targetId = script.getAttribute('data-target') || 'studio-schedule';
  var week = script.getAttribute('data-week') || '';
  var locale = script.getAttribute('data-locale') || '';
  var hideSpots = script.getAttribute('data-hide-spots') || '';
  var mount = document.getElementById(targetId);
  if (!mount) {
    mount = document.createElement('div');
    mount.id = targetId;
    script.parentNode.insertBefore(mount, script.nextSibling);
  }

  var queryParams = [];
  if (week) queryParams.push('date=' + encodeURIComponent(week));
  if (locale) queryParams.push('locale=' + encodeURIComponent(locale));
  if (hideSpots === '1' || hideSpots === 'true') queryParams.push('hide-spots=1');
  var qs = queryParams.length ? '?' + queryParams.join('&') : '';

  var iframe = document.createElement('iframe');
  iframe.src = base + '/embed/schedule' + qs;
  iframe.title = 'Weekly class schedule';
  iframe.loading = 'lazy';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.setAttribute(
    'style',
    'width:100%;max-width:100%;border:0;display:block;min-height:420px;background:#faf9f7;border-radius:12px',
  );
  mount.appendChild(iframe);

  var expectedOrigin;
  try {
    expectedOrigin = new URL(base).origin;
  } catch (e2) {
    return;
  }

  function onMessage(ev) {
    if (ev.origin !== expectedOrigin) return;
    if (!ev.data || ev.data.type !== 'embed-resize') return;
    var h = ev.data.height;
    if (typeof h === 'number' && h >= 200 && h < 20000) {
      iframe.style.height = Math.round(h) + 'px';
    }
  }

  window.addEventListener('message', onMessage);
})();
