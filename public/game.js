// --- 1. CORE ENGINE & GLOBALS ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

let speed = 0, progress = 0, lateral = 0, nitro = 100, gameActive = false;
let shipSettings = { color: 0xff00ff, model: 'Interceptor' };
let curve, tubeGeo, thruster;
const shipGroup = new THREE.Group();
const keys = {};

// --- 2. XBOX / GAMEPAD SUPPORT ---
let gamepadIndex = null;
window.addEventListener("gamepadconnected", (e) => {
    console.log("Controller Connected: " + e.gamepad.id);
    gamepadIndex = e.gamepad.index;
});

function handleGamepad() {
    if (gamepadIndex === null) return;
    const gp = navigator.getGamepads()[gamepadIndex];
    
    // Axis 0 is Left Stick Left/Right
    if (Math.abs(gp.axes[0]) > 0.1) lateral += gp.axes[0] * 0.8;
    
    // Button 0 (A) or Button 7 (RT) for Gas
    keys['w'] = gp.buttons[0].pressed || gp.buttons[7].pressed;
    // Button 1 (B) or Button 6 (LT) for Brake
    keys['s'] = gp.buttons[1].pressed || gp.buttons[6].pressed;
    // Button 4 (LB) or 2 (X) for Nitro
    keys['Shift'] = gp.buttons[4].pressed || gp.buttons[2].pressed;
}

// --- 3. GARAGE & SHIP FIXES (Model Switching) ---
function buildShip() {
    shipGroup.clear(); // Important for switching
    const mat = new THREE.MeshStandardMaterial({ color: shipSettings.color, metalness: 0.8, roughness: 0.2 });
    
    // Core Fuselage (Used by all)
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 4), mat);
    shipGroup.add(body);

    if (shipSettings.model === 'Interceptor') {
        const wings = new THREE.Mesh(new THREE.BoxGeometry(5, 0.1, 2), mat);
        shipGroup.add(wings);
    } else if (shipSettings.model === 'Speeder') {
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2, 4), mat);
        nose.rotation.x = Math.PI / 2; nose.position.z = 2.5;
        shipGroup.add(nose);
    } else if (shipSettings.model === 'Tanker') {
        const shield = new THREE.Mesh(new THREE.BoxGeometry(3, 2.5, 0.5), mat);
        shield.position.z = 1.5;
        shipGroup.add(shield);
    }

    thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
    thruster.rotation.x = Math.PI / 2; thruster.position.z = -2.2;
    shipGroup.add(thruster);
    scene.add(shipGroup);
}

// --- 4. WORLD & MINIMAP FIXES ---
const mCanvas = document.getElementById('minimap');
const mCtx = mCanvas ? mCanvas.getContext('2d') : null;

function updateMinimap() {
    if (!mCtx) return;
    mCanvas.width = 150; mCanvas.height = 150;
    // Draw Track Circle
    mCtx.strokeStyle = '#0ff'; mCtx.lineWidth = 2;
    mCtx.beginPath(); mCtx.arc(75, 75, 60, 0, Math.PI * 2); mCtx.stroke();
    // Draw Player Dot
    const angle = progress * Math.PI * 2;
    const mx = 75 + Math.cos(angle) * 60;
    const my = 75 + Math.sin(angle) * 60;
    mCtx.fillStyle = '#ff00ff'; mCtx.beginPath(); mCtx.arc(mx, my, 6, 0, Math.PI * 2); mCtx.fill();
}

// --- 5. TRACK & START ---
function generateTrack(type) {
    const points = [];
    const r = (type === 'Asteroid Run') ? 220 : 140;
    for (let i = 0; i <= 100; i++) {
        const t = (i / 100) * Math.PI * 2;
        const x = r * (2 + Math.cos(3 * t)) * Math.cos(2 * t);
        const y = r * (2 + Math.cos(3 * t)) * Math.sin(2 * t);
        const z = r * Math.sin(3 * t);
        trackPoints.push(new THREE.Vector3(x, y, z)); // Note: Ensure trackPoints is declared
    }
}
// Clean Global Curve Logic
function createCurve(r = 150) {
    const pts = [];
    for(let i=0; i<=100; i++) {
        const t = (i/100)*Math.PI*2;
        pts.push(new THREE.Vector3(r*(2+Math.cos(3*t))*Math.cos(2*t), r*(2+Math.cos(3*t))*Math.sin(2*t), r*Math.sin(3*t)));
    }
    curve = new THREE.CatmullRomCurve3(pts);
    curve.closed = true;
    tubeGeo = new THREE.TubeGeometry(curve, 100, 25, 12, true);
    scene.add(new THREE.Mesh(tubeGeo, new THREE.MeshBasicMaterial({color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.1})));
}

window.setShipModel = (m) => { shipSettings.model = m; buildShip(); };
document.getElementById('shipColor').oninput = (e) => { shipSettings.color = e.target.value; buildShip(); };

window.startGame = (track) => {
    scene.clear();
    scene.background = new THREE.Color(0x000005);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    createCurve(track === 'Asteroid Run' ? 220 : 140);
    buildShip();
    document.getElementById('menu-overlay').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    gameActive = true;
};

// --- 6. ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);
    handleGamepad(); // Controller update
    if (!gameActive || !curve) return;

    const isNitro = keys['Shift'] && nitro > 0;
    if (keys['w']) speed += 0.007;
    else if (keys['s']) speed -= 0.015;
    else speed *= 0.985;
    speed = Math.max(0, Math.min(speed, isNitro ? 2.8 : 1.4));

    if (keys['a']) lateral -= 0.5;
    if (keys['d']) lateral += 0.5;
    lateral = Math.max(-18, Math.min(lateral, 18));

    if(isNitro) { nitro -= 0.6; camera.fov = THREE.MathUtils.lerp(camera.fov, 95, 0.1); }
    else { if(nitro < 100) nitro += 0.2; camera.fov = THREE.MathUtils.lerp(camera.fov, 75, 0.1); }
    camera.updateProjectionMatrix();

    progress += speed * 0.0004;
    if (progress > 1) progress = 0;

    const pos = curve.getPointAt(progress);
    const tan = curve.getTangentAt(progress).normalize();
    const frames = tubeGeo.frenetFrames;
    const index = Math.floor(progress * (frames.normals.length - 1));

    shipGroup.position.copy(pos)
        .add(frames.binormals[index].clone().multiplyScalar(lateral))
        .add(frames.normals[index].clone().multiplyScalar(15));
    
    shipGroup.lookAt(pos.clone().add(tan));
    updateMinimap();

    const camOff = new THREE.Vector3(0, 7, -18).applyQuaternion(shipGroup.quaternion);
    camera.position.copy(shipGroup.position.clone().add(camOff));
    camera.lookAt(shipGroup.position.clone().add(tan.multiplyScalar(10)));

    document.getElementById('speed-display').innerText = Math.floor(speed * 420);
    document.getElementById('nitro-bar').style.width = nitro + '%';
    renderer.render(scene, camera);
}

window.onkeydown = (e) => keys[e.key] = true;
window.onkeyup = (e) => keys[e.key] = false;
animate();
