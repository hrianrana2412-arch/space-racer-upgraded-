const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

let speed = 0, progress = 0, lateral = 0, nitro = 100, gameActive = false, isMultiplayer = false;
let shipSettings = { color: "#ff00ff", model: 'Interceptor' };
let curve, tubeMesh, shipBody, thruster;
let aiBots = []; // For Multiplayer
const shipGroup = new THREE.Group();
const keys = {};

// --- 1. THE UNIVERSE ---
function initWorld() {
    scene.clear();
    scene.background = new THREE.Color(0x000005);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(10, 10, 10);
    scene.add(sun);

    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for(let i=0; i<8000; i++) starPos.push((Math.random()-0.5)*3000, (Math.random()-0.5)*3000, (Math.random()-0.5)*3000);
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({color: 0xffffff, size: 0.9})));
}

// --- 2. THE GARAGE ---
window.buildShip = function() {
    shipGroup.clear();
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(shipSettings.color), metalness: 0.8, roughness: 0.2 });
    shipBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 4), mat);
    shipGroup.add(shipBody);

    if (shipSettings.model === 'Speeder') {
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2, 4), mat);
        nose.rotation.x = Math.PI/2; nose.position.z = 2.5;
        shipGroup.add(nose);
    } else if (shipSettings.model === 'Tanker') {
        const shield = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 0.5), mat);
        shield.position.z = 1.5;
        shipGroup.add(shield);
    } else {
        const wings = new THREE.Mesh(new THREE.BoxGeometry(5, 0.1, 1.5), mat);
        shipGroup.add(wings);
    }

    thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.5), new THREE.MeshBasicMaterial({color: 0x00ffff}));
    thruster.rotation.x = Math.PI/2; thruster.position.z = -2.1;
    shipGroup.add(thruster);
    scene.add(shipGroup);
}

// --- 3. TRACK & AI ---
function generateTrack() {
    const pts = [];
    const r = 160;
    for (let i = 0; i <= 100; i++) {
        const t = (i / 100) * Math.PI * 2;
        pts.push(new THREE.Vector3(r*(2+Math.cos(3*t))*Math.cos(2*t), r*(2+Math.cos(3*t))*Math.sin(2*t), r*Math.sin(3*t)));
    }
    curve = new THREE.CatmullRomCurve3(pts);
    curve.closed = true;
    tubeMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 100, 25, 12, true), new THREE.MeshStandardMaterial({color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.1}));
    scene.add(tubeMesh);
}

function spawnAIBots() {
    aiBots.forEach(bot => scene.remove(bot.mesh));
    aiBots = [];
    if(!isMultiplayer) return;

    for(let i=0; i<3; i++) {
        const botMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 3), new THREE.MeshStandardMaterial({color: 0xff0000}));
        scene.add(botMesh);
        aiBots.push({ mesh: botMesh, progress: Math.random(), lateral: (Math.random()-0.5)*20 });
    }
}

// --- 4. CONTROLS ---
window.setShipModel = (m) => { shipSettings.model = m; window.buildShip(); };
document.getElementById('shipColor').oninput = (e) => { shipSettings.color = e.target.value; window.buildShip(); };

window.toggleMultiplayer = () => {
    isMultiplayer = !isMultiplayer;
    document.getElementById('multi-btn').innerText = isMultiplayer ? "MODE: MULTIPLAYER" : "MODE: OFFLINE";
};

window.startGame = () => {
    document.getElementById('menu-overlay').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    spawnAIBots();
    gameActive = true;
};

// --- 5. ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);
    
    if(!gameActive) {
        // MENU PREVIEW: Rotate ship AND show the track in the background
        shipGroup.rotation.y += 0.01;
        camera.position.set(0, 8, 15);
        camera.lookAt(0, 0, 0);
    } else {
        const isNitro = keys['Shift'] && nitro > 0;
        if (keys['w']) speed += 0.007; else speed *= 0.985;
        speed = Math.max(0, Math.min(speed, isNitro ? 2.8 : 1.4));
        if (keys['a']) lateral -= 0.5; if (keys['d']) lateral += 0.5;
        lateral = Math.max(-18, Math.min(lateral, 18));

        progress += speed * 0.0004;
        if(progress > 1) progress = 0;

        const pos = curve.getPointAt(progress);
        const lookAtPos = curve.getPointAt((progress + 0.01) % 1);
        shipGroup.position.copy(pos);
        shipGroup.lookAt(lookAtPos);
        shipGroup.translateX(lateral);
        shipGroup.translateY(-8);

        // AI Logic
        aiBots.forEach(bot => {
            bot.progress += 0.0003;
            const bPos = curve.getPointAt(bot.progress % 1);
            bot.mesh.position.copy(bPos);
            bot.mesh.lookAt(curve.getPointAt((bot.progress + 0.01) % 1));
            bot.mesh.translateY(-8);
            bot.mesh.translateX(bot.lateral);
        });

        // Camera Follow
        const camTarget = new THREE.Vector3(0, 6, -16).applyQuaternion(shipGroup.quaternion).add(shipGroup.position);
        camera.position.lerp(camTarget, 0.15);
        camera.lookAt(shipGroup.position);
        
        document.getElementById('speed-display').innerText = Math.floor(speed * 420);
    }
    renderer.render(scene, camera);
}

initWorld(); 
generateTrack(); // Show track preview in menu
window.buildShip(); 
animate();

window.onkeydown = (e) => keys[e.key] = true;
window.onkeyup = (e) => keys[e.key] = false;
