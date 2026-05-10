// --- 1. CORE ENGINE ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

let speed = 0, progress = 0, lateral = 0, nitro = 100, gameActive = false;
let shipSettings = { color: 0xff00ff, model: 'Interceptor' };
let curve, tubeMesh, shipBody, thruster;
const shipGroup = new THREE.Group();
const keys = {};

// --- 2. THE UNIVERSE ---
function initWorld() {
    scene.clear();
    scene.background = new THREE.Color(0x000005);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.PointLight(0xffffff, 2, 2000);
    sun.position.set(100, 100, 100);
    scene.add(sun);

    // 10,000 Stars
    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for(let i=0; i<10000; i++) starPos.push((Math.random()-0.5)*4000, (Math.random()-0.5)*4000, (Math.random()-0.5)*4000);
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({color: 0xffffff, size: 0.8})));
}

// --- 3. SHIP GARAGE ---
function buildShip() {
    shipGroup.clear();
    const mat = new THREE.MeshStandardMaterial({ color: shipSettings.color, metalness: 0.9, roughness: 0.1 });
    
    shipBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 4), mat);
    shipGroup.add(shipBody);

    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), new THREE.MeshPhongMaterial({color: 0x00ffff, transparent:true, opacity:0.5}));
    cockpit.position.set(0, 0.3, 0.8);
    shipGroup.add(cockpit);

    if(shipSettings.model === 'Interceptor') {
        const wings = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.1, 1.5), mat);
        shipGroup.add(wings);
    }

    thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.5), new THREE.MeshBasicMaterial({color: 0x00ffff}));
    thruster.rotation.x = Math.PI/2; thruster.position.z = -2.1;
    shipGroup.add(thruster);
    
    scene.add(shipGroup);
}

// --- 4. TRACK GENERATOR ---
function generateTrack(level) {
    if(tubeMesh) scene.remove(tubeMesh);
    const points = [];
    const r = level === 'Asteroid Run' ? 220 : 140;
    for (let i = 0; i <= 100; i++) {
        const t = (i / 100) * Math.PI * 2;
        const x = r * (2 + Math.cos(3 * t)) * Math.cos(2 * t);
        const y = r * (2 + Math.cos(3 * t)) * Math.sin(2 * t);
        const z = r * Math.sin(3 * t);
        points.push(new THREE.Vector3(x, y, z));
    }
    curve = new THREE.CatmullRomCurve3(points);
    curve.closed = true;
    const tubeGeo = new THREE.TubeGeometry(curve, 100, 25, 12, true);
    tubeMesh = new THREE.Mesh(tubeGeo, new THREE.MeshStandardMaterial({color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.1}));
    scene.add(tubeMesh);
}

// --- 5. CONTROLS & HUD ---
window.setShipModel = (m) => { shipSettings.model = m; buildShip(); };
document.getElementById('shipColor').oninput = (e) => { shipSettings.color = e.target.value; buildShip(); };

window.startGame = (track) => {
    initWorld();
    generateTrack(track);
    buildShip();
    document.getElementById('menu-overlay').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    gameActive = true;
};

// --- 6. ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);
    if(!gameActive || !curve) return;

    // Nitro/Speed Logic
    const isNitro = keys['Shift'] && nitro > 0;
    if (keys['w'] || keys['ArrowUp']) speed += 0.007;
    else if (keys['s'] || keys['ArrowDown']) speed -= 0.012;
    else speed *= 0.985;
    speed = Math.max(0, Math.min(speed, isNitro ? 2.6 : 1.4));

    // Steering
    if (keys['a'] || keys['ArrowLeft']) lateral -= 0.45;
    if (keys['d'] || keys['ArrowRight']) lateral += 0.45;
    lateral = Math.max(-18, Math.min(lateral, 18));

    // Nitro Effects
    if(isNitro) { 
        nitro -= 0.7; thruster.material.color.setHex(0xff00ff); 
        camera.fov = THREE.MathUtils.lerp(camera.fov, 92, 0.1);
    } else {
        if(nitro < 100) nitro += 0.25; thruster.material.color.setHex(0x00ffff);
        camera.fov = THREE.MathUtils.lerp(camera.fov, 75, 0.1);
    }
    camera.updateProjectionMatrix();

    // Movement Physics
    progress += speed * 0.0004;
    if(progress > 1) progress = 0;

    const pos = curve.getPointAt(progress);
    const lookAtPos = curve.getPointAt((progress + 0.01) % 1);
    
    shipGroup.position.copy(pos);
    shipGroup.lookAt(lookAtPos);
    
    // Position ship inside tube manually
    shipGroup.translateX(lateral);
    shipGroup.translateY(-8); // Pulls it to the "floor"

    // Visual Banking
    const tilt = (keys['a']?-0.7:0) + (keys['d']?0.7:0);
    shipBody.rotation.z = THREE.MathUtils.lerp(shipBody.rotation.z, tilt, 0.1);
    thruster.scale.setScalar(1 + Math.random() * 0.3);

    // Camera follow with slight lag for "feel"
    const camTarget = new THREE.Vector3(0, 6, -16).applyQuaternion(shipGroup.quaternion).add(shipGroup.position);
    camera.position.lerp(camTarget, 0.15);
    camera.lookAt(shipGroup.position.clone().add(shipGroup.getWorldDirection(new THREE.Vector3()).multiplyScalar(10)));

    // HUD Update
    document.getElementById('speed-display').innerText = Math.floor(speed * 420);
    document.getElementById('nitro-bar').style.width = nitro + '%';
    
    renderer.render(scene, camera);
}

// Window Events
window.onkeydown = (e) => keys[e.key] = true;
window.onkeyup = (e) => keys[e.key] = false;
window.onresize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};

// Initial Menu Background
initWorld(); buildShip(); animate();
