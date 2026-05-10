// --- 1. CORE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000005);
scene.fog = new THREE.Fog(0x000005, 1, 1000);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const light = new THREE.PointLight(0x00ffff, 2, 500);
scene.add(light);

// --- 2. THE TRACK (Simple & Stable) ---
const curve = new THREE.TorusKnotCurve(150, 40, 2, 3);
const tubeGeo = new THREE.TubeGeometry(curve, 100, 15, 8, true);
const tubeMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true });
const trackMesh = new THREE.Mesh(tubeGeo, tubeMat);
scene.add(trackMesh);

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

    // Controls
    if (keys['w'] || keys['ArrowUp']) speed += 0.005;
    else if (keys['s'] || keys['ArrowDown']) speed -= 0.01;
    else speed *= 0.98;
    speed = Math.max(0, Math.min(speed, 1.2));

    if (keys['a'] || keys['ArrowLeft']) lateral -= 0.2;
    if (keys['d'] || keys['ArrowRight']) lateral += 0.2;
    lateral = Math.max(-10, Math.min(lateral, 10));

    // Movement
    progress += speed * 0.0005;
    if (progress > 1) progress = 0;

    // Position ship on curve
    const pt = curve.getPointAt(progress);
    const tan = curve.getTangentAt(progress);
    shipGroup.position.copy(pt);
    shipGroup.lookAt(pt.clone().add(tan));
    
    // Apply lateral offset (move left/right)
    shipGroup.translateX(lateral);

    // Camera follow
    const camPos = new THREE.Vector3(0, 8, -20);
    camPos.applyQuaternion(shipGroup.quaternion);
    camera.position.copy(shipGroup.position.clone().add(camPos));
    camera.lookAt(shipGroup.position);

    // UI
    document.getElementById('speed-display').innerText = Math.floor(speed * 400);
    const nitro = document.getElementById('nitro-bar');
    if(nitro) nitro.style.width = keys['Shift'] ? '50%' : '100%';

    renderer.render(scene, camera);
}

// Handle resizing
window.onresize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};

// START
animate();
