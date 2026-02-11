// ============================================================
// rotation-converter.js — Core logic for 3D Rotation Converter
// Uses THREE.js for quaternion / matrix / euler math
// ============================================================

/* global THREE */

// ---- State ----
let quat = new THREE.Quaternion();
let inputMode = 0;
let activeSnippetTab = 'python';

// ---- 3D Viewer ----
let scene, camera, renderer, controls, axesGroup;

function initViewer() {
  const container = document.getElementById('viewer-container');
  if (!container) return;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.up.set(0, 0, 1); // Z-up
  camera.position.set(3, -2.5, 2); // Looking from corner
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  // Orbit controls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 1.5;
  controls.maxDistance = 8;
  controls.rotateSpeed = 0.3;
  controls.zoomSpeed = 0.5;

  // Grid (on XY plane)
  const grid = new THREE.GridHelper(4, 20, 0x2a2d45, 0x1e2035);
  grid.rotation.x = Math.PI / 2;
  scene.add(grid);

  // Reference axes (thin, muted)
  const refLen = 2;
  addLine(scene, [0,0,0], [refLen,0,0], 0x333355, 1, true);
  addLine(scene, [0,0,0], [0,refLen,0], 0x333355, 1, true);
  addLine(scene, [0,0,0], [0,0,refLen], 0x333355, 1, true);

  // Rotating axes group
  axesGroup = new THREE.Group();
  const axLen = 1.8;
  addLine(axesGroup, [0,0,0], [axLen,0,0], 0xff4444, 3, false); // X red
  addLine(axesGroup, [0,0,0], [0,axLen,0], 0x44ff44, 3, false); // Y green
  addLine(axesGroup, [0,0,0], [0,0,axLen], 0x4488ff, 3, false); // Z blue
  // Axis cones
  addCone(axesGroup, [axLen,0,0], [1,0,0], 0xff4444);
  addCone(axesGroup, [0,axLen,0], [0,1,0], 0x44ff44);
  addCone(axesGroup, [0,0,axLen], [0,0,1], 0x4488ff);
  // Labels
  addAxisLabel(axesGroup, 'X', [axLen+0.25,0,0], 0xff4444);
  addAxisLabel(axesGroup, 'Y', [0,axLen+0.25,0], 0x44ff44);
  addAxisLabel(axesGroup, 'Z', [0,0,axLen+0.25], 0x4488ff);
  scene.add(axesGroup);

  // Ambient + directional light
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dl = new THREE.DirectionalLight(0xffffff, 0.4);
  dl.position.set(3, 5, 3);
  scene.add(dl);

  // Resize
  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
  animate();
}

function addLine(parent, from, to, color, width, dashed) {
  const mat = dashed
    ? new THREE.LineDashedMaterial({ color, linewidth: width, dashSize: 0.1, gapSize: 0.05 })
    : new THREE.LineBasicMaterial({ color, linewidth: width });
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(...from), new THREE.Vector3(...to)
  ]);
  const line = new THREE.Line(geo, mat);
  if (dashed) line.computeLineDistances();
  parent.add(line);
}

function addCone(parent, pos, dir, color) {
  const geo = new THREE.ConeGeometry(0.06, 0.18, 12);
  const mat = new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.3 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(...pos);
  // Orient cone along dir
  const up = new THREE.Vector3(0, 1, 0);
  const d = new THREE.Vector3(...dir);
  const q = new THREE.Quaternion().setFromUnitVectors(up, d);
  mesh.quaternion.copy(q);
  parent.add(mesh);
}

function addAxisLabel(parent, text, pos, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 48px Inter, sans-serif';
  ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 32, 32);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(...pos);
  sprite.scale.set(0.3, 0.3, 0.3);
  parent.add(sprite);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function updateViewer() {
  if (axesGroup) {
    axesGroup.quaternion.copy(quat);
  }
}

// ---- Math helpers ----
function toDeg(x) { return x * 180 / Math.PI; }
function toRadHelper(x) { return x / 180 * Math.PI; }

function toRad(x) {
  return document.getElementById('iformatdeg').checked ? toRadHelper(parseFloat(x)) : parseFloat(x);
}

function toAngle(x) {
  return document.getElementById('resformatdeg').checked ? toDeg(x) : x;
}

function toReal(x) {
  const v = parseFloat(x);
  return (!isNaN(v) && isFinite(v)) ? parseFloat(v.toFixed(7)) : x;
}

function toFixedWidth(x) {
  const v = parseFloat(x);
  if (!isNaN(v) && isFinite(v)) {
    let s = v.toFixed(7);
    if (v >= 0) s = ' ' + s;
    return s;
  }
  return x;
}

// ---- Get vector from input ids ----
function getVector(root) {
  return new THREE.Vector3(
    parseFloat(document.getElementById(root + 'x').value) || 0,
    parseFloat(document.getElementById(root + 'y').value) || 0,
    parseFloat(document.getElementById(root + 'z').value) || 0
  );
}

// ---- Core update ----
function update(mode) {
  inputMode = mode;
  let q = new THREE.Quaternion();

  if (mode === 0) { // Rotation matrix
    const m = new THREE.Matrix4();
    const g = id => parseFloat(document.getElementById(id).value) || 0;
    m.set(g('m00'),g('m01'),g('m02'),0, g('m10'),g('m11'),g('m12'),0, g('m20'),g('m21'),g('m22'),0, 0,0,0,1);
    q.setFromRotationMatrix(m);
  } else if (mode === 1) { // Quaternion
    q = new THREE.Quaternion(
      parseFloat(document.getElementById('q0').value) || 0,
      parseFloat(document.getElementById('q1').value) || 0,
      parseFloat(document.getElementById('q2').value) || 0,
      parseFloat(document.getElementById('q3').value) || 1
    );
  } else if (mode === 2) { // Axis-angle
    const axis = new THREE.Vector3(
      parseFloat(document.getElementById('a0').value) || 0,
      parseFloat(document.getElementById('a1').value) || 0,
      parseFloat(document.getElementById('a2').value) || 0
    );
    axis.normalize();
    q.setFromAxisAngle(axis, toRad(document.getElementById('a3').value));
  } else if (mode === 3) { // Axis with angle magnitude
    const axis = new THREE.Vector3(
      parseFloat(document.getElementById('r0').value) || 0,
      parseFloat(document.getElementById('r1').value) || 0,
      parseFloat(document.getElementById('r2').value) || 0
    );
    const angle = toRad(axis.length());
    axis.normalize();
    q.setFromAxisAngle(axis, angle);
  } else if (mode === 4) { // Euler
    const e = new THREE.Euler(
      toRad(document.getElementById('e0').value),
      toRad(document.getElementById('e1').value),
      toRad(document.getElementById('e2').value),
      document.getElementById('euler').value
    );
    q.setFromEuler(e);
  } else if (mode === 5) { // Triple of points
    const P = getVector('P'); const Q = getVector('Q'); const R = getVector('R');
    const x = new THREE.Vector3().subVectors(Q, P).normalize();
    const y = new THREE.Vector3().subVectors(R, P);
    const z = new THREE.Vector3().crossVectors(x, y).normalize();
    y.crossVectors(z, x).normalize();
    const m = new THREE.Matrix4();
    m.set(x.x,y.x,z.x,0, x.y,y.y,z.y,0, x.z,y.z,z.z,0, 0,0,0,1);
    q.setFromRotationMatrix(m);
  }
  q.normalize();
  quat = q;
  doOutput();
  highlightActive(mode);
  updateViewer();
}

function highlightActive(mode) {
  document.querySelectorAll('.section-block').forEach((el, i) => {
    el.classList.toggle('active', i === mode);
  });
}

// ---- Output ----
function doOutput() {
  const q = quat;
  const m = new THREE.Matrix4();
  m.makeRotationFromQuaternion(q);
  const r = m.elements;

  // Rotation matrix
  setText('resmatrix',
    '[ ' + toFixedWidth(r[0]) + ', ' + toFixedWidth(r[4]) + ', ' + toFixedWidth(r[8]) + ';\n' +
    '  ' + toFixedWidth(r[1]) + ', ' + toFixedWidth(r[5]) + ', ' + toFixedWidth(r[9]) + ';\n' +
    '  ' + toFixedWidth(r[2]) + ', ' + toFixedWidth(r[6]) + ', ' + toFixedWidth(r[10]) + ' ]'
  );

  // Quaternion
  setText('resq', '[ ' + toReal(q.x) + ', ' + toReal(q.y) + ', ' + toReal(q.z) + ', ' + toReal(q.w) + ' ]');

  // Axis-angle
  let axis = [0, 0, 0];
  let angle = 2 * Math.acos(Math.min(1, Math.max(-1, q.w)));
  if (1 - q.w * q.w < 1e-6) {
    axis = [q.x, q.y, q.z];
  } else {
    const s = Math.sqrt(1 - q.w * q.w);
    axis = [q.x / s, q.y / s, q.z / s];
  }
  setText('resa', '{ [ ' + toReal(axis[0]) + ', ' + toReal(axis[1]) + ', ' + toReal(axis[2]) + ' ], ' + toReal(toAngle(angle)) + ' }');

  // Axis with angle magnitude
  setText('resr', '[ ' + toReal(toAngle(axis[0] * angle)) + ', ' + toReal(toAngle(axis[1] * angle)) + ', ' + toReal(toAngle(axis[2] * angle)) + ' ]');

  // Euler
  const eu = new THREE.Euler();
  eu.setFromRotationMatrix(m, document.getElementById('reseuler').value);
  const ea = eu.toArray();
  setText('rese', '[ x: ' + toReal(toAngle(ea[0])) + ', y: ' + toReal(toAngle(ea[1])) + ', z: ' + toReal(toAngle(ea[2])) + ' ]');


  // Homogeneous 4x4
  updateHomogeneous(r);

  // Angle labels
  updateAngleLabels();

  // Code snippets
  updateSnippets(q, r, axis, angle, ea);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function updateAngleLabels() {
  const iUnit = document.getElementById('iformatdeg').checked ? ' (degrees)' : ' (radians)';
  const oUnit = document.getElementById('resformatdeg').checked ? ' (degrees)' : ' (radians)';
  document.querySelectorAll('[data-angle-input]').forEach(el => el.textContent = iUnit);
  document.querySelectorAll('[data-angle-output]').forEach(el => el.textContent = oUnit);
}

function updateHomogeneous(r) {
  const tx = parseFloat(document.getElementById('tx').value) || 0;
  const ty = parseFloat(document.getElementById('ty').value) || 0;
  const tz = parseFloat(document.getElementById('tz').value) || 0;
  setText('reshomo',
    '[ ' + toFixedWidth(r[0]) + ', ' + toFixedWidth(r[4]) + ', ' + toFixedWidth(r[8]) + ', ' + toReal(tx) + ';\n' +
    '  ' + toFixedWidth(r[1]) + ', ' + toFixedWidth(r[5]) + ', ' + toFixedWidth(r[9]) + ', ' + toReal(ty) + ';\n' +
    '  ' + toFixedWidth(r[2]) + ', ' + toFixedWidth(r[6]) + ', ' + toFixedWidth(r[10]) + ', ' + toReal(tz) + ';\n' +
    '  0,          0,          0,          1 ]'
  );
}


// ---- Code Snippets ----
function updateSnippets(q, r, axis, angle, eulerArr) {
  const py = `from scipy.spatial.transform import Rotation
import numpy as np

# Quaternion [x, y, z, w]
q = [${toReal(q.x)}, ${toReal(q.y)}, ${toReal(q.z)}, ${toReal(q.w)}]
rot = Rotation.from_quat(q)

# Rotation matrix
R = rot.as_matrix()
# Euler angles (XYZ, radians)
euler = rot.as_euler('xyz')
# Axis-angle (rotation vector)
rotvec = rot.as_rotvec()`;

  const cpp = `#include <Eigen/Geometry>

// Quaternion (w, x, y, z)
Eigen::Quaterniond q(${toReal(q.w)}, ${toReal(q.x)}, ${toReal(q.y)}, ${toReal(q.z)});
q.normalize();

// Rotation matrix
Eigen::Matrix3d R = q.toRotationMatrix();

// Axis-angle
Eigen::AngleAxisd aa(q);
// aa.axis(), aa.angle()`;

  const matlab = `% Quaternion [w x y z]
q = [${toReal(q.w)}, ${toReal(q.x)}, ${toReal(q.y)}, ${toReal(q.z)}];

% Rotation matrix
R = quat2rotm(q);

% Euler angles (ZYX convention, radians)
eul = quat2eul(q, 'ZYX');

% Axis-angle
axang = quat2axang(q);`;

  document.getElementById('snippet-python').textContent = py;
  document.getElementById('snippet-cpp').textContent = cpp;
  document.getElementById('snippet-matlab').textContent = matlab;
}

function showSnippet(lang) {
  activeSnippetTab = lang;
  document.querySelectorAll('.snippet-code').forEach(el => el.style.display = 'none');
  document.getElementById('snippet-' + lang).style.display = 'block';
  document.querySelectorAll('.snippet-tab').forEach(el => el.classList.toggle('active', el.dataset.lang === lang));
}

// ---- Copy to clipboard ----
function copyOutput(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const text = el.textContent || el.innerText;
  navigator.clipboard.writeText(text).then(() => {
    const btn = el.parentElement.querySelector('.copy-btn');
    if (btn) {
      btn.classList.add('copied');
      btn.textContent = '✓ Copied';
      setTimeout(() => { btn.classList.remove('copied'); btn.textContent = '⧉ Copy'; }, 1500);
    }
  });
}

function copySnippet() {
  const el = document.getElementById('snippet-' + activeSnippetTab);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => {
    const btn = document.getElementById('copy-snippet-btn');
    if (btn) {
      btn.classList.add('copied');
      btn.textContent = '✓ Copied';
      setTimeout(() => { btn.classList.remove('copied'); btn.textContent = '⧉ Copy'; }, 1500);
    }
  });
}

// ---- Collapsible ----
function toggleCollapsible(headerId) {
  const header = document.getElementById(headerId);
  const body = document.getElementById(headerId + '-body');
  header.classList.toggle('open');
  body.classList.toggle('open');
}

// ---- Rotation Composition ----
function composeRotations() {
  // R1 from Euler
  const r1 = new THREE.Euler(
    toRad(document.getElementById('c1e0').value),
    toRad(document.getElementById('c1e1').value),
    toRad(document.getElementById('c1e2').value), 'XYZ'
  );
  const q1 = new THREE.Quaternion().setFromEuler(r1);

  // R2 from Euler
  const r2 = new THREE.Euler(
    toRad(document.getElementById('c2e0').value),
    toRad(document.getElementById('c2e1').value),
    toRad(document.getElementById('c2e2').value), 'XYZ'
  );
  const q2 = new THREE.Quaternion().setFromEuler(r2);

  // Compose: q_result = q1 * q2
  const qr = new THREE.Quaternion().multiplyQuaternions(q1, q2);
  qr.normalize();

  // Show result
  setText('compose-result-q', '[ ' + toReal(qr.x) + ', ' + toReal(qr.y) + ', ' + toReal(qr.z) + ', ' + toReal(qr.w) + ' ]');

  const eu = new THREE.Euler().setFromQuaternion(qr, 'XYZ');
  const ea = eu.toArray();
  setText('compose-result-e', '[ x: ' + toReal(toAngle(ea[0])) + ', y: ' + toReal(toAngle(ea[1])) + ', z: ' + toReal(toAngle(ea[2])) + ' ]');
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  initViewer();
  update(0);
  showSnippet('python');
});
