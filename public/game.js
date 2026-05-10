// --- 1. CONFIG ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

// State
let speed = 0, progress = 0, lateral = 0, nitro = 100, gameActive = false;
let shipSettings = { color: 0xff00ff, model: 'Interceptor' };
const keys = {};

// --- 2. THE WORLD (Stars & Planets) ---
function initWorld() {
    scene.clear();
    scene.background = new THREE.Color(0x000005);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const pLight = new THREE.PointLight(0x00ffff, 2, 1000);
    pLight.position.set(0, 100, 0);
    scene.add(pLight);

    // Realistic Starfield
    const starGeo = new THREE.BufferGeometry();
    const starCoords = [];
    for (let i = 0; i < 8000; i++) {
        starCoords.push((Math.random() - 0.5) * 3000, (Math.random() - 0.5) * 3000, (Math.random() - 0.5) * 3000);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starCoords, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.7 })));

    // Distant Planets
    for(let i=0; i<10; i++){
        const planet = new THREE.Mesh(new THREE.SphereGeometry(Math.random()*40+20, 32, 32), new THREE.MeshStandardMaterial({color: Math.random()*0xffffff}));
        planet.position.set((Math.random()-0.5)*2000, (Math.random()-0.5)*2000, (Math.random()-0.5)*2000);
        scene.add(planet);
    }
}

// --- 3. THE SHIP BUILDER ---
const shipGroup = new THREE.Group();
let thruster;
function buildShip() {
    shipGroup.clear();
    const mat = new THREE.MeshStandardMaterial({ color: shipSettings.color, metalness: 0.7, roughness: 0.2 });
    
    // Fuselage
    const fuselage = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 5), mat);
    shipGroup.add(fuselage);

    if(shipSettings.model === 'Interceptor') {
        const wings = new THREE.Mesh(new THREE.BoxGeometry(5, 0.1, 2), mat);
        shipGroup.add(wings);
    }

    thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({color: 0x00ffff}));
    thruster.rotation.x = Math.PI/2; thruster.position.z = -2.5;
    shipGroup.add(thruster);
    scene.add(shipGroup);
}

// --- 4. TRACK GENERATOR ---
let curve, tubeGeo;
function generateTrack(type) {
    const points = [];
    const r = type === 'Asteroid Run' ? 250 : 160;
    const loops = type === 'Asteroid Run' ? 5 : 3;

    for (let i = 0; i <= 100; i++) {
        const t = (i / 100) * Math.PI * 2;
        const x = r * (2 + Math.cos(loops * t)) * Math.cos(2 * t);
        const y = r * (2 + Math.cos(loops * t)) * Math.sin(2 * t);
        const z = r * Math.sin(loops * t);
        points.push(new THREE.Vector3(x, y, z));
    }
    curve = new THREE.CatmullRomCurve3(points);
    curve.closed = true;
    tubeGeo = new THREE.TubeGeometry(curve, 100, 25, 12, true);
    scene.add(new THREE.Mesh(tubeGeo, new THREE.MeshStandardMaterial({color: 0x00ffff, wireframe: true, transparent:true, opacity:0.1})));
}

// --- 5. GAME LOGIC ---
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

function animate() {
    requestAnimationFrame(animate);
    
    // THE SAFETY FIX: If the track or its frames aren't ready yet, don't run the physics
    if(!gameActive || !tubeGeo || !tubeGeo.frenetFrames) return;

    // 1. PHYSICS & INPUTS
    const isNitro = (keys['Shift'] || keys['ShiftLeft'] || keys['ShiftRight']) && nitro > 0;
    
    if (keys['w'] || keys['ArrowUp']) speed += 0.006;
    else if (keys['s'] || keys['ArrowDown']) speed -= 0.01;
    else speed *= 0.98;
    
    speed = Math.min(Math.max(speed, 0), isNitro ? 2.5 : 1.3);

    if (keys['a'] || keys['ArrowLeft']) lateral -= 0.4;
    if (keys['d'] || keys['ArrowRight']) lateral += 0.4;
    lateral = Math.max(-18, Math.min(lateral, 18));

    // Nitro handling
    if(isNitro) { 
        nitro -= 0.5; 
        if(thruster) thruster.material.color.setHex(0xff00ff); 
        camera.fov = THREE.MathUtils.lerp(camera.fov, 90, 0.1);
    } else {
        if(nitro < 100) nitro += 0.2; 
        if(thruster) thruster.material.color.setHex(0x00ffff);
        camera.fov = THREE.MathUtils.lerp(camera.fov, 75, 0.1);
    }
    camera.updateProjectionMatrix();

    // 2. MOVEMENT
    progress += speed * 0.0004;
    if(progress > 1) progress = 0;

    const pos = curve.getPointAt(progress);
    const tan = curve.getTangentAt(progress).normalize();
    
    // Stable Frenet Frame calculation
    const frames = tubeGeo.frenetFrames;
    const index = Math.floor(progress * (frames.normals.length - 1));
    const normal = frames.normals[index];
    const binormal = frames.binormals[index];

    // Position ship INSIDE the track
    shipGroup.position.copy(pos)
        .add(binormal.clone().multiplyScalar(lateral))
        .add(normal.clone().multiplyScalar(15));
        
    shipGroup.lookAt(pos.clone().add(tan));
    
    // Banking animation
    const bankTarget = (keys['a'] ? -0.8 : 0) + (keys['d'] ? 0.8 : 0);
    shipBody.rotation.z = THREE.MathUtils.lerp(shipBody.rotation.z, bankTarget, 0.1);

    // 3. CAMERA
    const camOff = new THREE.Vector3(0, 7, -18).applyQuaternion(shipGroup.quaternion);
    camera.position.copy(shipGroup.position.clone().add(camOff));
    camera.lookAt(shipGroup.position.clone().add(tan.multiplyScalar(10)));

    // 4. UI
    const speedEl = document.getElementById('speed-display');
    const nitroEl = document.getElementById('nitro-bar');
    if(speedEl) speedEl.innerText = Math.floor(speed * 400);
    if(nitroEl) nitroEl.style.width = nitro + '%';

    renderer.render(scene, camera);
}

    renderer.render(scene, camera);
}

window.onkeydown = (e) => keys[e.key] = true;
window.onkeyup = (e) => keys[e.key] = false;
initWorld(); buildShip(); // Show ship in menu background
animate();
