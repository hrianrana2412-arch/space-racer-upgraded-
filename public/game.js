 // --- SCENE SETUP ---
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.001);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('game-container').appendChild(renderer.domElement);

// --- LIGHTING ---
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const light = new THREE.PointLight(0x00ffff, 1, 500);
scene.add(light);

// --- THE TRACK (Built as a mathematical Path) ---
const curve = new THREE.TorusKnotCurve(150, 40, 2, 3); // Main track shape
const tubeGeo = new THREE.TubeGeometry(curve, 200, 15, 12, true);
const tubeMat = new THREE.MeshStandardMaterial({ 
    color: 0x111111, 
    wireframe: true, 
    emissive: 0x00ffff, 
    emissiveIntensity: 0.5 
});
const track = new THREE.Mesh(tubeGeo, tubeMat);
scene.add(track);

// --- PLAYER SHIP ---
const shipGroup = new THREE.Group();
scene.add(shipGroup);

// Ship Body
const shipBody = new THREE.Mesh(
    new THREE.ConeGeometry(2, 6, 4), 
    new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0xff00ff, emissiveIntensity: 0.5 })
);
shipBody.rotateX(Math.PI / 2);
shipGroup.add(shipBody);

// Engine Glow
const engine = new THREE.Mesh(
    new THREE.CircleGeometry(1, 16),
    new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide })
);
engine.position.z = -3.1;
shipGroup.add(engine);

// --- PHYSICS & CONTROLS ---
let speed = 0;
let trackPos = 0;
let lateral = 0;
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

// --- MAIN LOOP ---
function animate() {
    requestAnimationFrame(animate);

    // 1. Movement Logic
    const maxSpeed = keys.shift ? 1.2 : 0.7;
    if (keys.w) speed += 0.005;
    else if (keys.s) speed -= 0.02;
    else speed *= 0.98; // Friction
    speed = Math.min(Math.max(speed, 0), maxSpeed);

    if (keys.a) lateral -= 0.2;
    if (keys.d) lateral += 0.2;
    lateral = Math.min(Math.max(lateral, -10), 10); // Keep inside tube walls

    // 2. Track Navigation
    trackPos += speed * 0.001;
    if (trackPos > 1) trackPos -= 1;

    // Get point and orientation from the curve
    const pos = curve.getPointAt(trackPos);
    const tangent = curve.getTangentAt(trackPos);
    
    // Calculate a stable "Up" using the Frenet Frame of the tube
    const frames = tubeGeo.frenetFrames;
    const index = Math.floor(trackPos * (frames.normals.length - 1));
    const normal = frames.normals[index];
    const binormal = frames.binormals[index];

    // Final Ship Position (Positioned on the inner floor)
    const finalPos = pos.clone()
        .add(normal.clone().multiplyScalar(lateral))
        .add(binormal.clone().multiplyScalar(-10)); // Push to "floor"
    
    shipGroup.position.copy(finalPos);

    // Orientation
    const lookAtPos = pos.clone().add(tangent);
    shipGroup.lookAt(lookAtPos);
    // Apply banking based on turn
    shipBody.rotation.z = THREE.MathUtils.lerp(shipBody.rotation.z, (keys.a ? 0.8 : 0) + (keys.d ? -0.8 : 0), 0.1);

    // 3. Camera
    const camOffset = new THREE.Vector3(0, 5, -15);
    camOffset.applyQuaternion(shipGroup.quaternion);
    camera.position.lerp(shipGroup.position.clone().add(camOffset), 0.1);
    camera.lookAt(shipGroup.position);

    // 4. UI
    document.getElementById('speed-display').innerText = Math.floor(speed * 500);
    document.getElementById('nitro-bar').style.width = (keys.shift ? '50%' : '100%');

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
