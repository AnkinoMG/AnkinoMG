/* ============================================================
   ANKINO MG — hero-canvas.js
   Moteur canvas du hero : orbite, particules, drag & drop,
   trails, side panels animation
   Chargement : <script src="/js/hero-canvas.js" defer></script>
   ============================================================ */

/* ===== MOTION DESIGN HERO ENGINE ===== */
!function(){
  var canvas    = document.getElementById('mdCanvas');
  if(!canvas) return;
  var ctx       = canvas.getContext('2d');
  var container = document.getElementById('mdContainer');

  var palette = ['#F8BA08','#FF7F00','#00BCD4','#FF6F61','#A2D9FF','#9EE6CF','#A777FF'];

  /*
   * Une seule orbite circulaire.
   * Rayon = calculé dynamiquement depuis la taille réelle du conteneur,
   *         le rayon du logo et la demi-largeur d'une carte.
   * Toutes les icônes tournent dans le même sens (horaire), même vitesse.
   * Espacement angulaire uniforme → jamais de superposition.
   *
   * Formule du rayon :
   *   logoR   = moitié du diamètre du logo (.c-logo = 120px → 60px)
   *   cardR   = moitié de la largeur d'une icône (.md-ico = 52px → 26px)
   *   labelH  = hauteur label + gap (≈18px)
   *   GAP     = espace libre entre bord logo et bord carte (20px min)
   *   ORBIT_R = logoR + GAP + cardR
   *
   * Côté responsive :
   *   - conteneur CSS = clamp(280px, 45vw, 460px) avec 460px sur ≥1024px
   *   - on calcule tout en % du conteneur pour s'adapter automatiquement
   */
  var CARD_COUNT   = 7;
  var ORBIT_SPEED  = 8;     // deg/s — lent, fluide

  var cards = [];
  for(var i = 0; i < CARD_COUNT; i++){
    var startAngle = (i / CARD_COUNT) * Math.PI * 2 - Math.PI / 2;
    cards.push({
      el:          document.getElementById('mdCard' + i),
      angle:       startAngle,
      radius:      0,
      cardHalf:    0,
      labelH:      18,   // hauteur label — mis à jour dans resize()
      color:       palette[i],
      opacity:     0,
      scale:       0,
      // Drag state
      dragging:    false,
      dragX:       0,
      dragY:       0,
      returning:   false,
      returnProgress: 0,
      _returnFromX: undefined,
      _returnFromY: undefined
    });
  }

  var particles   = [];
  var NUM_PARTICLES = 22;

  function resize(){
    var W = container.offsetWidth;
    var H = container.offsetHeight;
    canvas.width  = W * window.devicePixelRatio;
    canvas.height = H * window.devicePixelRatio;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Mesure réelle des éléments depuis le DOM
    var icoEl   = container.querySelector('.md-ico');
    var icoSize = icoEl ? icoEl.offsetWidth : (W <= 380 ? 40 : 52);
    var icoHalf = icoSize / 2;

    var lblEl = container.querySelector('.md-lbl');
    var lblH  = lblEl ? lblEl.offsetHeight : (W <= 380 ? 12 : 14);
    // labelH = hauteur totale du bloc label (incluant gap entre icône et texte)
    var labelH = lblH + 6;

    var logoEl   = container.querySelector('.c-logo');
    var logoDiam = logoEl ? logoEl.offsetWidth : (W <= 380 ? 88 : 120);
    var logoR    = logoDiam / 2;

    // Orbite — marge entre le bord du logo et le centre de l'icône
    // Desktop (W > 380) : GAP augmenté pour bien écarter les cartes du logo
    var GAP = W <= 380 ? 22 : 52;
    var orbitR = logoR + GAP + icoHalf;

    // Sécurité : l'icône + son label doivent rester dans le conteneur
    // En haut/bas : on doit laisser de la place pour le label (labelH px)
    var maxR = W / 2 - icoHalf - labelH - 4;
    if(orbitR > maxR) orbitR = maxR;

    cards.forEach(function(c){
      c.radius   = orbitR;
      c.cardHalf = icoHalf;
      c.labelH   = labelH;   // hauteur totale label (pour décalage continu)
    });

    particles = [];
    for(var j = 0; j < NUM_PARTICLES; j++){
      particles.push({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - .5) * .28, vy: (Math.random() - .5) * .28,
        r:  1 + Math.random() * 1.6,
        color:   palette[Math.floor(Math.random() * palette.length)],
        opacity: .08 + Math.random() * .15
      });
    }
  }

  // ── DRAG INTERACTION ──────────────────────────────────────────────────────
  cards.forEach(function(c){
    if(!c.el) return;
    c.el.style.pointerEvents = 'auto';
    c.el.style.touchAction   = 'none';
    c.el.style.cursor        = 'grab';

    function getPos(e){
      var touch = e.touches ? e.touches[0] : e;
      var rect  = container.getBoundingClientRect();
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    function onDown(e){
      e.preventDefault();
      c.dragging = true; c.returning = false;
      c.el.style.cursor  = 'grabbing';
      c.el.style.zIndex  = '999';
      var pos = getPos(e);
      c.dragX = pos.x - c.cardHalf;
      c.dragY = pos.y - c.cardHalf;
    }
    function onMove(e){
      if(!c.dragging) return;
      e.preventDefault();
      var pos = getPos(e);
      c.dragX = pos.x - c.cardHalf;
      c.dragY = pos.y - c.cardHalf;
    }
    function onUp(){
      if(!c.dragging) return;
      c.dragging = false; c.returning = true;
      c.returnProgress = 0;
      c._returnFromX = c.dragX;
      c._returnFromY = c.dragY;
      c.el.style.cursor = 'grab';
    }
    c.el.addEventListener('mousedown',  onDown);
    c.el.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup',  onUp);
    window.addEventListener('touchend', onUp);
  });

  function easeOutCubic(t)    { return 1 - Math.pow(1 - t, 3); }
  function easeInOutCubic(t)  { return t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }

  var startTime = null;
  var ENTER_DURATION = 1400;
  var trails    = cards.map(function(){ return []; });
  var MAX_TRAIL = 12;
  var lastTs    = null;

  function tick(ts){
    if(!startTime) startTime = ts;
    var dt      = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 0.016;
    lastTs      = ts;
    var enterT  = Math.min(1, (ts - startTime) / ENTER_DURATION);
    var ease    = easeOutCubic(enterT);
    var t       = ts / 1000;

    var W  = canvas.width  / window.devicePixelRatio;
    var H  = canvas.height / window.devicePixelRatio;
    var cx = W / 2, cy = H / 2;

    ctx.clearRect(0, 0, W, H);

    // Background glow
    [{ x: cx + Math.cos(t*.15)*cx*.2,   y: cy + Math.sin(t*.11)*cy*.2,  r: W*.38, c:'rgba(248,186,8,' },
     { x: cx + Math.cos(t*.09+2)*cx*.18, y: cy + Math.sin(t*.07+1)*cy*.18, r: W*.28, c:'rgba(0,188,212,' }
    ].forEach(function(b){
      var g = ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r);
      g.addColorStop(0, b.c + '0.04)');
      g.addColorStop(1, b.c + '0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    });

    // Particles
    particles.forEach(function(p){
      p.x += p.vx; p.y += p.vy;
      if(p.x < 0) p.x = W; if(p.x > W) p.x = 0;
      if(p.y < 0) p.y = H; if(p.y > H) p.y = 0;
      ctx.globalAlpha = p.opacity * ease;
      ctx.fillStyle   = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Orbit ring (single, precise radius)
    var orbitR = cards[0].radius;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, orbitR, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(248,186,8,0.18)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([6, 12]);
    ctx.globalAlpha = ease;
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;

    // Advance angle — all cards same delta → uniform spacing preserved forever
    var dAngle = (ORBIT_SPEED * Math.PI / 180) * dt;
    cards.forEach(function(c){ c.angle += dAngle; });

    // Draw each card
    cards.forEach(function(c, i){
      var orbX = cx + Math.cos(c.angle) * c.radius;
      var orbY = cy + Math.sin(c.angle) * c.radius;

      // Trail
      trails[i].push({ x: orbX, y: orbY });
      if(trails[i].length > MAX_TRAIL) trails[i].shift();
      if(!c.dragging && trails[i].length > 2){
        for(var k = 1; k < trails[i].length; k++){
          var prog = k / trails[i].length;
          ctx.globalAlpha  = prog * 0.12 * ease;
          ctx.strokeStyle  = c.color;
          ctx.lineWidth    = 1.2 * prog;
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.moveTo(trails[i][k-1].x, trails[i][k-1].y);
          ctx.lineTo(trails[i][k].x,   trails[i][k].y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // Subtle beam center → card
      if(!c.dragging){
        ctx.globalAlpha = (0.05 + Math.abs(Math.sin(t*.7+i))*.04) * ease;
        ctx.strokeStyle = c.color;
        ctx.lineWidth   = 1;
        ctx.setLineDash([3, 9]);
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(orbX,orbY); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
      }

      // ── Positionnement sans saut ──────────────────────────────────────────
      // Principe : le CENTRE de l'icône est toujours sur l'orbite.
      // Le label est sous l'icône (flex-direction:column dans .md-card).
      // Pour que le label pointe vers l'EXTÉRIEUR du centre en toute position,
      // on décale dispY d'une valeur continue proportionnelle à sin(angle) :
      //   · sin > 0  →  carte en bas  →  label tombe encore plus bas  →  pas de décalage nécessaire
      //   · sin < 0  →  carte en haut →  label remonterait vers le logo →  on recule la carte vers le haut (dispY diminue)
      //   · sin = 0  →  carte sur les côtés →  décalage = 0  →  zéro saut
      //
      // Formule : labelOffset = -sin(angle) × labelH
      //   (négatif car CSS y+ = vers le bas, et on veut repousser vers l'extérieur)
      //
      // Ainsi le décalage est CONTINU → rotation parfaitement fluide.
      var half   = c.cardHalf;
      var sinA   = Math.sin(c.angle);
      // décalage : quand sinA < 0 (haut), on remonte la carte de labelH pour éloigner le label du logo
      var labelOffset = sinA < 0 ? sinA * c.labelH : 0;

      var dispX, dispY;
      if(c.dragging){
        dispX = c.dragX;
        dispY = c.dragY;
      } else if(c.returning){
        c.returnProgress = Math.min(1, c.returnProgress + 0.04);
        var rp = easeInOutCubic(c.returnProgress);
        var targetX = orbX - half;
        var targetY = orbY - half + labelOffset;
        dispX = c._returnFromX + (targetX - c._returnFromX) * rp;
        dispY = c._returnFromY + (targetY - c._returnFromY) * rp;
        if(c.returnProgress >= 1) c.returning = false;
      } else {
        dispX = orbX - half;
        dispY = orbY - half + labelOffset;
      }

      c.opacity = ease; c.scale = ease;
      if(c.el){
        c.el.style.transform = 'translate(' + dispX + 'px,' + dispY + 'px) scale(' + c.scale + ')';
        c.el.style.opacity   = c.opacity;
        if(!c.dragging) c.el.style.zIndex = Math.round(10 + (orbY/H)*20);
      }
    });

    requestAnimationFrame(tick);
  }

  cards.forEach(function(c){
    if(c.el){
      c.el.style.position = 'absolute';
      c.el.style.top      = '0';
      c.el.style.left     = '0';
      c.el.style.opacity  = '0';
    }
  });

  // Petit délai pour laisser le navigateur peindre les éléments
  // avant de mesurer leurs dimensions réelles (offsetWidth, etc.)
  setTimeout(function(){
    resize();
    window.addEventListener('resize', function(){ setTimeout(resize, 50); });
    requestAnimationFrame(tick);
  }, 80);
}();

/* ===== HERO SIDE PANELS ANIMATION ===== */
!function(){
  if(window.innerWidth<1024)return;
  var leftItems=document.querySelectorAll('#hsl .hs-item');
  var rightItems=document.querySelectorAll('#hsr .hs-item');
  var allItems=Array.from(leftItems).concat(Array.from(rightItems));
  setTimeout(function(){allItems.forEach(function(el){el.classList.add('fly')})},600);
  function shootOne(){
    var candidates=allItems.filter(function(el){return el.classList.contains('fly')&&!el.classList.contains('shoot')});
    if(!candidates.length)return;
    var el=candidates[Math.floor(Math.random()*candidates.length)];
    el.classList.remove('fly');el.classList.add('shoot');
    setTimeout(function(){el.classList.remove('shoot');setTimeout(function(){el.classList.add('fly')},300)},900);
  }
  setInterval(shootOne,1800);
}();