// rodrigues.js — Rodrigues' Rotation Formula Calculator
/* global THREE */

// State
let transforms = []; // list of {axis:[x,y,z], angle:number}
let useDegrees = false;
let scene, camera, renderer, controls;
let frameGroups = []; // THREE.Group for each frame

function initViewer() {
  const c = document.getElementById('viewer3d');
  if (!c) return;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, c.clientWidth / c.clientHeight, 0.1, 100);
  camera.up.set(0, 0, 1); // Z-up
  camera.position.set(4, -3, 3);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(c.clientWidth, c.clientHeight);
  c.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.enablePan = false; controls.rotateSpeed = 0.3; controls.zoomSpeed = 0.5;
  controls.minDistance = 1.5; controls.maxDistance = 12;

  // Grid (XY plane)
  const grid = new THREE.GridHelper(6, 30, 0x2a2d45, 0x1e2035);
  grid.rotation.x = Math.PI / 2;
  scene.add(grid);

  // World frame (muted dashed)
  addFrame(scene, 2.0, 1, true, 0x555577, 0x555577, 0x555577, 'X₀','Y₀','Z₀');

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dl = new THREE.DirectionalLight(0xffffff, 0.4);
  dl.position.set(3, 5, 5); scene.add(dl);

  window.addEventListener('resize', () => {
    camera.aspect = c.clientWidth / c.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(c.clientWidth, c.clientHeight);
  });
  animate();
}

function addFrame(parent, len, dashed, cx, cy, cz, lx, ly, lz) {
  const g = new THREE.Group();
  addLine(g, [0,0,0], [len,0,0], cx, dashed);
  addLine(g, [0,0,0], [0,len,0], cy, dashed);
  addLine(g, [0,0,0], [0,0,len], cz, dashed);
  if (!dashed) {
    addCone(g, [len,0,0], [1,0,0], cx);
    addCone(g, [0,len,0], [0,1,0], cy);
    addCone(g, [0,0,len], [0,0,1], cz);
  }
  addLabel(g, lx, [len+0.2,0,0], cx);
  addLabel(g, ly, [0,len+0.2,0], cy);
  addLabel(g, lz, [0,0,len+0.2], cz);
  parent.add(g);
  return g;
}

function addLine(p, f, t, color, dashed) {
  const mat = dashed
    ? new THREE.LineDashedMaterial({ color, linewidth: 1, dashSize: 0.08, gapSize: 0.04, opacity: 0.5, transparent: true })
    : new THREE.LineBasicMaterial({ color, linewidth: 2 });
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...f), new THREE.Vector3(...t)]);
  const l = new THREE.Line(geo, mat);
  if (dashed) l.computeLineDistances();
  p.add(l);
}

function addCone(p, pos, dir, color) {
  const geo = new THREE.ConeGeometry(0.05, 0.15, 12);
  const mat = new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.3 });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), new THREE.Vector3(...dir));
  m.quaternion.copy(q);
  p.add(m);
}

function addLabel(p, text, pos, color) {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.font = 'bold 40px Inter, sans-serif';
  ctx.fillStyle = typeof color === 'number' ? '#' + color.toString(16).padStart(6,'0') : color;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 32);
  const tex = new THREE.CanvasTexture(cv);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sp.position.set(...pos); sp.scale.set(0.35, 0.18, 1);
  p.add(sp);
}

function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }

// ---- Angle helpers ----
function angToRad(v) { return useDegrees ? v * Math.PI / 180 : v; }
function radToDisplay(v) { return useDegrees ? v * 180 / Math.PI : v; }
function fmt(v) { const n = parseFloat(v); return (!isNaN(n) && isFinite(n)) ? parseFloat(n.toFixed(7)) : v; }
function fmtW(v) { const n = parseFloat(v); if (!isNaN(n) && isFinite(n)) { let s = n.toFixed(7); if (n >= 0) s = ' ' + s; return s; } return v; }

// ---- Transform management ----
function addTransform() {
  transforms.push({ axis: [0, 0, 1], angle: 0 });
  rebuildUI();
  recalculate();
}

function removeTransform(i) {
  transforms.splice(i, 1);
  rebuildUI();
  recalculate();
}

function updateTransformValue(i, field, val) {
  const v = parseFloat(val) || 0;
  if (field === 'angle') transforms[i].angle = v;
  else if (field === 'ax') transforms[i].axis[0] = v;
  else if (field === 'ay') transforms[i].axis[1] = v;
  else if (field === 'az') transforms[i].axis[2] = v;
  recalculate();
}

function setPresetAxis(i, preset) {
  if (preset === 'x') transforms[i].axis = [1, 0, 0];
  else if (preset === 'y') transforms[i].axis = [0, 1, 0];
  else if (preset === 'z') transforms[i].axis = [0, 0, 1];
  rebuildUI();
  recalculate();
}

function toggleDegrees(deg) {
  useDegrees = deg;
  document.querySelectorAll('[data-unit]').forEach(el => el.textContent = deg ? 'deg' : 'rad');
  recalculate();
}

function rebuildUI() {
  const container = document.getElementById('transform-list');
  container.innerHTML = '';
  transforms.forEach((t, i) => {
    const idx = i + 1;
    const colors = ['#ff6b6b','#51cf66','#339af0','#fcc419','#cc5de8','#ff922b','#20c997','#f06595'];
    const color = colors[i % colors.length];
    const div = document.createElement('div');
    div.className = 'transform-entry';
    div.style.borderLeftColor = color;
    div.innerHTML = `
      <div class="te-header">
        <span class="te-num" style="color:${color}">R<sub>${idx}</sub></span>
        <div class="te-presets">
          <button class="preset-btn" onclick="setPresetAxis(${i},'x')">X</button>
          <button class="preset-btn" onclick="setPresetAxis(${i},'y')">Y</button>
          <button class="preset-btn" onclick="setPresetAxis(${i},'z')">Z</button>
        </div>
        <button class="remove-btn" onclick="removeTransform(${i})">✕</button>
      </div>
      <div class="te-fields">
        <div class="input-row">
          <span class="input-label">k<sub>x</sub></span><input type="number" value="${t.axis[0]}" oninput="updateTransformValue(${i},'ax',this.value)">
          <span class="input-label">k<sub>y</sub></span><input type="number" value="${t.axis[1]}" oninput="updateTransformValue(${i},'ay',this.value)">
          <span class="input-label">k<sub>z</sub></span><input type="number" value="${t.axis[2]}" oninput="updateTransformValue(${i},'az',this.value)">
        </div>
        <div class="input-row">
          <span class="input-label">θ</span><input type="number" value="${t.angle}" oninput="updateTransformValue(${i},'angle',this.value)" style="width:7rem">
          <span data-unit class="unit-label">${useDegrees?'deg':'rad'}</span>
        </div>
      </div>`;
    container.appendChild(div);
  });
}

// ---- Rodrigues computation ----
function rodrigues(axis, angleRad) {
  // Normalize axis
  const len = Math.sqrt(axis[0]**2 + axis[1]**2 + axis[2]**2);
  const k = len > 1e-10 ? [axis[0]/len, axis[1]/len, axis[2]/len] : [0, 0, 1];
  const c = Math.cos(angleRad), s = Math.sin(angleRad), t = 1 - c;

  // R = I + sin(θ)K + (1-cos(θ))K²
  // Explicit matrix form:
  return [
    [c + k[0]*k[0]*t,         k[0]*k[1]*t - k[2]*s,   k[0]*k[2]*t + k[1]*s],
    [k[1]*k[0]*t + k[2]*s,    c + k[1]*k[1]*t,         k[1]*k[2]*t - k[0]*s],
    [k[2]*k[0]*t - k[1]*s,    k[2]*k[1]*t + k[0]*s,    c + k[2]*k[2]*t      ]
  ];
}

function mat3ToStr(m) {
  return '[ ' + fmtW(m[0][0]) + ', ' + fmtW(m[0][1]) + ', ' + fmtW(m[0][2]) + ' ]\n' +
         '[ ' + fmtW(m[1][0]) + ', ' + fmtW(m[1][1]) + ', ' + fmtW(m[1][2]) + ' ]\n' +
         '[ ' + fmtW(m[2][0]) + ', ' + fmtW(m[2][1]) + ', ' + fmtW(m[2][2]) + ' ]';
}

function mulMat3(A, B) {
  const R = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++)
        R[i][j] += A[i][k] * B[k][j];
  return R;
}

function mat3ToQuat(m) {
  const q = new THREE.Quaternion();
  const te = new THREE.Matrix4();
  te.set(m[0][0],m[0][1],m[0][2],0, m[1][0],m[1][1],m[1][2],0, m[2][0],m[2][1],m[2][2],0, 0,0,0,1);
  q.setFromRotationMatrix(te);
  return q;
}

function identityMat3() { return [[1,0,0],[0,1,0],[0,0,1]]; }

// ---- Main recalculate ----
function recalculate() {
  // Remove old frames
  frameGroups.forEach(g => scene.remove(g));
  frameGroups = [];

  const outputEl = document.getElementById('rodrigues-output');
  const resultEl = document.getElementById('result-matrix');

  if (transforms.length === 0) {
    outputEl.textContent = 'Add rotations above to see Rodrigues\' formula step-by-step.';
    resultEl.textContent = mat3ToStr(identityMat3());
    return;
  }

  let output = '';
  const matrices = [];
  const frameColors = [
    [0xff6b6b, 0xff6b6b, 0xff6b6b],
    [0x51cf66, 0x51cf66, 0x51cf66],
    [0x339af0, 0x339af0, 0x339af0],
    [0xfcc419, 0xfcc419, 0xfcc419],
    [0xcc5de8, 0xcc5de8, 0xcc5de8],
    [0xff922b, 0xff922b, 0xff922b],
  ];

  transforms.forEach((t, i) => {
    const angleRad = angToRad(t.angle);
    const len = Math.sqrt(t.axis[0]**2 + t.axis[1]**2 + t.axis[2]**2);
    const k = len > 1e-10 ? [t.axis[0]/len, t.axis[1]/len, t.axis[2]/len] : [0,0,1];
    const sinA = Math.sin(angleRad), cosA = Math.cos(angleRad);

    output += `━━━ R${i+1}: Rotation about k = [${fmt(k[0])}, ${fmt(k[1])}, ${fmt(k[2])}], θ = ${fmt(radToDisplay(angleRad))} ━━━\n\n`;
    output += `cos(θ) = ${fmt(cosA)},  sin(θ) = ${fmt(sinA)}\n\n`;

    // Skew-symmetric K
    output += `K (skew-symmetric of k):\n`;
    output += `[  ${fmtW(0)}, ${fmtW(-k[2])}, ${fmtW(k[1])} ]\n`;
    output += `[ ${fmtW(k[2])},  ${fmtW(0)}, ${fmtW(-k[0])} ]\n`;
    output += `[ ${fmtW(-k[1])}, ${fmtW(k[0])},  ${fmtW(0)} ]\n\n`;

    const Ri = rodrigues(t.axis, angleRad);
    matrices.push(Ri);

    output += `R${i+1} = I + sin(θ)·K + (1−cos(θ))·K²:\n${mat3ToStr(Ri)}\n\n`;
  });

  // Compute composed: left-to-right R_n * ... * R_2 * R_1 and right-to-left R_1 * R_2 * ... * R_n
  let Rleft = identityMat3();
  let Rright = identityMat3();
  for (let i = 0; i < matrices.length; i++) {
    Rleft = mulMat3(matrices[matrices.length - 1 - i], Rleft); // R_n * ... * R_1
    Rright = mulMat3(Rright, matrices[i]); // R_1 * R_2 * ... * R_n
  }

  output += `━━━ Composed (Pre-multiply): R${transforms.length} · ... · R1 ━━━\n`;
  output += mat3ToStr(Rleft) + '\n\n';
  output += `━━━ Composed (Post-multiply): R1 · R2 · ... · R${transforms.length} ━━━\n`;
  output += mat3ToStr(Rright) + '\n';

  outputEl.textContent = output;

  // Result matrix (pre-multiply convention, standard in robotics)
  resultEl.textContent = mat3ToStr(Rleft);

  // Visualize intermediate frames
  const fc = frameColors;
  // Show each intermediate frame
  let cumLeft = identityMat3();
  for (let i = matrices.length - 1; i >= 0; i--) {
    cumLeft = mulMat3(matrices[i], cumLeft);
    const q = mat3ToQuat(cumLeft);
    const ci = i % fc.length;
    const label = i === 0 ? 'Final' : `R${matrices.length - i}..R1`;
    const g = addFrame(scene, 1.5, false, fc[ci][0], fc[ci][1], fc[ci][2],
      `X'${matrices.length-i}`, `Y'${matrices.length-i}`, `Z'${matrices.length-i}`);
    g.quaternion.copy(q);
    frameGroups.push(g);
  }
}

function copyResult(id) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => {
    const btn = el.parentElement.querySelector('.copy-btn');
    if (btn) {
      btn.classList.add('copied'); btn.textContent = '✓ Copied';
      setTimeout(() => { btn.classList.remove('copied'); btn.textContent = '⧉ Copy'; }, 1500);
    }
  });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  initViewer();
  // Start with two sample rotations
  transforms.push({ axis: [0, 0, 1], angle: useDegrees ? 90 : Math.PI/2 });
  transforms.push({ axis: [1, 0, 0], angle: useDegrees ? 45 : Math.PI/4 });
  rebuildUI();
  recalculate();
});
