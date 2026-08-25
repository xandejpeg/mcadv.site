/* Sticker Peel — vanilla JS + Three.js port (from Originkit React component).
   <sticker-peel src="logo.png" label="B3" width="170" height="112" back="#2a2213" bg="#f7f1e6"
                 hover-peel="45" press-peel="64" curl-rotation="240"></sticker-peel>
   static="1" → always renders the flat chip (used for marquee clones).
   WebGL scenes are built lazily (IntersectionObserver) and disposed when far off-screen,
   so a row of stickers never holds more contexts than needed. */
(function () {
  var CAMERA_DISTANCE = 1200, CAMERA_NEAR = 100, CAMERA_FAR = 2000, DEPTH = 0.003, SCALE = 3;
  var GRID_X = 30, GRID_Y = 30, SEG_W = 60, SEG_H = 45;
  var FIXED_CURL_RADIUS = 0.15, FIXED_CURL_FACTOR = 0.6;

  function mapLinear(v, a, b, c, d) { if (b === a) return c; return c + ((v - a) / (b - a)) * (d - c); }
  function radiusUI(ui) { var cl = Math.max(0.1, Math.min(1, ui)); return mapLinear(cl, 0.1, 1, 0.05, 1 / Math.PI); }
  function calcFov(w, h, dist) { var aspect = w / h; return 2 * Math.atan((w / aspect) / (2 * dist)) * (180 / Math.PI); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function reducedMotion() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Compose the sticker face: cream rounded chip + centered logo + subtle sheen.
  function makeChipCanvas(img, w, h, bg) {
    var s = 2, c = document.createElement('canvas');
    c.width = w * s; c.height = h * s;
    var ctx = c.getContext('2d'), r = 13 * s;
    roundRectPath(ctx, 1 * s, 1 * s, c.width - 2 * s, c.height - 2 * s, r);
    ctx.fillStyle = bg || '#f7f1e6';
    ctx.fill();
    var grad = ctx.createLinearGradient(0, 0, 0, c.height * 0.5);
    grad.addColorStop(0, 'rgba(255,255,255,0.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save(); ctx.clip(); ctx.fillStyle = grad; ctx.fillRect(0, 0, c.width, c.height * 0.5); ctx.restore();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(184,148,77,0.35)';
    roundRectPath(ctx, 1 * s, 1 * s, c.width - 2 * s, c.height - 2 * s, r);
    ctx.stroke();
    if (img) {
      var pad = 0.17, aw = c.width * (1 - pad * 2), ah = c.height * (1 - pad * 2);
      var k = Math.min(aw / img.width, ah / img.height);
      var dw = img.width * k, dh = img.height * k;
      ctx.drawImage(img, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
    }
    return c;
  }

  function makeBackCanvas(front, color) {
    var c = document.createElement('canvas');
    c.width = front.width; c.height = front.height;
    var ctx = c.getContext('2d');
    ctx.drawImage(front, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color || '#241c10';
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }

  var proto = Object.create(HTMLElement.prototype);

  proto.attributeChangedCallback = function (name, oldV, newV) {
    if (name === 'hover-peel') this._hoverPeel = parseFloat(newV) || 45;
    if (name === 'press-peel') this._pressPeel = parseFloat(newV) || 64;
  };

  proto.connectedCallback = function () {
    if (this._init) return;
    this._init = true;
    var el = this;
    el._hoverPeel = parseFloat(el.getAttribute('hover-peel')) || 45;
    el._pressPeel = parseFloat(el.getAttribute('press-peel')) || 64;
    el._curlRotation = parseFloat(el.getAttribute('curl-rotation')) || 240;
    el._dur = parseFloat(el.getAttribute('duration')) || 0.6;
    var w = parseFloat(el.getAttribute('width')) || 170;
    var h = parseFloat(el.getAttribute('height')) || 112;
    el._w = w; el._h = h;
    // The host runtime may rewrite style="" on re-render; re-assert our sizing.
    el._applyHostStyle = function () {
      el.style.position = 'relative';
      el.style.display = 'inline-block';
      el.style.width = el._w + 'px';
      el.style.height = el._h + 'px';
      el.style.flexShrink = '0';
      el.style.touchAction = 'pan-y';
      el.style.webkitTapHighlightColor = 'transparent';
    };
    el._applyHostStyle();
    try {
      new MutationObserver(function () {
        if (el.style.width !== el._w + 'px') el._applyHostStyle();
      }).observe(el, { attributes: true, attributeFilter: ['style'] });
    } catch (e) {}
    if (el.getAttribute('label')) el.setAttribute('aria-label', 'Cliente: ' + el.getAttribute('label'));

    // Pointer events registered ONCE; they call whatever scene is currently built.
    el.addEventListener('pointerenter', function () { if (el._peelEnter) el._peelEnter(); });
    el.addEventListener('pointerleave', function () { if (el._peelLeave) el._peelLeave(); });
    el.addEventListener('pointerdown', function () { if (el._peelDown) el._peelDown(); });
    el.addEventListener('pointerup', function () { if (el._peelUp) el._peelUp(); });
    window.addEventListener('pointerup', function () { if (el._peelUp) el._peelUp(); });

    var img = new Image();
    img.onload = function () {
      el._chip = makeChipCanvas(img, w, h, el.getAttribute('bg'));
      el._start();
    };
    img.onerror = function () { el._chip = makeChipCanvas(null, w, h, el.getAttribute('bg')); el._start(); };
    img.src = el.getAttribute('src');
  };

  proto._start = function () {
    var el = this;
    el._fallback();
    if (reducedMotion() || el.getAttribute('static') === '1') return;
    // Proximity check via scroll position (IntersectionObserver is unreliable in
    // embedded previews): build when within ~1 viewport, dispose when far away.
    var pending = false;
    var check = function () {
      pending = false;
      var r = el.getBoundingClientRect();
      var vh = window.innerHeight || 800;
      if (r.bottom > -320 && r.top < vh + 320) el._waitBuild();
      else if (r.bottom < -3 * vh || r.top > 4 * vh) el._teardown();
    };
    var onScroll = function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(check);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    check();
  };

  proto._waitBuild = function () {
    var el = this;
    if (el._canvasEl || el._building) return;
    el._building = true;
    var tries = 0;
    (function waitTHREE() {
      if (!el._building) return;
      if (window.THREE) {
        el._building = false;
        try { el._build(); el._removeFallback(); } catch (e) { /* keep static chip */ }
        return;
      }
      if (++tries > 200) { el._building = false; return; }
      setTimeout(waitTHREE, 50);
    })();
  };

  proto._teardown = function () {
    this._building = false;
    if (this._dispose) { try { this._dispose(); } catch (e) {} this._dispose = null; }
    this._fallback();
  };

  proto._fallback = function () {
    var el = this;
    if (el._canvasEl || el._fallbackImg || !el._chip) return;
    var im = document.createElement('img');
    im.src = el._chip.toDataURL('image/png');
    im.alt = el.getAttribute('label') || '';
    im.style.cssText = 'width:100%;height:100%;display:block;border-radius:13px;box-shadow:0 10px 26px rgba(0,0,0,0.35);transition:transform .3s ease;';
    el.appendChild(im);
    el._fallbackImg = im;
    if (!el._fbHooked) {
      el._fbHooked = true;
      el.addEventListener('pointerenter', function () { if (el._fallbackImg) el._fallbackImg.style.transform = 'translateY(-6px) rotate(-1.5deg)'; });
      el.addEventListener('pointerleave', function () { if (el._fallbackImg) el._fallbackImg.style.transform = 'none'; });
    }
  };

  proto._removeFallback = function () {
    if (this._fallbackImg && this._fallbackImg.parentNode === this) this.removeChild(this._fallbackImg);
    this._fallbackImg = null;
  };

  proto._build = function () {
    var el = this, T = window.THREE;
    if (el._canvasEl) return;
    var w = el._w, h = el._h;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = w * SCALE, ch = h * SCALE;

    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;top:' + (-((SCALE - 1) / 2) * 100) + '%;left:' + (-((SCALE - 1) / 2) * 100) + '%;display:block;pointer-events:none;';
    el.appendChild(canvas);
    el._canvasEl = canvas;

    var renderer;
    try {
      renderer = new T.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    } catch (e) { el.removeChild(canvas); el._canvasEl = null; return; }
    var gl = renderer.getContext();
    if (!gl || gl.isContextLost()) { renderer.dispose(); el.removeChild(canvas); el._canvasEl = null; return; }
    renderer.setSize(Math.round(cw * dpr), Math.round(ch * dpr), false);
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    if (T.sRGBEncoding !== undefined) renderer.outputEncoding = T.sRGBEncoding;
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';

    var scene = new T.Scene();
    var camera = new T.PerspectiveCamera(calcFov(cw, ch, CAMERA_DISTANCE), cw / ch, CAMERA_NEAR, CAMERA_FAR);
    camera.position.set(0, 0, CAMERA_DISTANCE);
    camera.lookAt(0, 0, 0);

    // Geometry with 2D bilinear skinning onto a GRID_X × GRID_Y bone lattice.
    var geometry = new T.BoxGeometry(w, h, DEPTH, SEG_W, SEG_H, 1);
    var position = geometry.attributes.position;
    var vertex = new T.Vector3();
    var skinIndexes = [], skinWeights = [];
    for (var i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i);
      var nx = (vertex.x + w / 2) / w, ny = (vertex.y + h / 2) / h;
      var gx = nx * (GRID_X - 1), gy = ny * (GRID_Y - 1);
      var x0 = Math.floor(gx), y0 = Math.floor(gy);
      var x1 = Math.min(x0 + 1, GRID_X - 1), y1 = Math.min(y0 + 1, GRID_Y - 1);
      var tx = gx - x0, ty = gy - y0;
      skinIndexes.push(y0 * GRID_X + x0, y0 * GRID_X + x1, y1 * GRID_X + x0, y1 * GRID_X + x1);
      skinWeights.push((1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty);
    }
    geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(skinIndexes, 4));
    geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(skinWeights, 4));
    geometry.computeVertexNormals();

    var bones = [], initialPos = [];
    var sx = w / (GRID_X - 1), sy = h / (GRID_Y - 1);
    for (var by = 0; by < GRID_Y; by++) {
      for (var bx = 0; bx < GRID_X; bx++) {
        var bone = new T.Bone();
        bone.position.set(-w / 2 + bx * sx, -h / 2 + by * sy, 0);
        bones.push(bone);
        initialPos.push(bone.position.clone());
      }
    }
    var skeleton = new T.Skeleton(bones);

    var frontTex = new T.CanvasTexture(el._chip);
    frontTex.minFilter = T.LinearFilter;
    if (T.sRGBEncoding !== undefined) frontTex.encoding = T.sRGBEncoding;
    var backColor = el.getAttribute('back') || '#241c10';
    var backTex = new T.CanvasTexture(makeBackCanvas(el._chip, backColor));
    backTex.minFilter = T.LinearFilter;
    if (T.sRGBEncoding !== undefined) backTex.encoding = T.sRGBEncoding;
    backTex.wrapS = T.RepeatWrapping;
    backTex.repeat.x = -1;
    backTex.offset.x = 1;
    backTex.needsUpdate = true;

    var frontMat = new T.MeshStandardMaterial({
      map: frontTex, side: T.FrontSide, transparent: true, alphaTest: 0.01, skinning: true,
      roughness: 0.2, metalness: 0.4, emissive: 0xffffff, emissiveIntensity: 0.8, emissiveMap: frontTex
    });
    var backMat = new T.MeshStandardMaterial({
      map: backTex, side: T.FrontSide, transparent: true, alphaTest: 0.01, skinning: true,
      roughness: 0.3, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0.3, emissiveMap: backTex
    });
    var sideMat = new T.MeshStandardMaterial({ color: new T.Color(backColor), transparent: true, roughness: 0.1, metalness: 0, skinning: true });
    // BoxGeometry face order: +X, -X, +Y, -Y, +Z (front), -Z (back)
    var mesh = new T.SkinnedMesh(geometry, [sideMat, sideMat, sideMat, sideMat, frontMat, backMat]);
    mesh.frustumCulled = false;
    bones.forEach(function (b) { mesh.add(b); b.updateMatrixWorld(true); });
    mesh.bind(skeleton);
    mesh.updateMatrixWorld(true);
    skeleton.update && skeleton.update();
    mesh.castShadow = true;
    scene.add(mesh);

    scene.add(new T.AmbientLight(0xffffff, 0.4));
    var light = new T.DirectionalLight(0xffffff, 2.0);
    light.position.set(-300, 140, 400);
    light.castShadow = true;
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;
    light.shadow.camera.near = 1;
    light.shadow.camera.far = 2000;
    light.shadow.bias = -0.00001;
    light.shadow.radius = 8;
    var base = Math.max(cw, ch);
    var shadowSize = Math.max(base, base * (3.5 / SCALE));
    var offX = -300 * 0.3, offY = 140 * 0.3;
    light.shadow.camera.left = -shadowSize / 2 + offX;
    light.shadow.camera.right = shadowSize / 2 + offX;
    light.shadow.camera.top = shadowSize / 2 + offY;
    light.shadow.camera.bottom = -shadowSize / 2 + offY;
    scene.add(light);

    var shadowMat = new T.ShadowMaterial({ opacity: 0.3, color: new T.Color(0x000000) });
    var planeGeo = new T.PlaneGeometry(shadowSize, shadowSize);
    var plane = new T.Mesh(planeGeo, shadowMat);
    plane.receiveShadow = true;
    plane.position.set(0, 0, -1);
    scene.add(plane);

    // --- curl deformation (semicircle mode, fixed tightness) ---
    var scratchQuat = new T.Quaternion(), rotAxis = new T.Vector3();
    var amount = 0;
    function updateBones() {
      var a = Math.min(1, Math.max(0, amount));
      var curlStart = 1 - a;
      var curlFactor = a <= 0 ? 1e-4 : FIXED_CURL_FACTOR;
      var r = radiusUI(FIXED_CURL_RADIUS);
      var rad = el._curlRotation * (Math.PI / 180);
      var dirX = Math.cos(rad), dirY = Math.sin(rad);
      rotAxis.set(-dirY, dirX, 0).normalize();
      var hw = w / 2, hh = h / 2;
      var maxDist = Math.max(hw * dirX + hh * dirY, hw * dirX - hh * dirY, -hw * dirX + hh * dirY, -hw * dirX - hh * dirY);
      var diag = Math.sqrt(w * w + h * h);
      var foldOffset = -maxDist + curlStart * 2 * maxDist;
      var radiusWorld = r * (diag / 2);
      var RPrime = radiusWorld / curlFactor;
      var arcLimit = Math.PI * radiusWorld;
      for (var i = 0; i < bones.length; i++) {
        var b = bones[i], p0 = initialPos[i];
        var signed = (p0.x * dirX + p0.y * dirY) - foldOffset;
        if (signed > 0) {
          var xRel, zRel, finalAngle;
          var ang = (signed * curlFactor) / radiusWorld;
          if (signed <= arcLimit) {
            xRel = RPrime * Math.sin(ang);
            zRel = RPrime * (1 - Math.cos(ang));
            finalAngle = ang;
          } else {
            var Phi = Math.PI * curlFactor;
            var xEnd = RPrime * Math.sin(Phi), zEnd = RPrime * (1 - Math.cos(Phi));
            var extra = signed - arcLimit;
            xRel = xEnd + extra * Math.cos(Phi);
            zRel = zEnd + extra * Math.sin(Phi);
            finalAngle = Phi;
          }
          var dx = xRel - signed;
          b.position.set(p0.x + dx * dirX, p0.y + dx * dirY, p0.z + zRel);
          scratchQuat.setFromAxisAngle(rotAxis, -finalAngle);
          b.quaternion.copy(scratchQuat);
        } else {
          b.position.copy(p0);
          b.quaternion.identity();
        }
      }
    }

    function renderFrame() {
      mesh.updateMatrixWorld(true);
      renderer.render(scene, camera);
    }

    // --- tween (0.6s easeInOut by default) ---
    var raf = null, anim = null;
    function animateTo(target) {
      if (raf) cancelAnimationFrame(raf);
      var from = amount, start = performance.now(), dur = el._dur * 1000;
      anim = true;
      function step(now) {
        if (!anim) return;
        var t = Math.min(1, (now - start) / dur);
        amount = from + (target - from) * easeInOut(t);
        updateBones();
        renderFrame();
        if (t < 1) { raf = requestAnimationFrame(step); } else { anim = null; raf = null; }
      }
      raf = requestAnimationFrame(step);
    }

    var hovering = false, pressed = false;
    el._peelEnter = function () {
      if (hovering) return;
      hovering = true;
      el.style.cursor = 'pointer';
      if (!pressed) animateTo(el._hoverPeel / 100);
    };
    el._peelLeave = function () {
      hovering = false; pressed = false;
      el.style.cursor = 'auto';
      animateTo(0);
    };
    el._peelDown = function () {
      pressed = true;
      animateTo(el._pressPeel / 100);
    };
    el._peelUp = function () {
      if (!pressed) return;
      pressed = false;
      animateTo(hovering ? el._hoverPeel / 100 : 0);
    };

    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      if (el._canvasEl) el._canvasEl.style.display = 'none';
      el._fallback();
    }, false);
    canvas.addEventListener('webglcontextrestored', function () {
      if (el._canvasEl) el._canvasEl.style.display = 'block';
      el._removeFallback();
      updateBones();
      renderFrame();
    }, false);

    el._dispose = function () {
      anim = null;
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      el._peelEnter = el._peelLeave = el._peelDown = el._peelUp = null;
      try {
        geometry.dispose(); planeGeo.dispose();
        frontTex.dispose(); backTex.dispose();
        frontMat.dispose(); backMat.dispose(); sideMat.dispose(); shadowMat.dispose();
        renderer.dispose();
        if (renderer.forceContextLoss) renderer.forceContextLoss();
      } catch (e) {}
      if (canvas.parentNode === el) el.removeChild(canvas);
      el._canvasEl = null;
    };

    updateBones();
    renderFrame();
  };

  function StickerPeel() { return Reflect.construct(HTMLElement, [], StickerPeel); }
  StickerPeel.prototype = proto;
  Object.setPrototypeOf(StickerPeel, HTMLElement);
  StickerPeel.observedAttributes = ['hover-peel', 'press-peel'];
  if (!customElements.get('sticker-peel')) customElements.define('sticker-peel', StickerPeel);
})();
