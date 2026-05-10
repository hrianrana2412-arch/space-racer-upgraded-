// --- 1. GLOBALS ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

let speed = 0, progress = 0, lateral = 0, nitro = 100, gameActive = false;
let shipSettings = { color: 0xff00ff, model: 'Interceptor' };
let curve, tubeGeo, shipBody, thruster;
const shipGroup = new THREE.Group();
const keys = {};

// --- 2. WORLD BUILDER ---
function initWorld() {
    scene.clear();
    scene.background = new THREE.Color(0x000005);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.position.set(5, 5, 5);
    scene.add(sun);

    // 10,000 Stars
    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for(let i=0; i<10000; i++) starPos.push((Math.random()-0.5)*3000, (Math.random()-0.5)*3000, (Math.random()-0.5)*3000);
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({color: 0xffffff, size: 0.8})));

    // Planets
    for(let i=0; i<12; i++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(Math.random()*30+20, 32, 32), new THREE.MeshStandardMaterial({
            color: Math.random() * 0xffffff, roughness: 0.7
        }));
        p.position.set((Math.random()-0.5)*2000, (Math.random()-0.5)*1500, (Math.random()-0.5)*2000);
        scene.add(p);
    }
}

// --- 3. SHIP CUSTOMIZER ---
function buildShip() {
    shipGroup.clear();
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(shipSettings.color), metalness: 0.8, roughness: 0.2 });
    
    shipBody = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 4), mat);
    shipGroup.add(shipBody);

    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 12), new THREE.MeshPhongMaterial({color: 0x00ffff, transparent:true, opacity:0.6}));
    cockpit.position.set(0, 0.4, 0.5);
    shipGroup.add(cockpit);

    if(shipSettings.model === 'Interceptor') {
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

    thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.5), new THREE.MeshBasicMaterial({color: 0x00ffff}));
    thruster.rotation.x = Math.PI/2; thruster.position.z = -2.2;
    shipGroup.add(thruster);
    
    if(!scene.children.includes(shipGroup)) scene.add(shipGroup);
}

// --- 4. TRACK GENERATOR ---
function generateTrack(type) {
    const points = [];
    const r = type === 'Asteroid Run' ? 240 : 150;
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
    tubeGeo = new THREE.TubeGeometry(curve, 150, 25, 12, true);
    const trackMesh = new THREE.Mesh(tubeGeo, new THREE.MeshStandardMaterial({color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.15}));
    scene.add(trackMesh);
}

// --- 5. LOGIC HOOKS ---
window.setShipModel = (m) => { shipSettings.model = m; buildShip(); };
document.getElementById('shipColor').oninput = (e) => { 
    shipSettings.color = e.target.value; 
    buildShip(); 
};

window.startGame = (track) => {
    initWorld();
    generateTrack(track);
    buildShip();
    document.getElementById('menu-overlay').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    
    // Reset game state
    progress = 0;
    speed = 0;
    gameActive = true;
};

// --- 6. ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);
    
    if(!gameActive) {
        // Menu animation: ship rotates in space
        shipGroup.rotation.y += 0.01;
        renderer.render(scene, camera);
        return;
    }

    if(!tubeGeo || !tubeGeo.frenetFrames) return;

    const isNitro = keys['Shift'] && nitro > 0;
    if (keys['w'] || keys['ArrowUp']) speed += 0.006;
    else if (keys['s'] || keys['ArrowDown']) speed -= 0.01;
    else speed *= 0.98;
    speed = Math.max(0, Math.min(speed, isNitro ? 2.5 : 1.3));

    if (keys['a'] || keys['ArrowLeft']) lateral -= 0.4;
    if (keys['d'] || keys['ArrowRight']) lateral += 0.4;
    lateral = Math.max(-18, Math.min(lateral, 18));

    if(isNitro) { 
        nitro -= 0.6; thruster.material.color.setHex(0xff00ff); 
        camera.fov = THREE.MathUtils.lerp(camera.fov, 95, 0.1);
    } else {
        if(nitro < 100) nitro += 0.2; thruster.material.color.setHex(0x00ffff);
        camera.fov = THREE.MathUtils.lerp(camera.fov, 75, 0.1);
    }
    camera.updateProjectionMatrix();

    progress += speed * 0.0004;
    if(progress > 1) progress = 0;

    const pos = curve.getPointAt(progress);
    const tan = curve.getTangentAt(progress).normalize();
    const frames = tubeGeo.frenetFrames;
    const index = Math.floor(progress * (frames.normals.length - 1));
    
    shipGroup.position.copy(pos)
        .add(frames.binormals[index].clone().multiplyScalar(lateral))
        .add(frames.normals[index].clone().multiplyScalar(15));
    
    shipGroup.lookAt(pos.clone().add(tan));
    shipBody.rotation.z = THREE.MathUtils.lerp(shipBody.rotation.z, (keys['a']?-0.8:0)+(keys['d']?0.8:0), 0.1);

    // CAMERA FOLLOW FIX
    const camOff = new THREE.Vector3(0, 7, -18).applyQuaternion(shipGroup.quaternion);
    camera.position.copy(shipGroup.position.clone().add(camOff));
    camera.lookAt(shipGroup.position.clone().add(tan.multiplyScalar(10)));

    document.getElementById('speed-display').innerText = Math.floor(speed * 400);
    document.getElementById('nitro-bar').style.width = nitro + '%';
    renderer.render(scene, camera);
}

window.onkeydown = (e) => keys[e.key] = true;
window.onkeyup = (e) => keys[e.key] = false;

// Initialize
initWorld(); 
buildShip(); 
camera.position.set(0, 0, 10); 
animate();
