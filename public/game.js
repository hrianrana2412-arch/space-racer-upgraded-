// --- 1. CORE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000005);
scene.fog = new THREE.Fog(0x000005, 1, 1000);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const light = new THREE.PointLight(0x00ffff, 2, 500);
scene.add(light);

// --- 2. THE TRACK (Compatible Version) ---
// Using TorusKnotGeometry directly to get the path
const trackGeo = new THREE.TorusKnotGeometry(150, 10, 200, 20, 2, 3);
const trackMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true });
const trackMesh = new THREE.Mesh(trackGeo, trackMat);
scene.add(trackMesh);

// Extract path for the ship
const points = [];
for (let i = 0; i < trackGeo.parameters.tubularSegments; i++) {
    const p = new THREE.Vector3();
    // Manual math for Torus Knot path
    const t = (i / trackGeo.parameters.tubularSegments) * Math.PI * 2;
    const p_val = 2;
    const q_val = 3;
    const r = 150;
    const tube = 10;
    p.x = r * (2 + Math.cos(q_val * t)) * Math.cos(p_val * t);
    p.y = r * (2 + Math.cos(q_val * t)) * Math.sin(p_val * t);
    p.z = r * Math.sin(q_val * t);
    points.push(p);
}
const curve = new THREE.CatmullRomCurve3(points);
curve.closed = true;

// --- 3. PLAYER SHIP ---
const shipGroup = new THREE.Group();
const body = new THREE.Mesh(
    new THREE.BoxGeometry(2, 1, 4),
    new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0xff00ff })
);
shipGroup.add(body);
scene.add(shipGroup);

// --- 4. ENGINE STATE ---
let speed = 0;
let progress = 0;
let lateral = 0;
const keys = {};

window.onkeydown = (e) => keys[e.key] = true;
window.onkeyup = (e) => keys[e.key] = false;

// --- 5. ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);

    if (keys['w'] || keys['ArrowUp']) speed += 0.005;
    else if (keys['s'] || keys['ArrowDown']) speed -= 0.01;
    else speed *= 0.98;
    speed = Math.max(0, Math.min(speed, 1.2));

    if (keys['a'] || keys['ArrowLeft']) lateral -= 0.2;
    if (keys['d'] || keys['ArrowRight']) lateral += 0.2;
    lateral = Math.max(-10, Math.min(lateral, 10));

    progress += speed * 0.0005;
    if (progress > 1) progress = 0;

    const pt = curve.getPointAt(progress);
    const tan = curve.getTangentAt(progress);
    shipGroup.position.copy(pt);
    shipGroup.lookAt(pt.clone().add(tan));
    
    shipGroup.translateX(lateral);

    const camPos = new THREE.Vector3(0, 8, -20);
    camPos.applyQuaternion(shipGroup.quaternion);
    camera.position.copy(shipGroup.position.clone().add(camPos));
    camera.lookAt(shipGroup.position);

    document.getElementById('speed-display').innerText = Math.floor(speed * 400);

    renderer.render(scene, camera);
}

window.onresize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};

animate();
