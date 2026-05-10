// --- 1. CORE SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

let speed = 0, progress = 0, lateral = 0, nitro = 100, gameActive = false;
let shipSettings = { color: "#ff00ff", model: 'Interceptor' };
let curve, shipBody, thruster;
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

    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for(let i=0; i<8000; i++) starPos.push((Math.random()-0.5)*3000, (Math.random()-0.5)*3000, (Math.random()-0.5)*3000);
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({color: 0xffffff, size: 0.8})));
}

// --- 3. SHIP GARAGE ---
function buildShip() {
    shipGroup.clear();
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(shipSettings.color), metalness: 0.8, roughness: 0.2 });
    
    shipBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 4), mat);
    shipGroup.add(shipBody);

    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), new THREE.MeshPhongMaterial({color: 0x00ffff, transparent:true, opacity:0.5}));
    cockpit.position.set(0, 0.3, 0.8);
    shipGroup.add(cockpit);

    if (shipSettings.model === 'Speeder') {
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2, 4), mat);
        nose.rotation.x = Math.PI/2; nose.position.z = 2.5;
        shipGroup.add(nose);
    } else if (shipSettings.model === 'Tanker') {
        const shield = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 0.5), mat);
        shield.position.z = 1.5;
        shipGroup.add(shield);
    } else {
        const wings = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.1, 1.5), mat);
        shipGroup.add(wings);
    }

    thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.5), new THREE.MeshBasicMaterial({color: 0x00ffff}));
    thruster.rotation.x = Math.PI/2; thruster.position.z = -2.1;
    shipGroup.add(thruster);
    
    if(!scene.children.includes(shipGroup)) scene.add(shipGroup);
}

// --- 4. STARTING & MODES ---
window.setShipModel = (m) => { shipSettings.model = m; buildShip(); };
document.getElementById('shipColor').oninput = (e) => { shipSettings.color = e.target.value; buildShip(); };

window.startGame = (track) => {
    initWorld();
    const r = track === 'Asteroid Run' ? 220 : 140;
    const pts = [];
    for (let i = 0; i <= 100; i++) {
        const t = (i / 100) * Math.PI * 2;
        pts.push(new THREE.Vector3(r*(2+Math.cos(3*t))*Math.cos(2*t), r*(2+Math.cos(3*t))*Math.sin(2*t), r*Math.sin(3*t)));
    }
    curve = new THREE.CatmullRomCurve3(pts);
    curve.closed = true;
    const tubeMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 100, 25, 12, true), new THREE.MeshStandardMaterial({color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.1}));
    scene.add(tubeMesh);
    
    buildShip();
    document.getElementById('menu-overlay').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    gameActive = true;
};

// --- 5. ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);
    
    if(!gameActive) {
        shipGroup.rotation.y += 0.01;
        camera.position.set(0, 5, 12);
        camera.lookAt(0,0,0);
        renderer.render(scene, camera);
        return;
    }

    if(!curve) return;

    const isNitro = keys['Shift'] && nitro > 0;
    if (keys['w']) speed += 0.007; else speed *= 0.985;
    speed = Math.max(0, Math.min(speed, isNitro ? 2.8 : 1.4));

    if (keys['a']) lateral -= 0.5; if (keys['d']) lateral += 0.5;
    lateral = Math.max(-18, Math.min(lateral, 18));

    if(isNitro) { nitro -= 0.7; camera.fov = THREE.MathUtils.lerp(camera.fov, 95, 0.1); }
    else { if(nitro < 100) nitro += 0.25; camera.fov = THREE.MathUtils.lerp(camera.fov, 75, 0.1); }
    camera.updateProjectionMatrix();

    progress += speed * 0.0004;
    if(progress > 1) progress = 0;

    // NO MORE NORMALS/FRENET FRAMES - Simple lookAt logic
    const pos = curve.getPointAt(progress);
    const lookAtPos = curve.getPointAt((progress + 0.01) % 1);
    
    shipGroup.position.copy(pos);
    shipGroup.lookAt(lookAtPos);
    shipGroup.translateX(lateral);
    shipGroup.translateY(-8); // Keeps you on the "floor"

    const camTarget = new THREE.Vector3(0, 6, -16).applyQuaternion(shipGroup.quaternion).add(shipGroup.position);
    camera.position.lerp(camTarget, 0.15);
    camera.lookAt(shipGroup.position);

    document.getElementById('speed-display').innerText = Math.floor(speed * 420);
    document.getElementById('nitro-bar').style.width = nitro + '%';
    renderer.render(scene, camera);
}

window.onkeydown = (e) => keys[e.key] = true;
window.onkeyup = (e) => keys[e.key] = false;
initWorld(); buildShip(); animate();
