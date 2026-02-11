// transforms.js — Homogeneous Transformation Matrix Visualizer
/* global THREE */

// State
let transforms = [];
let useDegrees = false;
let scene, camera, renderer, controls;
let frameObjects = []; // {group, line} for each frame
let chainLine = null;

const ROTATION_MODES = ['rodrigues', 'euler', 'quaternion', 'matrix'];
const EULER_ORDERS = ['XYZ','XZY','YXZ','YZX','ZXY','ZYX'];
const FRAME_COLORS = [
  '#ff6b6b','#51cf66','#339af0','#fcc419','#cc5de8','#ff922b','#20c997','#f06595',
  '#74c0fc','#a9e34b','#ffa94d','#da77f2'
];

// ---- 3D Setup ----
function initViewer() {
  const c = document.getElementById('viewer3d');
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, c.clientWidth / c.clientHeight, 0.1, 200);
  camera.up.set(0, 0, 1); // Z-up
  camera.position.set(5, -4, 4);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(c.clientWidth, c.clientHeight);
  c.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.3; controls.zoomSpeed = 0.5;
  controls.minDistance = 1; controls.maxDistance = 50;

  // Grid (XY plane)
  const grid = new THREE.GridHelper(10, 40, 0x2a2d45, 0x1a1d30);
  grid.rotation.x = Math.PI / 2;
  scene.add(grid);

  // World frame
  buildFrame(scene, 1.8, 0xff4444, 0x44ff44, 0x4488ff, 'X₀', 'Y₀', 'Z₀', false);

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dl = new THREE.DirectionalLight(0xffffff, 0.4);
  dl.position.set(5, 5, 8); scene.add(dl);

  window.addEventListener('resize', () => {
    camera.aspect = c.clientWidth / c.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(c.clientWidth, c.clientHeight);
  });
  animate();
}

function buildFrame(parent, len, cx, cy, cz, lx, ly, lz, addOriginSphere) {
  const g = new THREE.Group();
  mkLine(g, [0,0,0], [len,0,0], cx);
  mkLine(g, [0,0,0], [0,len,0], cy);
  mkLine(g, [0,0,0], [0,0,len], cz);
  mkCone(g, [len,0,0], [1,0,0], cx);
  mkCone(g, [0,len,0], [0,1,0], cy);
  mkCone(g, [0,0,len], [0,0,1], cz);
  mkLabel(g, lx, [len+0.2,0,0], cx);
  mkLabel(g, ly, [0,len+0.2,0], cy);
  mkLabel(g, lz, [0,0,len+0.2], cz);
  if (addOriginSphere) {
    const sg = new THREE.SphereGeometry(0.06, 16, 16);
    const sm = new THREE.MeshPhongMaterial({ color: cx, emissive: cx, emissiveIntensity: 0.4 });
    g.add(new THREE.Mesh(sg, sm));
  }
  parent.add(g);
  return g;
}

function mkLine(p, f, t, color) {
  const mat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...f), new THREE.Vector3(...t)]);
  p.add(new THREE.Line(geo, mat));
}
function mkCone(p, pos, dir, color) {
  const geo = new THREE.ConeGeometry(0.05, 0.15, 12);
  const mat = new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.3 });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  m.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), new THREE.Vector3(...dir)));
  p.add(m);
}
function mkLabel(p, text, pos, color) {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.font = 'bold 40px Inter, sans-serif';
  ctx.fillStyle = typeof color === 'number' ? '#'+color.toString(16).padStart(6,'0') : color;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 32);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true }));
  sp.position.set(...pos); sp.scale.set(0.35, 0.18, 1);
  p.add(sp);
}
function mkDashedLine(scene, points, color) {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineDashedMaterial({ color, dashSize: 0.1, gapSize: 0.06, linewidth: 1, opacity: 0.6, transparent: true });
  const l = new THREE.Line(geo, mat);
  l.computeLineDistances();
  scene.add(l);
  return l;
}
function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }

// ---- Helpers ----
function ang(v) { return useDegrees ? v * Math.PI / 180 : v; }
function dispAng(v) { return useDegrees ? v * 180 / Math.PI : v; }
function fmt(v) { const n = parseFloat(v); return (!isNaN(n) && isFinite(n)) ? parseFloat(n.toFixed(7)) : v; }
function fmtW(v) { const n = parseFloat(v); if (!isNaN(n) && isFinite(n)) { let s = n.toFixed(7); if (n >= 0) s = ' ' + s; return s; } return v; }

// ---- Transform CRUD ----
function addTransform() {
  transforms.push({
    mode: 'rodrigues',
    rod_axis: [0, 0, 1], rod_angle: 0,
    euler_angles: [0, 0, 0], euler_order: 'XYZ',
    quat: [0, 0, 0, 1], // x,y,z,w
    mat: [[1,0,0],[0,1,0],[0,0,1]],
    tx: 0, ty: 0, tz: 0
  });
  rebuildUI();
  recalculate();
}

function removeTransform(i) {
  transforms.splice(i, 1);
  rebuildUI();
  recalculate();
}

function setMode(i, mode) {
  transforms[i].mode = mode;
  rebuildUI();
  recalculate();
}

function setPreset(i, axis) {
  transforms[i].rod_axis = axis === 'x' ? [1,0,0] : axis === 'y' ? [0,1,0] : [0,0,1];
  rebuildUI();
  recalculate();
}

function updateField(i, field, val) {
  const v = parseFloat(val) || 0;
  const t = transforms[i];
  if (field === 'tx') t.tx = v;
  else if (field === 'ty') t.ty = v;
  else if (field === 'tz') t.tz = v;
  else if (field === 'rod_angle') t.rod_angle = v;
  else if (field.startsWith('rod_axis_')) t.rod_axis['xyz'.indexOf(field.slice(-1))] = v;
  else if (field.startsWith('euler_')) { const idx = parseInt(field.slice(-1)); t.euler_angles[idx] = v; }
  else if (field === 'euler_order') t.euler_order = val;
  else if (field.startsWith('quat_')) { const idx = parseInt(field.slice(-1)); t.quat[idx] = v; }
  else if (field.startsWith('mat_')) { const r = parseInt(field[4]); const c = parseInt(field[5]); t.mat[r][c] = v; }
  recalculate();
}

function toggleDeg(deg) {
  useDegrees = deg;
  document.querySelectorAll('[data-unit]').forEach(el => el.textContent = deg ? 'deg' : 'rad');
  recalculate();
}

// ---- Build rotation matrix from each mode ----
function getRotMat(t) {
  if (t.mode === 'rodrigues') return rodrigues(t.rod_axis, ang(t.rod_angle));
  if (t.mode === 'euler') return eulerToMat(t.euler_angles.map(a => ang(a)), t.euler_order);
  if (t.mode === 'quaternion') return quatToMat(t.quat);
  if (t.mode === 'matrix') return t.mat.map(r => [...r]);
  return eye3();
}

function rodrigues(axis, a) {
  const len = Math.sqrt(axis[0]**2 + axis[1]**2 + axis[2]**2);
  const k = len > 1e-10 ? axis.map(v => v/len) : [0,0,1];
  const c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  return [
    [c+k[0]*k[0]*t,       k[0]*k[1]*t-k[2]*s,  k[0]*k[2]*t+k[1]*s],
    [k[1]*k[0]*t+k[2]*s,  c+k[1]*k[1]*t,        k[1]*k[2]*t-k[0]*s],
    [k[2]*k[0]*t-k[1]*s,  k[2]*k[1]*t+k[0]*s,   c+k[2]*k[2]*t]
  ];
}

function eulerToMat(angles, order) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(angles[0], angles[1], angles[2], order));
  return quatObjToMat(q);
}

function quatToMat(qArr) {
  const q = new THREE.Quaternion(qArr[0], qArr[1], qArr[2], qArr[3]).normalize();
  return quatObjToMat(q);
}

function quatObjToMat(q) {
  const m = new THREE.Matrix4().makeRotationFromQuaternion(q);
  const e = m.elements;
  return [[e[0],e[4],e[8]], [e[1],e[5],e[9]], [e[2],e[6],e[10]]];
}

function eye3() { return [[1,0,0],[0,1,0],[0,0,1]]; }

function mat3to4x4(R, tx, ty, tz) {
  return [
    [R[0][0], R[0][1], R[0][2], tx],
    [R[1][0], R[1][1], R[1][2], ty],
    [R[2][0], R[2][1], R[2][2], tz],
    [0, 0, 0, 1]
  ];
}

function mul4x4(A, B) {
  const R = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++)
      for (let k = 0; k < 4; k++)
        R[i][j] += A[i][k] * B[k][j];
  return R;
}

function mat4ToThree(m) {
  const t = new THREE.Matrix4();
  t.set(m[0][0],m[0][1],m[0][2],m[0][3],
        m[1][0],m[1][1],m[1][2],m[1][3],
        m[2][0],m[2][1],m[2][2],m[2][3],
        m[3][0],m[3][1],m[3][2],m[3][3]);
  return t;
}

function mat4ToStr(m) {
  return m.map(r => '[ ' + r.map(v => fmtW(v)).join(', ') + ' ]').join('\n');
}

// ---- UI Rebuild ----
function rebuildUI() {
  const el = document.getElementById('transform-list');
  el.innerHTML = '';
  transforms.forEach((t, i) => {
    const color = FRAME_COLORS[i % FRAME_COLORS.length];
    const idx = i + 1;
    const div = document.createElement('div');
    div.className = 'transform-entry';
    div.style.borderLeftColor = color;

    let rotHTML = '';
    if (t.mode === 'rodrigues') {
      rotHTML = `
        <div class="te-presets"><button class="preset-btn" onclick="setPreset(${i},'x')">X</button><button class="preset-btn" onclick="setPreset(${i},'y')">Y</button><button class="preset-btn" onclick="setPreset(${i},'z')">Z</button></div>
        <div class="input-row"><span class="input-label">k<sub>x</sub></span><input type="number" value="${t.rod_axis[0]}" oninput="updateField(${i},'rod_axis_x',this.value)">
        <span class="input-label">k<sub>y</sub></span><input type="number" value="${t.rod_axis[1]}" oninput="updateField(${i},'rod_axis_y',this.value)">
        <span class="input-label">k<sub>z</sub></span><input type="number" value="${t.rod_axis[2]}" oninput="updateField(${i},'rod_axis_z',this.value)"></div>
        <div class="input-row"><span class="input-label">θ</span><input type="number" value="${t.rod_angle}" oninput="updateField(${i},'rod_angle',this.value)" style="width:7rem"><span class="unit-label" data-unit>${useDegrees?'deg':'rad'}</span></div>`;
    } else if (t.mode === 'euler') {
      const opts = EULER_ORDERS.map(o => `<option value="${o}" ${o===t.euler_order?'selected':''}>${o}</option>`).join('');
      rotHTML = `
        <div class="input-row"><span class="input-label">Order</span><select onchange="updateField(${i},'euler_order',this.value)" style="width:5rem">${opts}</select></div>
        <div class="input-row"><span class="input-label">x</span><input type="number" value="${t.euler_angles[0]}" oninput="updateField(${i},'euler_0',this.value)">
        <span class="input-label">y</span><input type="number" value="${t.euler_angles[1]}" oninput="updateField(${i},'euler_1',this.value)">
        <span class="input-label">z</span><input type="number" value="${t.euler_angles[2]}" oninput="updateField(${i},'euler_2',this.value)"><span class="unit-label" data-unit>${useDegrees?'deg':'rad'}</span></div>`;
    } else if (t.mode === 'quaternion') {
      rotHTML = `
        <div class="input-row"><span class="input-label">x</span><input type="number" value="${t.quat[0]}" oninput="updateField(${i},'quat_0',this.value)">
        <span class="input-label">y</span><input type="number" value="${t.quat[1]}" oninput="updateField(${i},'quat_1',this.value)">
        <span class="input-label">z</span><input type="number" value="${t.quat[2]}" oninput="updateField(${i},'quat_2',this.value)">
        <span class="input-label">w</span><input type="number" value="${t.quat[3]}" oninput="updateField(${i},'quat_3',this.value)"></div>`;
    } else if (t.mode === 'matrix') {
      let rows = '';
      for (let r = 0; r < 3; r++) {
        rows += '<div class="input-row">';
        for (let c = 0; c < 3; c++) {
          rows += `<input type="number" value="${t.mat[r][c]}" oninput="updateField(${i},'mat_${r}${c}',this.value)" style="width:5.5rem">`;
        }
        rows += '</div>';
      }
      rotHTML = rows;
    }

    const modeButtons = ROTATION_MODES.map(m =>
      `<button class="mode-btn ${t.mode===m?'active':''}" onclick="setMode(${i},'${m}')">${m==='rodrigues'?'Rodrigues':m==='euler'?'Euler':m==='quaternion'?'Quaternion':'Matrix'}</button>`
    ).join('');

    div.innerHTML = `
      <div class="te-header">
        <span class="te-num" style="color:${color}">T<sub>${idx}</sub></span>
        <div class="mode-tabs">${modeButtons}</div>
        <button class="remove-btn" onclick="removeTransform(${i})">✕</button>
      </div>
      <div class="te-rot">${rotHTML}</div>
      <div class="te-trans">
        <span style="font-size:.72rem;color:var(--text3)">Translation:</span>
        <div class="input-row">
          <span class="input-label">t<sub>x</sub></span><input type="number" value="${t.tx}" oninput="updateField(${i},'tx',this.value)">
          <span class="input-label">t<sub>y</sub></span><input type="number" value="${t.ty}" oninput="updateField(${i},'ty',this.value)">
          <span class="input-label">t<sub>z</sub></span><input type="number" value="${t.tz}" oninput="updateField(${i},'tz',this.value)">
        </div>
      </div>`;
    el.appendChild(div);
  });
}

// ---- Recalculate ----
function recalculate() {
  // Clear old
  frameObjects.forEach(o => scene.remove(o));
  frameObjects = [];
  if (chainLine) { scene.remove(chainLine); chainLine = null; }

  const outputEl = document.getElementById('step-output');
  const resultEl = document.getElementById('result-matrix');
  if (transforms.length === 0) {
    outputEl.textContent = 'Add transforms above to see step-by-step computation.';
    resultEl.textContent = mat4ToStr([[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]);
    return;
  }

  let output = '';
  const matrices4 = [];
  const origins = [new THREE.Vector3(0, 0, 0)]; // chain of origins for visualization

  transforms.forEach((t, i) => {
    const R = getRotMat(t);
    const T = mat3to4x4(R, t.tx, t.ty, t.tz);
    matrices4.push(T);

    output += `━━━ T${i+1} [${t.mode}] ━━━\n`;
    if (t.mode === 'rodrigues') {
      const len = Math.sqrt(t.rod_axis[0]**2+t.rod_axis[1]**2+t.rod_axis[2]**2);
      const k = len>1e-10 ? t.rod_axis.map(v=>v/len) : [0,0,1];
      const a = ang(t.rod_angle);
      output += `k = [${fmt(k[0])}, ${fmt(k[1])}, ${fmt(k[2])}], θ = ${fmt(t.rod_angle)} ${useDegrees?'deg':'rad'}\n`;
      output += `R = I + sin(θ)·K + (1−cos(θ))·K²\n`;
    } else if (t.mode === 'euler') {
      output += `Euler ${t.euler_order}: [${t.euler_angles.map(a=>fmt(a)).join(', ')}] ${useDegrees?'deg':'rad'}\n`;
    } else if (t.mode === 'quaternion') {
      output += `q = [x:${fmt(t.quat[0])}, y:${fmt(t.quat[1])}, z:${fmt(t.quat[2])}, w:${fmt(t.quat[3])}]\n`;
    } else {
      output += `Direct rotation matrix input\n`;
    }
    output += `t = [${fmt(t.tx)}, ${fmt(t.ty)}, ${fmt(t.tz)}]\n\n`;
    output += `T${i+1} =\n${mat4ToStr(T)}\n\n`;
  });

  // Compose: T_total = T_1 * T_2 * ... * T_n (each frame relative to previous)
  let Tcum = [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]];
  for (let i = 0; i < matrices4.length; i++) {
    Tcum = mul4x4(Tcum, matrices4[i]);

    // Visualize this frame
    const color = parseInt(FRAME_COLORS[i % FRAME_COLORS.length].slice(1), 16);
    const threeM = mat4ToThree(Tcum);
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    threeM.decompose(pos, quat, scale);

    const idx = i + 1;
    const g = buildFrame(scene, 1.2, color, color, color,
      `X'${idx}`, `Y'${idx}`, `Z'${idx}`, true);
    g.position.copy(pos);
    g.quaternion.copy(quat);
    frameObjects.push(g);
    origins.push(pos.clone());
  }

  // Draw chain line connecting origins
  if (origins.length > 1) {
    chainLine = mkDashedLine(scene, origins, 0x6373ff);
    frameObjects.push(chainLine);
  }

  output += `━━━ Composed: T = T₁ · T₂ · ... · T${transforms.length} ━━━\n`;
  output += mat4ToStr(Tcum) + '\n';

  outputEl.textContent = output;
  resultEl.textContent = mat4ToStr(Tcum);
}

function copyResult(id) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => {
    const btn = el.parentElement.querySelector('.copy-btn');
    if (btn) { btn.classList.add('copied'); btn.textContent = '✓ Copied'; setTimeout(()=>{btn.classList.remove('copied');btn.textContent='⧉ Copy';},1500); }
  });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  initViewer();
  // Default: two transforms showing offset frames
  transforms.push({ mode:'rodrigues', rod_axis:[0,0,1], rod_angle: useDegrees?90:Math.PI/2, euler_angles:[0,0,0], euler_order:'XYZ', quat:[0,0,0,1], mat:eye3(), tx:2, ty:0, tz:0 });
  transforms.push({ mode:'rodrigues', rod_axis:[0,1,0], rod_angle: useDegrees?45:Math.PI/4, euler_angles:[0,0,0], euler_order:'XYZ', quat:[0,0,0,1], mat:eye3(), tx:0, ty:1.5, tz:0 });
  rebuildUI();
  recalculate();
});
