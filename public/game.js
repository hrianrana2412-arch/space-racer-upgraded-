const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

let speed = 0, progress = 0, lateral = 0, nitro = 100, gameActive = false;
let currentMap = 'Neon Circuit';
let shipSettings = { color: "#00ffff", model: 'Interceptor' };
let curve, tubeMesh, shipBody, thruster;
let aiBots = [];
const shipGroup = new THREE.Group();
const keys = {};

const botNames = ["X-Phantom", "NeonRebel", "VoidDrifter", "CyberPunx", "Zenith", "ApexAlpha", "Viper-9", "BitRunner"];

// --- 1. ENVIRONMENT ---
function initWorld() {
    scene.clear();
    scene.background = new THREE.Color(0x000005);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(10, 10, 10); scene.add(sun);
    
    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for(let i=0; i<8000; i++) starPos.push((Math.random()-0.5)*4000, (Math.random()-0.5)*4000, (Math.random()-0.5)*4000);
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({color: 0xffffff, size: 1})));
}

// --- 2. MULTI-MAP LOGIC ---
window.selectMap = (mapName) => {
    currentMap = mapName;
    generateTrack();
};

function generateTrack() {
    if(tubeMesh) scene.remove(tubeMesh);
    const pts = [];
    let r = 140, loops = 3;
    
    if(currentMap === 'Asteroid Run') { r = 200; loops = 5; }
    if(currentMap === 'Omega Void') { r = 100; loops = 2; } // Shorter map

    for (let i = 0; i <= 80; i++) {
        const t = (i / 80) * Math.PI * 2;
        pts.push(new THREE.Vector3(r*(2+Math.cos(loops*t))*Math.cos(2*t), r*(2+Math.cos(loops*t))*Math.sin(2*t), r*Math.sin(loops*t)));
    }
    curve = new THREE.CatmullRomCurve3(pts);
    curve.closed = true;
    tubeMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 100, 40, 12, true), new THREE.MeshStandardMaterial({color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.1}));
    scene.add(tubeMesh);
}

// --- 3. SHIP GARAGE ---
window.buildShip = function() {
    shipGroup.clear();
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(shipSettings.color), metalness: 0.8 });
    shipGroup.scale.set(1.5, 1.5, 1.5);
    shipBody = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 4), mat);
    shipGroup.add(shipBody);

    if (shipSettings.model === 'Speeder') {
        const n = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2, 4), mat); n.rotation.x = 1.57; n.position.z = 2.5;
        shipGroup.add(n);
    } else if (shipSettings.model === 'Tanker') {
        const s = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 0.5), mat); s.position.z = 1.5;
        shipGroup.add(s);
    } else {
        const w = new THREE.Mesh(new THREE.BoxGeometry(5, 0.1, 2), mat); shipGroup.add(w);
    }
    
    thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 0.5), new THREE.MeshBasicMaterial({color: 0x00ffff}));
    thruster.rotation.x = 1.57; thruster.position.z = -2.2;
    shipGroup.add(thruster);
    scene.add(shipGroup);
}

// --- 4. GAMEFLOW ---
window.startGame = () => {
    document.getElementById('menu-overlay').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    
    aiBots.forEach(b => scene.remove(b.mesh));
    aiBots = [];
    for(let i=0; i<4; i++) {
        const bMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 5), new THREE.MeshStandardMaterial({color: 0xff0044}));
        scene.add(bMesh);
        aiBots.push({ mesh: bMesh, progress: Math.random()*0.2, name: botNames[Math.floor(Math.random()*botNames.length)], lat: (Math.random()-0.5)*40 });
    }
    progress = 0; speed = 0; gameActive = true;
};

function showVictory() {
    gameActive = false;
    document.getElementById('victory-screen').classList.remove('hidden');
    // Asphalt style camera spin
    setTimeout(() => location.reload(), 5000); 
}

// --- 5. LOOP ---
function animate() {
    requestAnimationFrame(animate);
    if(!gameActive) {
        shipGroup.rotation.y += 0.01;
        camera.position.set(30, 20, 60); camera.lookAt(0,0,0);
    } else {
        const isNitro = keys['Shift'] && nitro > 0;
        speed = Math.max(0, Math.min(speed + (keys['w']?0.01:-0.01), isNitro ? 3.2 : 1.6));
        if (keys['a']) lateral -= 0.8; if (keys['d']) lateral += 0.8;
        lateral = Math.max(-35, Math.min(lateral, 35));

        progress += speed * 0.0005;
        if(progress > 1) showVictory();

        const p = curve.getPointAt(progress);
        shipGroup.position.copy(p);
        shipGroup.lookAt(curve.getPointAt((progress + 0.01) % 1));
        shipGroup.translateX(lateral); shipGroup.translateY(-15);

        aiBots.forEach(bot => {
            bot.progress += 0.00045;
            bot.mesh.position.copy(curve.getPointAt(bot.progress % 1));
            bot.mesh.lookAt(curve.getPointAt((bot.progress + 0.01) % 1));
            bot.mesh.translateY(-15); bot.mesh.translateX(bot.lat);
        });

        camera.position.lerp(new THREE.Vector3(0,8,-20).applyQuaternion(shipGroup.quaternion).add(shipGroup.position), 0.1);
        camera.lookAt(shipGroup.position);
        document.getElementById('speed-display').innerText = Math.floor(speed * 480);
    }
    renderer.render(scene, camera);
}

initWorld(); generateTrack(); window.buildShip(); animate();
window.onkeydown=(e)=>keys[e.key]=true; window.onkeyup=(e)=>keys[e.key]=false;
