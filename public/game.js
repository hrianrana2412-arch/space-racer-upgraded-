// --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.0012);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 3000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('game-container').appendChild(renderer.domElement);

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);
const pLight = new THREE.PointLight(0x00ffff, 1, 100);
scene.add(pLight);

// --- TRACK GENERATION (Torus Knot) ---
const pathRadius = 400;
const tubeRadius = 25;
const trackGeometry = new THREE.TorusKnotGeometry(pathRadius, tubeRadius, 600, 40, 2, 3);
const trackMaterial = new THREE.MeshStandardMaterial({
    color: 0x050505,
    wireframe: true,
    emissive: 0x00ffff,
    emissiveIntensity: 0.4
});
const trackMesh = new THREE.Mesh(trackGeometry, trackMaterial);
scene.add(trackMesh);

// Create a mathematical curve from the track for navigation
const points = [];
const posAttr = trackGeometry.attributes.position;
for (let i = 0; i < posAttr.count; i += 15) { // Sample points
    points.push(new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)));
}
const closedSpline = new THREE.CatmullRomCurve3(points);
closedSpline.closed = true;

// Pre-calculate Frenet Frames for ultra-stable orientation
const frenetFrames = closedSpline.computeFrenetFrames(2000, true);

// --- PLAYER SHIP ---
const shipGroup = new THREE.Group();
scene.add(shipGroup);

const bodyGeo = new THREE.ConeGeometry(2.5, 7, 4);
bodyGeo.rotateX(Math.PI / 2);
const shipBody = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xff00ff, emissiveIntensity: 0.5 }));
shipGroup.add(shipBody);

const engineGlow = new THREE.Mesh(new THREE.CircleGeometry(1.2, 16), new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide }));
engineGlow.position.z = -3.5;
shipGroup.add(engineGlow);

// --- PHYSICS STATE ---
let speed = 0;
const maxSpeed = 1.5; 
const nitroSpeed = 2.4;
const acceleration = 0.008;
const braking = 0.03;
const friction = 0.004;
let nitro = 100;
let trackPosition = 0;
let lateralOffset = 0;
const turnSpeed = 0.4;

// --- INPUTS ---
const keys = { w: false, a: false, s: false, d: false, shift: false };
const handleKey = (e, val) => {
    if(['w','ArrowUp'].includes(e.key)) keys.w = val;
    if(['a','ArrowLeft'].includes(e.key)) keys.a = val;
    if(['s','ArrowDown'].includes(e.key)) keys.s = val;
    if(['d','ArrowRight'].includes(e.key)) keys.d = val;
    if(e.key === 'Shift') keys.shift = val;
};
window.addEventListener('keydown', (e) => handleKey(e, true));
window.addEventListener('keyup', (e) => handleKey(e, false));

// Mobile Touch
const bindTouch = (id, key) => {
    const el = document.getElementById(id);
    if(el) {
        el.addEventListener('touchstart', (e) => { e.preventDefault(); keys[key] = true; });
        el.addEventListener('touchend', (e) => { e.preventDefault(); keys[key] = false; });
    }
}
bindTouch('btn-accel', 'w'); bindTouch('btn-brake', 's');
bindTouch('btn-left', 'a'); bindTouch('btn-right', 'd');
bindTouch('btn-nitro', 'shift');

// --- UI ---
const speedUI = document.getElementById('speed-display');
const nitroUI = document.getElementById('nitro-bar');

// --- MAIN LOOP ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    
    // 1. Logic & Input
    let currentMax = keys.shift && nitro > 0 ? nitroSpeed : maxSpeed;
    if (keys.w) speed += acceleration;
    else if (keys.s) speed -= braking;
    else speed -= friction;

    if (keys.shift && nitro > 0 && speed > 0.5) {
        nitro -= 0.6;
        camera.fov = THREE.MathUtils.lerp(camera.fov, 85, 0.1);
        engineGlow.material.color.setHex(0xff00ff);
    } else {
        if(nitro < 100) nitro += 0.15;
        camera.fov = THREE.MathUtils.lerp(camera.fov, 70, 0.1);
        engineGlow.material.color.setHex(0x00ffff);
    }
    camera.updateProjectionMatrix();

    speed = THREE.MathUtils.clamp(speed, 0, currentMax);

    if (keys.a) lateralOffset -= turnSpeed;
    if (keys.d) lateralOffset += turnSpeed;
    lateralOffset = THREE.MathUtils.clamp(lateralOffset, -tubeRadius + 6, tubeRadius - 6);

    // 2. Track Navigation (Frenet Frame Math)
    trackPosition += (speed * 0.0001);
    if (trackPosition >= 1) trackPosition -= 1;

    const frameIndex = Math.floor(trackPosition * 1999);
    const pos = closedSpline.getPointAt(trackPosition);
    const tangent = closedSpline.getTangentAt(trackPosition).normalize();
    const normal = frenetFrames.normals[frameIndex];
    const binormal = frenetFrames.binormals[frameIndex];

    // Position ship INSIDE the tube using the Normal vector
    const finalPos = pos.clone().add(normal.clone().multiplyScalar(lateralOffset));
    shipGroup.position.copy(finalPos);

    // Orientation: Use Binormal as the "Up" vector to keep ship feet on the floor
    const lookAtPos = pos.clone().add(tangent);
    const m = new THREE.Matrix4().lookAt(shipGroup.position, lookAtPos, binormal);
    shipGroup.quaternion.slerp(new THREE.Quaternion().setFromRotationMatrix(m), 0.2);

    // Banking
    const bankTarget = (keys.a ? 0.7 : 0) + (keys.d ? -0.7 : 0);
    shipBody.rotation.z = THREE.MathUtils.lerp(shipBody.rotation.z, bankTarget, 0.1);

    // 3. Camera Follow
    const camOffset = new THREE.Vector3(0, 7, -18);
    camOffset.applyQuaternion(shipGroup.quaternion);
    camera.position.lerp(shipGroup.position.clone().add(camOffset), 0.12);
    camera.lookAt(shipGroup.position.clone().add(tangent.clone().multiplyScalar(10)));

    // 4. Update UI
    speedUI.innerHTML = Math.floor(speed * 300) + ' <span style="font-size: 14px;">KM/H</span>';
    nitroUI.style.width = nitro + '%';
    updateMinimap();

    renderer.render(scene, camera);
}

const minimapCanvas = document.getElementById('minimap');
const ctx = minimapCanvas.getContext('2d');
function updateMinimap() {
    minimapCanvas.width = 150; minimapCanvas.height = 150;
    ctx.clearRect(0, 0, 150, 150);
    const x = 75 + Math.cos(trackPosition * Math.PI * 2) * 50;
    const y = 75 + Math.sin(trackPosition * Math.PI * 2) * 50;
    ctx.fillStyle = '#0ff';
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
