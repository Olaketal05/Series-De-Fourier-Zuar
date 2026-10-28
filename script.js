/* =========================================================
   Series de Fourier · IPN / ESIME
   Ondas: senoidal, cuadrada, triangular y diente de sierra
   - Gráfica en <canvas> con 2 periodos de la onda
   - Serie de Fourier truncada a n términos (1 a 30)
   - Audio con Web Audio API (PeriodicWave con los coeficientes)
   ========================================================= */
'use strict';

/* ---------- Configuración ---------- */
const LIMITES = {
  f: { min: 20,  max: 5000, def: 440 },   // Hz
  A: { min: 0.1, max: 10,   def: 5 }      // amplitud
};
const MAX_TERMINOS = 30;
const DURACION_AUDIO = 2;                 // segundos
const COLOR = {
  guinda: '#6b1c34',
  gris: '#5f6368',
  grisMedio: '#8d9298',
  rejilla: '#e3e6e9',
  eje: '#9aa0a6'
};

/* ---------- Definición de las ondas (en el orden pedido) ----------
   coef(n) devuelve los coeficientes b_k de la serie  f(t)=A·Σ b_k·sen(k·ω·t)
   para amplitud unitaria.
   ideal: vértices [θ/π, valor] de la onda ideal para 2 periodos (θ = 0 … 4π). */
const ONDAS = [
  {
    id: 'senoidal',
    nombre: 'Onda senoidal',
    formula: 'f(t) = A · sen(2π f t)',
    nota: 'Armónico único: 1 (la senoidal es su propia serie, por eso n no cambia la forma).',
    terminosIniciales: 1,
    coef: () => [{ k: 1, b: 1 }],
    ideal: null
  },
  {
    id: 'cuadrada',
    nombre: 'Onda cuadrada',
    formula: 'f(t) = (4A/π) · Σ sen((2k−1)·2π f t) / (2k−1),  k = 1 … n',
    terminosIniciales: 10,
    coef: (n) => Array.from({ length: n }, (_, i) => {
      const k = 2 * (i + 1) - 1;
      return { k, b: 4 / (Math.PI * k) };
    }),
    ideal: [[0, -1], [0, 1], [1, 1], [1, -1], [2, -1], [2, 1], [3, 1], [3, -1], [4, -1]]
  },
  {
    id: 'triangular',
    nombre: 'Onda triangular',
    formula: 'f(t) = (8A/π²) · Σ (−1)^(k+1) · sen((2k−1)·2π f t) / (2k−1)²,  k = 1 … n',
    terminosIniciales: 10,
    coef: (n) => Array.from({ length: n }, (_, i) => {
      const k = 2 * (i + 1) - 1;
      const signo = i % 2 === 0 ? 1 : -1;
      return { k, b: (8 / (Math.PI * Math.PI)) * signo / (k * k) };
    }),
    ideal: [[0, 0], [0.5, 1], [1.5, -1], [2.5, 1], [3.5, -1], [4, 0]]
  },
  {
    id: 'sierra',
    nombre: 'Onda diente de sierra',
    formula: 'f(t) = (2A/π) · Σ (−1)^(k+1) · sen(k·2π f t) / k,  k = 1 … n',
    terminosIniciales: 10,
    coef: (n) => Array.from({ length: n }, (_, i) => {
      const k = i + 1;
      const signo = i % 2 === 0 ? 1 : -1;
      return { k, b: (2 / Math.PI) * signo / k };
    }),
    ideal: [[0, 0], [1, 1], [1, -1], [3, 1], [3, -1], [4, 0]]
  }
];

/* ---------- Utilidades ---------- */
const limitar = (v, min, max) => Math.min(max, Math.max(min, v));

function numCorto(v, cifras) {
  return String(parseFloat(v.toPrecision(cifras)));
}

function fmtTiempo(t) {
  if (t === 0) return '0';
  const a = Math.abs(t);
  if (a >= 1) return numCorto(t, 3) + ' s';
  if (a >= 1e-3) return numCorto(t * 1e3, 3) + ' ms';
  return numCorto(t * 1e6, 3) + ' µs';
}

function fmtValor(v) {
  return String(parseFloat(v.toFixed(2)));
}

function listaArmonicos(coefs) {
  const ks = coefs.map(c => c.k);
  if (ks.length <= 5) return ks.join(', ');
  return ks.slice(0, 3).join(', ') + ', …, ' + ks[ks.length - 1];
}

/* ---------- Construcción de la interfaz ---------- */
const filas = [];

function crearFila(onda) {
  const id = onda.id;
  const tarjeta = document.createElement('article');
  tarjeta.className = 'onda-card';

  let opciones = '';
  for (let i = 1; i <= MAX_TERMINOS; i++) {
    opciones += `<option value="${i}"${i === onda.terminosIniciales ? ' selected' : ''}>${i}</option>`;
  }

  tarjeta.innerHTML = `
    <div class="panel-grafica">
      <div class="grafica-cabecera">
        <h3>${onda.nombre}</h3>
        <span class="leyenda">
          <span><i></i>Serie de Fourier</span>
          <span><i class="ideal"></i>Onda ideal</span>
        </span>
      </div>
      <div class="lienzo">
        <canvas id="cv-${id}" role="img" aria-label="Gráfica de la ${onda.nombre.toLowerCase()} con dos periodos"></canvas>
      </div>
      <p class="formula">${onda.formula}</p>
      <p class="meta" id="meta-${id}"></p>
    </div>

    <div class="controles">
      <div class="campo">
        <label for="f-${id}"><span class="lbl-largo">Frecuencia </span><b>f</b> <small>(Hz)</small></label>
        <input id="f-${id}" type="number" inputmode="decimal"
               min="${LIMITES.f.min}" max="${LIMITES.f.max}" step="1" value="${LIMITES.f.def}"
               aria-label="Frecuencia en hertz">
      </div>
      <div class="campo">
        <label for="a-${id}"><span class="lbl-largo">Amplitud </span><b>A</b></label>
        <input id="a-${id}" type="number" inputmode="decimal"
               min="${LIMITES.A.min}" max="${LIMITES.A.max}" step="0.1" value="${LIMITES.A.def}"
               aria-label="Amplitud">
      </div>
      <div class="campo">
        <label for="n-${id}"><span class="lbl-largo">Términos </span><b>n</b></label>
        <select id="n-${id}" aria-label="Número de términos de la serie">${opciones}</select>
      </div>
      <div class="campo">
        <label>Audio</label>
        <button type="button" class="btn-audio" id="b-${id}" aria-pressed="false"
                aria-label="Reproducir la ${onda.nombre.toLowerCase()}">
          <span class="btn-icono">▶</span><span class="btn-texto">Reproducir</span>
        </button>
      </div>
    </div>
  `;

  const fila = {
    onda,
    tarjeta,
    lienzo: tarjeta.querySelector('.lienzo'),
    canvas: tarjeta.querySelector('canvas'),
    meta: tarjeta.querySelector('.meta'),
    inF: tarjeta.querySelector(`#f-${id}`),
    inA: tarjeta.querySelector(`#a-${id}`),
    selN: tarjeta.querySelector(`#n-${id}`),
    btn: tarjeta.querySelector(`#b-${id}`)
  };

  // Redibujar al cambiar cualquier valor
  const alCambiar = () => {
    if (reproduciendo && reproduciendo.fila === fila) detener();
    dibujar(fila);
  };
  fila.inF.addEventListener('input', alCambiar);
  fila.inA.addEventListener('input', alCambiar);
  fila.selN.addEventListener('change', alCambiar);

  // Al terminar de editar, se corrigen valores fuera de rango o vacíos
  fila.inF.addEventListener('change', () => {
    const v = parseFloat(fila.inF.value);
    fila.inF.value = limitar(isFinite(v) ? Math.round(v) : LIMITES.f.def, LIMITES.f.min, LIMITES.f.max);
    dibujar(fila);
  });
  fila.inA.addEventListener('change', () => {
    const v = parseFloat(fila.inA.value);
    fila.inA.value = parseFloat(limitar(isFinite(v) ? v : LIMITES.A.def, LIMITES.A.min, LIMITES.A.max).toFixed(2));
    dibujar(fila);
  });

  fila.btn.addEventListener('click', () => alternarAudio(fila));

  // Redibujar cuando cambie el tamaño del contenedor
  if ('ResizeObserver' in window) {
    new ResizeObserver(() => dibujar(fila)).observe(fila.lienzo);
  }

  filas.push(fila);
  return tarjeta;
}

/* ---------- Lectura de valores ---------- */
function leerEstado(fila) {
  const f = parseFloat(fila.inF.value);
  const A = parseFloat(fila.inA.value);
  if (!isFinite(f) || !isFinite(A) || f <= 0) return null;   // campo vacío: se conserva la gráfica anterior
  return {
    f: limitar(f, LIMITES.f.min, LIMITES.f.max),
    A: limitar(A, LIMITES.A.min, LIMITES.A.max),
    n: limitar(parseInt(fila.selN.value, 10) || 1, 1, MAX_TERMINOS)
  };
}

/* ---------- Gráfica ---------- */
function dibujar(fila) {
  const est = leerEstado(fila);
  if (!est) return;
  const { f, A, n } = est;
  const onda = fila.onda;

  const cv = fila.canvas;
  const w = cv.clientWidth;
  const h = cv.clientHeight;
  if (!w || !h) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // Márgenes y escalas (se ajustan solas a f y A)
  const compacto = w < 460;
  const m = { l: compacto ? 40 : 50, r: 14, t: 14, b: 28 };
  const pw = w - m.l - m.r;
  const ph = h - m.t - m.b;
  const T = 1 / f;
  const tMax = 2 * T;                 // dos periodos
  const yMax = 1.35 * A;              // deja espacio al sobreimpulso de Gibbs
  const X = t => m.l + (t / tMax) * pw;
  const Y = y => m.t + ph / 2 - (y / yMax) * (ph / 2);

  // Rejilla horizontal (amplitud)
  ctx.font = (compacto ? '10px' : '11px') + ' "Segoe UI", system-ui, sans-serif';
  ctx.lineWidth = 1;
  ctx.fillStyle = COLOR.gris;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  [-A, -A / 2, 0, A / 2, A].forEach(v => {
    const y = Y(v);
    ctx.strokeStyle = v === 0 ? COLOR.eje : COLOR.rejilla;
    ctx.lineWidth = v === 0 ? 1.3 : 1;
    ctx.beginPath();
    ctx.moveTo(m.l, y);
    ctx.lineTo(m.l + pw, y);
    ctx.stroke();
    ctx.fillText(fmtValor(v), m.l - 6, y);
  });

  // Rejilla vertical (tiempo: 0, T/2, T, 3T/2, 2T)
  ctx.textBaseline = 'top';
  for (let i = 0; i <= 4; i++) {
    const t = i * T / 2;
    const x = X(t);
    const esPeriodo = i % 2 === 0;
    ctx.strokeStyle = esPeriodo ? '#cfd3d7' : COLOR.rejilla;
    ctx.lineWidth = 1;
    ctx.setLineDash(esPeriodo ? [] : [3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, m.t);
    ctx.lineTo(x, m.t + ph);
    ctx.stroke();
    ctx.setLineDash([]);
    if (compacto && !esPeriodo) continue;
    ctx.textAlign = i === 0 ? 'left' : (i === 4 ? 'right' : 'center');
    ctx.fillText(fmtTiempo(t), i === 0 ? x - 4 : (i === 4 ? x + 2 : x), m.t + ph + 7);
  }

  // Marco de la zona de trazado
  ctx.strokeStyle = COLOR.eje;
  ctx.lineWidth = 1;
  ctx.strokeRect(m.l, m.t, pw, ph);

  // Curvas (recortadas a la zona de trazado)
  ctx.save();
  ctx.beginPath();
  ctx.rect(m.l, m.t, pw, ph);
  ctx.clip();

  const coefs = onda.coef(n);
  const puntos = Math.max(900, Math.round(pw * 2));

  // Onda ideal (gris, discontinua)
  ctx.strokeStyle = COLOR.grisMedio;
  ctx.lineWidth = 1.6;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  if (onda.ideal) {
    onda.ideal.forEach(([u, y], i) => {
      const x = X(u * T / 2);
      if (i === 0) ctx.moveTo(x, Y(y * A)); else ctx.lineTo(x, Y(y * A));
    });
  } else {
    for (let i = 0; i <= puntos; i++) {
      const th = 4 * Math.PI * i / puntos;
      const x = X(tMax * i / puntos);
      const y = Y(A * Math.sin(th));
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Serie de Fourier truncada (guinda, continua)
  ctx.strokeStyle = COLOR.guinda;
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i <= puntos; i++) {
    const th = 4 * Math.PI * i / puntos;
    let s = 0;
    for (let j = 0; j < coefs.length; j++) s += coefs[j].b * Math.sin(coefs[j].k * th);
    const x = X(tMax * i / puntos);
    const y = Y(A * s);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();

  // Texto informativo
  const arm = onda.id === 'senoidal'
    ? onda.nota
    : `Armónicos usados: ${listaArmonicos(coefs)}  (n = ${n})`;
  fila.meta.textContent = `T = ${fmtTiempo(T)} · Gráfica: 2 periodos · ${arm}`;
}

/* ---------- Audio ---------- */
let audioCtx = null;
let reproduciendo = null;   // { fila, osc, gain }

function obtenerAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  return audioCtx;
}

function marcarReproduccion(fila, activo) {
  fila.btn.classList.toggle('activo', activo);
  fila.btn.setAttribute('aria-pressed', String(activo));
  fila.tarjeta.classList.toggle('sonando', activo);
  fila.btn.querySelector('.btn-icono').textContent = activo ? '■' : '▶';
  fila.btn.querySelector('.btn-texto').textContent = activo ? 'Detener' : 'Reproducir';
}

function detener() {
  if (!reproduciendo || !audioCtx) return;
  const { fila, osc, gain } = reproduciendo;
  reproduciendo = null;
  try {
    const ahora = audioCtx.currentTime;
    gain.gain.cancelScheduledValues(ahora);
    gain.gain.setValueAtTime(gain.gain.value, ahora);
    gain.gain.linearRampToValueAtTime(0, ahora + 0.03);   // evita el "clic" al cortar
    osc.stop(ahora + 0.05);
  } catch (e) { /* el oscilador ya había terminado */ }
  marcarReproduccion(fila, false);
}

async function alternarAudio(fila) {
  if (reproduciendo && reproduciendo.fila === fila) { detener(); return; }
  detener();

  const ctx = obtenerAudio();
  if (!ctx) { alert('Tu navegador no admite Web Audio API.'); return; }
  if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (e) { /* ignorar */ } }

  const est = leerEstado(fila);
  if (!est) return;

  // Los coeficientes de la serie se pasan tal cual a una PeriodicWave
  const coefs = fila.onda.coef(est.n);
  const kMax = Math.max(...coefs.map(c => c.k));
  const real = new Float32Array(kMax + 1);
  const imag = new Float32Array(kMax + 1);
  coefs.forEach(c => { imag[c.k] = c.b; });          // términos en seno
  const onda = ctx.createPeriodicWave(real, imag, { disableNormalization: true });

  const osc = ctx.createOscillator();
  osc.setPeriodicWave(onda);
  osc.frequency.value = est.f;

  const gain = ctx.createGain();
  const nivel = Math.min(est.A / LIMITES.A.max, 1) * 0.5;   // la amplitud A fija el volumen
  const t0 = ctx.currentTime + 0.02;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(nivel, t0 + 0.03);
  gain.gain.setValueAtTime(nivel, t0 + DURACION_AUDIO - 0.05);
  gain.gain.linearRampToValueAtTime(0, t0 + DURACION_AUDIO);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + DURACION_AUDIO + 0.02);

  reproduciendo = { fila, osc, gain };
  marcarReproduccion(fila, true);

  osc.onended = () => {
    if (reproduciendo && reproduciendo.osc === osc) {
      reproduciendo = null;
      marcarReproduccion(fila, false);
    }
  };
}

/* ---------- Logos: si no existe la imagen se muestra un recuadro con siglas ---------- */
function prepararLogos() {
  document.querySelectorAll('img[data-fallback]').forEach(img => {
    const reemplazar = () => {
      const s = document.createElement('span');
      s.className = 'logo-fallback';
      s.textContent = img.dataset.fallback;
      img.replaceWith(s);
    };
    img.addEventListener('error', reemplazar, { once: true });
    if (img.complete && img.naturalWidth === 0) reemplazar();
  });
}

/* ---------- Inicio ---------- */
function iniciar() {
  prepararLogos();
  const contenedor = document.getElementById('ondas');
  ONDAS.forEach(o => contenedor.appendChild(crearFila(o)));
  filas.forEach(dibujar);
  window.addEventListener('resize', () => filas.forEach(dibujar));
}

iniciar();
