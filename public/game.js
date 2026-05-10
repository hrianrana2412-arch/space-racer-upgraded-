// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.0015);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('game-container').appendChild(renderer.domElement);

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(100, 200, 50);
scene.add(dirLight);

// --- GENERATE NEON TRACK ---
const pathRadius = 300;
const tubeRadius = 15;
const trackGeometry = new THREE.TorusKnotGeometry(pathRadius, tubeRadius, 400, 32, 2, 3);
const trackMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    wireframe: true,
    emissive: 0x00ffff,
    emissiveIntensity: 0.5
});
const trackMesh = new THREE.Mesh(trackGeometry, trackMaterial);
scene.add(trackMesh);

// --- PLAYER SHIP ---
const shipGroup = new THREE.Group();
scene.add(shipGroup);

// Main Body
const bodyGeo = new THREE.ConeGeometry(2, 6, 4);
bodyGeo.rotateX(Math.PI / 2);
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xff00ff, emissiveIntensity: 0.3 });
const shipBody = new THREE.Mesh(bodyGeo, bodyMat);
shipGroup.add(shipBody);

// Engine Glow
const engineGeo = new THREE.CircleGeometry(1, 16);
const engineMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide });
const engineGlow = new THREE.Mesh(engineGeo, engineMat);
engineGlow.position.z = -3.1;
shipGroup.add(engineGlow);

// --- GAME PHYSICS & STATE ---
let speed = 0;
const maxSpeed = 2.5;
const nitroSpeed = 4.0;
const acceleration = 0.02;
const braking = 0.05;
const friction = 0.005;
let nitro = 100;

let trackPosition = 0;
const trackCurve = new THREE.CurvePath();
const points = trackGeometry.attributes.position.array;
const vectorPoints = [];
for (let i = 0; i < points.length; i += 3) {
    if(i % 120 === 0) { 
        vectorPoints.push(new THREE.Vector3(points[i], points[i+1], points[i+2]));
    }
}
const closedSpline = new THREE.CatmullRomCurve3(vectorPoints);
closedSpline.closed = true;

let lateralOffset = 0;
const turnSpeed = 0.3;

// --- INPUTS ---
const keys = { w: false, a: false, s: false, d: false, shift: false };
window.addEventListener('keydown', (e) => {
    if(e.key === 'w' || e.key === 'ArrowUp') keys.w = true;
    if(e.key === 'a' || e.key === 'ArrowLeft') keys.a = true;
    if(e.key === 's' || e.key === 'ArrowDown') keys.s = true;
    if(e.key === 'd' || e.key === 'ArrowRight') keys.d = true;
    if(e.key === 'Shift') keys.shift = true;
});
window.addEventListener('keyup', (e) => {
    if(e.key === 'w' || e.key === 'ArrowUp') keys.w = false;
    if(e.key === 'a' || e.key === 'ArrowLeft') keys.a = false;
    if(e.key === 's' || e.key === 'ArrowDown') keys.s = false;
    if(e.key === 'd' || e.key === 'ArrowRight') keys.d = false;
    if(e.key === 'Shift') keys.shift = false;
});

// Mobile Controls
const bindTouch = (id, key) => {
    const el = document.getElementById(id);
    if(el) {
        el.addEventListener('touchstart', (e) => { e.preventDefault(); keys[key] = true; });
        el.addEventListener('touchend', (e) => { e.preventDefault(); keys[key] = false; });
    }
}
bindTouch('btn-accel', 'w');
bindTouch('btn-brake', 's');
bindTouch('btn-left', 'a');
bindTouch('btn-right', 'd');
bindTouch('btn-nitro', 'shift');

// --- UI ELEMENTS ---
const speedUI = document.getElementById('speed-display');
const nitroUI = document.getElementById('nitro-bar');

// --- MAIN LOOP ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    // 1. INPUT & PHYSICS
    let currentMax = keys.shift && nitro > 0 ? nitroSpeed : maxSpeed;
    if (keys.w) speed += acceleration;
    else if (keys.s) speed -= braking;
    else speed -= friction;

    // Nitro Effects
    if (keys.shift && nitro > 0 && speed > 0.5) {
        nitro -= 0.5;
        camera.fov = THREE.MathUtils.lerp(camera.fov, 90, 0.1);
    } else {
        if(nitro < 100) nitro += 0.1;
        camera.fov = THREE.MathUtils.lerp(camera.fov, 75, 0.1);
    }
    camera.updateProjectionMatrix();

    if (speed > currentMax) speed -= friction * 2;
    if (speed < 0) speed = 0;

    // Steering
    if (keys.a) lateralOffset -= turnSpeed;
    if (keys.d) lateralOffset += turnSpeed;
    lateralOffset = THREE.MathUtils.clamp(lateralOffset, -tubeRadius + 2, tubeRadius - 2);

    // 2. THE TRACK LOGIC (The "Anti-Spin" Fix)
    trackPosition += (speed * 0.0001);
    if (trackPosition >= 1) trackPosition -= 1;

    // Get the exact point and direction on the track
    const pos = closedSpline.getPointAt(trackPosition);
    const tangent = closedSpline.getTangentAt(trackPosition).normalize();
    
    // Create a stable coordinate system (Frenet Frame)
    // This ensures 'up' is always relative to the track, not the world
    const frame = closedSpline.computeFrenetFrames(400, true);
    const index = Math.floor(trackPosition * 400);
    const normal = frame.normals[index];
    const binormal = frame.binormals[index];

    // Position the ship using the track's binormal for horizontal offset
    const finalPos = pos.clone().add(binormal.clone().multiplyScalar(lateralOffset));
    shipGroup.position.copy(finalPos);

    // Lock orientation to the track path
    const m = new THREE.Matrix4();
    m.lookAt(finalPos, pos.clone().add(tangent), normal);
    shipGroup.quaternion.setFromRotationMatrix(m);

    // 3. SMOOTH CAMERA
    // Camera stays behind the ship relative to the track's orientation
    const camOffset = new THREE.Vector3(0, 5, -15);
    camOffset.applyQuaternion(shipGroup.quaternion);
    camera.position.lerp(shipGroup.position.clone().add(camOffset), 0.1);
    camera.lookAt(shipGroup.position.clone().add(tangent.clone().multiplyScalar(10)));

    // 4. UI UPDATE
    speedUI.innerText = Math.floor(speed * 100);
    nitroUI.style.width = nitro + "%";
    updateMinimap();

    renderer.render(scene, camera);
}

// --- MINIMAP LOGIC ---
const minimapCanvas = document.getElementById('minimap');
const ctx = minimapCanvas.getContext('2d');
function updateMinimap() {
    minimapCanvas.width = 150;
    minimapCanvas.height = 150;
    ctx.clearRect(0, 0, 150, 150);
    
    const mapScale = 150; 
    const x = (trackPosition * mapScale) % 150;
    const y = 75; 
    
    ctx.fillStyle = '#ff00ff';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
