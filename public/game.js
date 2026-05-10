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

// --- 2. THE TRACK (Standard Torus Knot) ---
const trackGeo = new THREE.TorusKnotGeometry(150, 20, 200, 30, 2, 3);
const trackMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.3 });
const trackMesh = new THREE.Mesh(trackGeo, trackMat);
scene.add(trackMesh);

// Create the mathematical path
const points = [];
const tubularSegments = trackGeo.parameters.tubularSegments;
for (let i = 0; i <= tubularSegments; i++) {
    const t = (i / tubularSegments) * Math.PI * 2;
    const p = new THREE.Vector3();
    const r = 150;
    p.x = r * (2 + Math.cos(3 * t)) * Math.cos(2 * t);
    p.y = r * (2 + Math.cos(3 * t)) * Math.sin(2 * t);
    p.z = r * Math.sin(3 * t);
    points.push(p);
}
const curve = new THREE.CatmullRomCurve3(points);
curve.closed = true;

// --- 3. PLAYER SHIP ---
const shipGroup = new THREE.Group();
const body = new THREE.Mesh(
    new THREE.ConeGeometry(2, 6, 4),
    new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0xff00ff })
);
body.rotateX(Math.PI / 2);
shipGroup.add(body);
scene.add(shipGroup);

// --- 4. CONTROLS & STATE ---
let speed = 0;
let progress = 0;
let mouseX = 0;
const keys = {};

window.onkeydown = (e) => keys[e.key] = true;
window.onkeyup = (e) => keys[e.key] = false;

// Mouse Tracking for Gyroscope Steering
window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1; // Range -1 to 1
});

// --- 5. ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);

    // Speed Handling
    if (keys['w'] || keys['ArrowUp']) speed += 0.006;
    else if (keys['s'] || keys['ArrowDown']) speed -= 0.01;
    else speed *= 0.98;
    speed = Math.max(0, Math.min(speed, 1.5));

    // Progress along track
    progress += speed * 0.0004;
    if (progress > 1) progress = 0;

    // Position ship on the path
    const pt = curve.getPointAt(progress);
    const tan = curve.getTangentAt(progress).normalize();
    
    shipGroup.position.copy(pt);
    shipGroup.lookAt(pt.clone().add(tan));

    // GYRO STEERING & POSITIONING (Fixes "Outside Map")
    // Move the ship side-to-side based on mouse
    const lateralScale = 15; 
    shipGroup.translateX(mouseX * lateralScale);
    
    // THE FIX: Move ship TOWARD the origin to keep it inside the tube loops
    // This pulls the ship from the "Ghost" position back into the center
    const centerDir = new THREE.Vector3(0,0,0).sub(pt).normalize();
    shipGroup.position.add(centerDir.multiplyScalar(2)); 

    // Banking Effect
    body.rotation.z = THREE.MathUtils.lerp(body.rotation.z, -mouseX * 1.2, 0.1);

    // CAMERA FOLLOW (Stabilized)
    const camOffset = new THREE.Vector3(0, 7, -20);
    camOffset.applyQuaternion(shipGroup.quaternion);
    camera.position.lerp(shipGroup.position.clone().add(camOffset), 0.1);
    camera.lookAt(shipGroup.position.clone().add(tan.multiplyScalar(10)));

    // UI UPDATE
    const speedDisplay = document.getElementById('speed-display');
    if(speedDisplay) speedDisplay.innerText = Math.floor(speed * 450);

    renderer.render(scene, camera);
}

// Resizing
window.onresize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};

animate();
