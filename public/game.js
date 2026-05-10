// --- 1. CORE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000005);
scene.fog = new THREE.Fog(0x000005, 1, 1500);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const light = new THREE.PointLight(0x00ffff, 2, 1000);
scene.add(light);

// --- 2. THE ENVIRONMENT (Stars & Planets) ---
const starGeo = new THREE.BufferGeometry();
const starCoords = [];
for (let i = 0; i < 3000; i++) {
    starCoords.push((Math.random() - 0.5) * 3000, (Math.random() - 0.5) * 3000, (Math.random() - 0.5) * 3000);
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starCoords, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2 })));

// A big distant planet
const planet = new THREE.Mesh(
    new THREE.SphereGeometry(100, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0x220000 })
);
planet.position.set(400, 200, -800);
scene.add(planet);

// --- 3. THE TRACK (Standard CatmullRom) ---
const trackPoints = [];
for (let i = 0; i <= 100; i++) {
    const t = (i / 100) * Math.PI * 2;
    // Mathematical formula for a Torus Knot path
    const r = 200;
    const x = r * (2 + Math.cos(3 * t)) * Math.cos(2 * t);
    const y = r * (2 + Math.cos(3 * t)) * Math.sin(2 * t);
    const z = r * Math.sin(3 * t);
    trackPoints.push(new THREE.Vector3(x, y, z));
}
const curve = new THREE.CatmullRomCurve3(trackPoints);
curve.closed = true;

const tubeGeo = new THREE.TubeGeometry(curve, 200, 25, 12, true);
const tubeMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.2 });
const trackMesh = new THREE.Mesh(tubeGeo, tubeMat);
scene.add(trackMesh);

// --- 4. PLAYER SHIP ---
const shipGroup = new THREE.Group();
const body = new THREE.Mesh(
    new THREE.BoxGeometry(2, 1, 5),
    new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0xff00ff })
);
shipGroup.add(body);
scene.add(shipGroup);

// --- 5. CONTROLS & PHYSICS ---
let speed = 0, progress = 0, lateral = 0;
const keys = {};
window.onkeydown = (e) => keys[e.key] = true;
window.onkeyup = (e) => keys[e.key] = false;

function animate() {
    requestAnimationFrame(animate);

    // Physics
    if (keys['w'] || keys['ArrowUp']) speed += 0.005;
    else if (keys['s'] || keys['ArrowDown']) speed -= 0.01;
    else speed *= 0.98;
    speed = Math.max(0, Math.min(speed, 1.3));

    if (keys['a'] || keys['ArrowLeft']) lateral -= 0.3;
    if (keys['d'] || keys['ArrowRight']) lateral += 0.3;
    lateral = Math.max(-15, Math.min(lateral, 15));

    // Progress
    progress += speed * 0.0004;
    if (progress > 1) progress = 0;

    // Get position on curve
    const pos = curve.getPointAt(progress);
    const tan = curve.getTangentAt(progress).normalize();
    
    // Set ship basic position
    shipGroup.position.copy(pos);
    shipGroup.lookAt(pos.clone().add(tan));

    // USE TRANSLATE to keep the ship INSIDE the tube walls
    // Translation stays relative to the ship's local direction
    shipGroup.translateX(lateral);
    
    // Banking animation
    body.rotation.z = THREE.MathUtils.lerp(body.rotation.z, (keys['a']?-0.7:0) + (keys['d']?0.7:0), 0.1);

    // Camera follow
    const camOffset = new THREE.Vector3(0, 7, -18);
    camOffset.applyQuaternion(shipGroup.quaternion);
    camera.position.copy(shipGroup.position.clone().add(camOffset));
    camera.lookAt(shipGroup.position.clone().add(tan.clone().multiplyScalar(5)));

    // UI update
    const speedEl = document.getElementById('speed-display');
    if(speedEl) speedEl.innerText = Math.floor(speed * 400);

    renderer.render(scene, camera);
}

window.onresize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};

animate();
