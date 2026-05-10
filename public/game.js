const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

let speed = 0, progress = 0, lateral = 0, nitro = 100, gameActive = false, isMultiplayer = false;
let currentTrack = 'Neon Circuit';
let shipSettings = { color: "#00ffff", model: 'Interceptor' };
let curve, tubeMesh, shipBody, thruster, trackOutline;
let aiBots = [];
const shipGroup = new THREE.Group();
const keys = {};

// --- 1. LIGHTING (No more darkness) ---
function initWorld() {
    scene.clear();
    scene.background = new THREE.Color(0x000005);
    scene.add(new THREE.AmbientLight(0xffffff, 1.2)); 
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(50, 100, 50);
    scene.add(sun);

    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for(let i=0; i<8000; i++) starPos.push((Math.random()-0.5)*4000, (Math.random()-0.5)*4000, (Math.random()-0.5)*4000);
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({color: 0xffffff, size: 1.2})));
}

// --- 2. SHIP BUILDER ---
window.buildShip = function() {
    shipGroup.clear();
    shipGroup.scale.set(2.8, 2.8, 2.8);
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(shipSettings.color), metalness: 0.7, roughness: 0.2 });
    shipBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 4), mat);
    shipGroup.add(shipBody);

    if (shipSettings.model === 'Speeder') {
        const n = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.5, 4), mat); n.rotation.x = 1.57; n.position.z = 2.8; shipGroup.add(n);
    } else if (shipSettings.model === 'Tanker') {
        const s = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.2, 0.6), mat); s.position.z = 1.8; shipGroup.add(s);
    } else {
        const w = new THREE.Mesh(new THREE.BoxGeometry(6, 0.1, 2), mat); shipGroup.add(w);
    }
    
    thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 0.5), new THREE.MeshBasicMaterial({color: 0x00ffff}));
    thruster.rotation.x = 1.57; thruster.position.z = -2.2; shipGroup.add(thruster);
    scene.add(shipGroup);
}

// --- 3. TRACKS & AI ---
window.selectTrack = (name) => { currentTrack = name; window.generateTrack(); };
window.generateTrack = function() {
    if(tubeMesh) scene.remove(tubeMesh);
    if(trackOutline) scene.remove(trackOutline);
    const pts = [];
    let r = (currentTrack === 'Hyper Loop') ? 100 : 180;
    let l = (currentTrack === 'Hyper Loop') ? 2 : 3;

    for (let i = 0; i <= 80; i++) {
        const t = (i / 80) * Math.PI * 2;
        pts.push(new THREE.Vector3(r*(2+Math.cos(l*t))*Math.cos(2*t), r*(2+Math.cos(l*t))*Math.sin(2*t), r*Math.sin(l*t)));
    }
    curve = new THREE.CatmullRomCurve3(pts);
    curve.closed = true;
    tubeMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 100, 60, 12, true), new THREE.MeshStandardMaterial({color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.15}));
    scene.add(tubeMesh);

    const lineGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(100));
    trackOutline = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({color: 0xff00ff}));
    scene.add(trackOutline);
}

// --- 4. ENGINE & CONTROLS ---
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
            aiBots.push({ mesh: bM, progress: Math.random()*0.1, lat: (Math.random()-0.5)*60 });
        }
    }
    
    // Attempt Fullscreen
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
    
    progress = 0; speed = 0; gameActive = true;
};

function animate() {
    requestAnimationFrame(animate);
    if(!gameActive) {
        shipGroup.rotation.y += 0.01;
        if(trackOutline) trackOutline.rotation.z += 0.005;
        camera.position.set(20, 20, 60); camera.lookAt(0,0,0);
    } else {
        const isNitro = (keys['shift'] || keys[' ']) && nitro > 0;
        speed = Math.max(0, Math.min(speed + (keys['w'] || keys['arrowup'] ? 0.01 : -0.015), isNitro ? 3.5 : 1.8));
        
        if (keys['a'] || keys['arrowleft']) lateral -= 1.2;
        if (keys['d'] || keys['arrowright']) lateral += 1.2;
        lateral = Math.max(-55, Math.min(lateral, 55));

        progress += speed * 0.0005;
        if(progress > 1) { document.getElementById('victory-screen').classList.remove('hidden'); gameActive = false; }

        const p = curve.getPointAt(progress);
        shipGroup.position.copy(p);
        shipGroup.lookAt(curve.getPointAt((progress + 0.01) % 1));
        shipGroup.translateX(lateral); shipGroup.translateY(-25);

        aiBots.forEach(bot => {
            bot.progress += 0.0004;
            bot.mesh.position.copy(curve.getPointAt(bot.progress % 1));
            bot.mesh.lookAt(curve.getPointAt((bot.progress + 0.01) % 1));
            bot.mesh.translateY(-25); bot.mesh.translateX(bot.lat);
        });

        camera.position.lerp(new THREE.Vector3(0,12,-30).applyQuaternion(shipGroup.quaternion).add(shipGroup.position), 0.1);
        camera.lookAt(shipGroup.position);
        document.getElementById('speed-display').innerText = Math.floor(speed * 480) + " KM/H";
    }
    renderer.render(scene, camera);
}

// TOUCH CONTROLS FOR MOBILE
window.addEventListener('touchstart', (e) => {
    const x = e.touches[0].clientX;
    if (x < window.innerWidth / 2) keys['a'] = true;
    else keys['d'] = true;
    keys['w'] = true; // Auto-gas on touch
});
window.addEventListener('touchend', () => { keys['a'] = false; keys['d'] = false; });

window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

initWorld(); window.generateTrack(); window.buildShip(); animate();
