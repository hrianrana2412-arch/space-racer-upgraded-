const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

let speed = 0, progress = 0, lateral = 0, nitro = 100, gameActive = false;
let shipSettings = { color: "#00ffff", model: 'Interceptor' };
let curve, tubeMesh, shipBody, thruster;
let aiBots = [];
const shipGroup = new THREE.Group();
const keys = {};

function initWorld() {
    scene.clear();
    scene.background = new THREE.Color(0x000005);
    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const sun = new THREE.PointLight(0xffffff, 2.5, 5000);
    sun.position.set(50, 200, 100);
    scene.add(sun);
}

// --- 6 HIGH QUALITY SHIP TYPES ---
window.setShip = (m) => { shipSettings.model = m; window.buildShip(); };
window.buildShip = function() {
    shipGroup.clear();
    shipGroup.scale.set(3, 3, 3);
    const mat = new THREE.MeshPhongMaterial({ color: new THREE.Color(shipSettings.color), specular: 0xffffff, shininess: 100 });
    
    // Base Hull
    shipBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 4), mat);
    shipGroup.add(shipBody);

    if (shipSettings.model === 'Interceptor') {
        const w = new THREE.Mesh(new THREE.BoxGeometry(6, 0.1, 2), mat); shipGroup.add(w);
    } else if (shipSettings.model === 'Speeder') {
        const n = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3, 4), mat); n.rotation.x = 1.57; n.position.z = 3; shipGroup.add(n);
    } else if (shipSettings.model === 'Tanker') {
        const s = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2, 1), mat); s.position.z = 1; shipGroup.add(s);
    } else if (shipSettings.model === 'Vanguard') {
        const w1 = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 1), mat); w1.position.y = 0.5; shipGroup.add(w1);
        const w2 = w1.clone(); w2.position.y = -0.5; shipGroup.add(w2);
    } else if (shipSettings.model === 'Phantom') {
        const w = new THREE.Mesh(new THREE.TorusGeometry(2, 0.1, 8, 50), mat); w.rotation.y = 1.57; shipGroup.add(w);
    } else if (shipSettings.model === 'Zenith') {
        const n = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.8, 4), mat); n.rotation.x = 1.57; n.position.z = 1; shipGroup.add(n);
    }
    
    thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 0.5), new THREE.MeshBasicMaterial({color: 0x00ffff}));
    thruster.rotation.x = 1.57; thruster.position.z = -2.2; shipGroup.add(thruster);
    scene.add(shipGroup);
}

// --- 10 MAPS GENERATOR ---
const trackList = document.getElementById('track-list');
for(let i=1; i<=10; i++) {
    const btn = document.createElement('button');
    btn.innerText = `Sector ${i}`;
    btn.onclick = () => { window.generateTrack(i); };
    trackList.appendChild(btn);
}

window.generateTrack = function(id = 1) {
    if(tubeMesh) scene.remove(tubeMesh);
    const pts = [];
    let r = 100 + (id * 20);
    let complexity = id % 3 + 2;
    for (let i = 0; i <= 80; i++) {
        const t = (i / 80) * Math.PI * 2;
        pts.push(new THREE.Vector3(r*(2+Math.cos(complexity*t))*Math.cos(2*t), r*(2+Math.cos(complexity*t))*Math.sin(2*t), r*Math.sin(complexity*t)));
    }
    curve = new THREE.CatmullRomCurve3(pts);
    curve.closed = true;
    tubeMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 100, 80, 12, true), new THREE.MeshStandardMaterial({color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.2}));
    scene.add(tubeMesh);
}

// --- MULTIPLAYER AI BOTS ---
function spawnBots() {
    aiBots.forEach(b => scene.remove(b.mesh));
    aiBots = [];
    for(let i=0; i<5; i++) {
        const bM = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 6), new THREE.MeshStandardMaterial({color: 0xff4444}));
        scene.add(bM);
        aiBots.push({ mesh: bM, progress: Math.random(), lat: (Math.random()-0.5)*80 });
    }
}

const bindBtn = (id, key) => {
    const el = document.getElementById(id);
    if(!el) return;
    const press = (e) => { e.preventDefault(); keys[key] = true; };
    const release = (e) => { e.preventDefault(); keys[key] = false; };
    el.addEventListener('touchstart', press, { passive: false });
    el.addEventListener('touchend', release, { passive: false });
    el.addEventListener('mousedown', press); el.addEventListener('mouseup', release);
};

window.startGame = () => {
    if(!curve) window.generateTrack(1);
    document.getElementById('menu-overlay').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    spawnBots();
    gameActive = true;
};

function animate() {
    requestAnimationFrame(animate);
    if(!gameActive) {
        shipGroup.rotation.y += 0.01;
        camera.position.set(15, 10, 35); camera.lookAt(0,0,0);
    } else {
        if(!curve) return;
        const isNitro = keys['shift'] && nitro > 0;
        speed = Math.max(0, Math.min(speed + (keys['w'] ? 0.02 : -0.01), isNitro ? 5.0 : 2.5));
        if (keys['a']) lateral -= 2.5; if (keys['d']) lateral += 2.5;
        lateral = Math.max(-75, Math.min(75, lateral));
        progress += speed * 0.0004;

        const p = curve.getPointAt(progress % 1);
        shipGroup.position.copy(p);
        shipGroup.lookAt(curve.getPointAt((progress + 0.01) % 1));
        const right = new THREE.Vector3().setFromMatrixColumn(shipGroup.matrix, 0);
        shipGroup.position.addScaledVector(right, lateral);
        const down = new THREE.Vector3(0, -1, 0).applyQuaternion(shipGroup.quaternion);
        shipGroup.position.addScaledVector(down, 35);

        aiBots.forEach(bot => {
            bot.progress += 0.0003;
            bot.mesh.position.copy(curve.getPointAt(bot.progress % 1));
            bot.mesh.lookAt(curve.getPointAt((bot.progress + 0.01) % 1));
            const bRight = new THREE.Vector3().setFromMatrixColumn(bot.mesh.matrix, 0);
            bot.mesh.position.addScaledVector(bRight, bot.lat);
            bot.mesh.position.addScaledVector(new THREE.Vector3(0,-1,0).applyQuaternion(bot.mesh.quaternion), 35);
        });

        camera.position.lerp(new THREE.Vector3(0,18,-45).applyQuaternion(shipGroup.quaternion).add(shipGroup.position), 0.1);
        camera.lookAt(shipGroup.position);
        
        document.getElementById('speed-display').innerText = Math.floor(speed * 480) + " KM/H";
        document.getElementById('nitro-bar').style.width = nitro + "%";
        if(isNitro) { nitro -= 0.8; thruster.scale.set(3,3,3); } else { if(nitro < 100) nitro += 0.3; thruster.scale.set(1,1,1); }
    }
    renderer.render(scene, camera);
}

window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);
bindBtn('btn-left', 'a'); bindBtn('btn-right', 'd'); bindBtn('btn-gas', 'w'); bindBtn('btn-nitro', 'shift');

initWorld(); window.buildShip(); animate();
