// --- 1. SETUP ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

let speed = 0, progress = 0, lateral = 0, nitro = 100, gameActive = false, isMultiplayer = false;
let currentTrack = 'Neon Circuit';
let shipSettings = { color: "#00ffff", model: 'Interceptor' };
let curve, tubeMesh, shipBody, thruster;
let aiBots = [];
const shipGroup = new THREE.Group();
const keys = {};

const botNames = ["Turbo-X", "Shadow-Rider", "VoidWalker", "CyberKing", "Ghost", "NitroPulse"];

// --- 2. ENVIRONMENT ---
function initWorld() {
    scene.clear();
    scene.background = new THREE.Color(0x000003);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(10, 10, 10); scene.add(sun);
    
    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for(let i=0; i<8000; i++) starPos.push((Math.random()-0.5)*4000, (Math.random()-0.5)*4000, (Math.random()-0.5)*4000);
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({color: 0xffffff, size: 1})));
}

// --- 3. SHIP & GARAGE ---
window.buildShip = function() {
    shipGroup.clear();
    shipGroup.scale.set(2.5, 2.5, 2.5); // BIGGER SPACESHIP
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(shipSettings.color), metalness: 0.8 });
    
    shipBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 4), mat);
    shipGroup.add(shipBody);

    if (shipSettings.model === 'Speeder') {
        const n = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2, 4), mat); n.rotation.x = 1.57; n.position.z = 2.5; shipGroup.add(n);
    } else if (shipSettings.model === 'Tanker') {
        const s = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 0.5), mat); s.position.z = 1.5; shipGroup.add(s);
    } else {
        const w = new THREE.Mesh(new THREE.BoxGeometry(5, 0.1, 2), mat); shipGroup.add(w);
    }
    
    thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.5), new THREE.MeshBasicMaterial({color: 0x00ffff}));
    thruster.rotation.x = 1.57; thruster.position.z = -2.2; shipGroup.add(thruster);
    scene.add(shipGroup);
}

// --- 4. TRACK LOGIC ---
window.selectTrack = (name) => { currentTrack = name; window.generateTrack(); };

window.generateTrack = function() {
    if(tubeMesh) scene.remove(tubeMesh);
    const pts = [];
    let r = (currentTrack === 'Omega Void') ? 100 : 180; // Omega is shorter
    let loops = (currentTrack === 'Omega Void') ? 2 : 3;

    for (let i = 0; i <= 80; i++) {
        const t = (i / 80) * Math.PI * 2;
        pts.push(new THREE.Vector3(r*(2+Math.cos(loops*t))*Math.cos(2*t), r*(2+Math.cos(loops*t))*Math.sin(2*t), r*Math.sin(loops*t)));
    }
    curve = new THREE.CatmullRomCurve3(pts);
    curve.closed = true;
    tubeMesh = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 100, 45, 12, true), // WIDER TRACK (45)
        new THREE.MeshStandardMaterial({color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.1})
    );
    scene.add(tubeMesh);
}

// --- 5. GAME FLOW ---
window.setShipModel = (m) => { shipSettings.model = m; window.buildShip(); };
window.toggleMultiplayer = () => {
    isMultiplayer = !isMultiplayer;
    document.getElementById('multi-btn').innerText = isMultiplayer ? "MODE: MULTIPLAYER" : "MODE: OFFLINE";
};

document.getElementById('shipColor').oninput = (e) => { shipSettings.color = e.target.value; window.buildShip(); };

window.startGame = () => {
    document.getElementById('menu-overlay').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    aiBots.forEach(b => scene.remove(b.mesh)); aiBots = [];
    if(isMultiplayer) {
        for(let i=0; i<3; i++) {
            const bM = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 6), new THREE.MeshStandardMaterial({color: 0xff4444}));
            scene.add(bM);
            aiBots.push({ mesh: bM, progress: Math.random()*0.1, name: botNames[i], lat: (Math.random()-0.5)*50 });
        }
    }
    progress = 0; speed = 0; gameActive = true;
};

// --- 6. LOOP ---
function animate() {
    requestAnimationFrame(animate);
    if(!gameActive) {
        shipGroup.rotation.y += 0.01;
        camera.position.set(20, 15, 50); camera.lookAt(0,0,0);
    } else {
        const isNitro = keys['Shift'] && nitro > 0;
        speed = Math.max(0, Math.min(speed + (keys['w']?0.01:-0.015), isNitro ? 3.5 : 1.8));
        if (keys['a']) lateral -= 0.8; if (keys['d']) lateral += 0.8;
        lateral = Math.max(-40, Math.min(lateral, 40));

        progress += speed * 0.0005;
        if(progress > 1) { document.getElementById('victory-screen').classList.remove('hidden'); gameActive = false; }

        const p = curve.getPointAt(progress);
        shipGroup.position.copy(p);
        shipGroup.lookAt(curve.getPointAt((progress + 0.01) % 1));
        shipGroup.translateX(lateral); shipGroup.translateY(-18);

        aiBots.forEach(bot => {
            bot.progress += 0.0004;
            bot.mesh.position.copy(curve.getPointAt(bot.progress % 1));
            bot.mesh.lookAt(curve.getPointAt((bot.progress + 0.01) % 1));
            bot.mesh.translateY(-18); bot.mesh.translateX(bot.lat);
        });

        camera.position.lerp(new THREE.Vector3(0,10,-25).applyQuaternion(shipGroup.quaternion).add(shipGroup.position), 0.1);
        camera.lookAt(shipGroup.position);
        document.getElementById('speed-display').innerText = Math.floor(speed * 480) + " KM/H";
    }
    renderer.render(scene, camera);
}

initWorld(); window.generateTrack(); window.buildShip(); animate();
window.onkeydown=(e)=>keys[e.key]=true; window.onkeyup=(e)=>keys[e.key]=false;
