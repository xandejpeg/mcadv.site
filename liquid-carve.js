/* Liquid Carve Button — vanilla port (from Originkit React component).
   <liquid-carve href="..." label="..." fill="#c9a96e" text-color="#081120" blob="#d4b98a"
                 icon-left="bi-whatsapp" icon-right="bi-arrow-right" blob-size="64"></liquid-carve>
   A gooey blob (SVG mask + goo filter) carves the pill while tracking the cursor. */
(function () {
  var UID = 0;
  function reducedMotion() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  var proto = Object.create(HTMLElement.prototype);
  proto.connectedCallback = function () {
    if (this._init) return; this._init = true;
    var el = this, id = ++UID;
    var href = el.getAttribute('href') || '#';
    var label = el.getAttribute('label') || '';
    var fill = el.getAttribute('fill') || '#c9a96e';
    var text = el.getAttribute('text-color') || '#081120';
    var blob = el.getAttribute('blob') || '#d4b98a';
    var blobR = (parseFloat(el.getAttribute('blob-size')) || 64) / 2;
    var iconL = el.getAttribute('icon-left'), iconR = el.getAttribute('icon-right');
    el.style.display = 'inline-flex';
    var fid = 'lcgoo' + id, mid = 'lcbite' + id;
    var a = document.createElement('a');
    a.href = href;
    a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', label);
    a.style.cssText = 'position:relative;display:inline-flex;align-items:center;justify-content:center;padding:17px 34px;cursor:pointer;text-decoration:none;user-select:none;box-sizing:border-box;overflow:visible;-webkit-tap-highlight-color:transparent;';
    a.innerHTML =
      '<svg aria-hidden="true" width="100%" height="100%" style="position:absolute;inset:0;overflow:visible;z-index:1;filter:drop-shadow(0 6px 22px rgba(0,0,0,0.35))">' +
        '<defs>' +
          '<filter id="' + fid + '"><feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur"></feGaussianBlur><feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"></feColorMatrix></filter>' +
          '<mask id="' + mid + '"><rect x="0" y="0" width="100%" height="100%" fill="#fff"></rect>' +
            '<g data-follow style="transform-box:fill-box;transform-origin:center"><g data-squash style="transform-box:fill-box;transform-origin:center"><g data-bite style="transform-box:fill-box;transform-origin:center;transform:scale(0)"><circle cx="50%" cy="50%" r="' + blobR + '" fill="#000"></circle></g></g></g>' +
          '</mask>' +
        '</defs>' +
        '<g filter="url(#' + fid + ')"><rect data-lcr x="0" y="0" width="100%" height="100%" fill="' + blob + '"></rect></g>' +
        '<g filter="url(#' + fid + ')"><rect data-lcr x="0" y="0" width="100%" height="100%" fill="' + fill + '" mask="url(#' + mid + ')"></rect></g>' +
      '</svg>' +
      '<span style="position:relative;z-index:2;display:inline-flex;align-items:center;gap:10px;line-height:1;white-space:nowrap;font-family:Inter,sans-serif;font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:1px;color:' + text + ';pointer-events:none">' +
        (iconL ? '<i class="bi ' + iconL + '" style="font-size:16px"></i>' : '') +
        '<span>' + label + '</span>' +
        (iconR ? '<i class="bi ' + iconR + '" style="font-size:12px"></i>' : '') +
      '</span>';
    el.appendChild(a);

    var followG = a.querySelector('[data-follow]'), squashG = a.querySelector('[data-squash]'), biteG = a.querySelector('[data-bite]');
    var rects = a.querySelectorAll('rect[data-lcr]');
    function setR() {
      var r = a.offsetHeight / 2;
      for (var i = 0; i < rects.length; i++) { rects[i].setAttribute('rx', r); rects[i].setAttribute('ry', r); }
    }
    setR();
    try { new ResizeObserver(setR).observe(a); } catch (e) {}
    if (reducedMotion()) return;

    var st = { x: 0, y: 0, tx: 0, ty: 0, squash: 1, angle: 0, bite: 0, from: 0, to: 0, t0: 0, tweening: false };
    var raf = null, last = 0, hovered = false;
    function apply() {
      followG.style.transform = 'translate(' + st.x + 'px,' + st.y + 'px)';
      squashG.style.transform = 'rotate(' + st.angle + 'deg) scale(' + st.squash + ',' + (1 / st.squash) + ')';
      biteG.style.transform = 'scale(' + st.bite + ')';
    }
    function frame(now) {
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now;
      var k = 1 - Math.exp(-dt / 0.23);
      var dx = (st.tx - st.x) * k, dy = (st.ty - st.y) * k;
      st.x += dx; st.y += dy;
      var speed = Math.hypot(dx, dy) / dt;
      var want = Math.min(1.6, 1 + speed * 0.0011);
      st.squash += (want - st.squash) * (1 - Math.exp(-dt / 0.09));
      if (speed > 8) st.angle = Math.atan2(dy, dx) * 180 / Math.PI;
      if (st.tweening) {
        var p = Math.min(1, (now - st.t0) / 800);
        st.bite = st.from + (st.to - st.from) * easeInOut(p);
        if (p >= 1) st.tweening = false;
      }
      apply();
      if (hovered || st.tweening || st.bite > 0.001) raf = requestAnimationFrame(frame);
      else { raf = null; last = 0; }
    }
    function run() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } }
    function tweenTo(v) { st.from = st.bite; st.to = v; st.t0 = performance.now(); st.tweening = true; run(); }
    function off(e) {
      var r = a.getBoundingClientRect();
      return { dx: e.clientX - (r.left + r.width / 2), dy: e.clientY - (r.top + r.height / 2) };
    }
    a.addEventListener('pointerenter', function (e) {
      hovered = true;
      var o = off(e);
      st.tx = o.dx; st.ty = o.dy; st.x = o.dx; st.y = o.dy;
      tweenTo(1);
    });
    a.addEventListener('pointermove', function (e) {
      if (!hovered) return;
      var o = off(e); st.tx = o.dx; st.ty = o.dy; run();
    });
    a.addEventListener('pointerleave', function () { hovered = false; tweenTo(0); });
  };

  function LiquidCarve() { return Reflect.construct(HTMLElement, [], LiquidCarve); }
  LiquidCarve.prototype = proto;
  Object.setPrototypeOf(LiquidCarve, HTMLElement);
  if (!customElements.get('liquid-carve')) customElements.define('liquid-carve', LiquidCarve);
})();
