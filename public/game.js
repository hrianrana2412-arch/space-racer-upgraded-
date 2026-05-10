const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

let speed = 0, progress = 0, lateral = 0, nitro = 100, gameActive = false, isMultiplayer = false;
let shipSettings = { color: "#ff00ff", model: 'Interceptor' };
let curve, tubeMesh, shipBody, thruster;
let aiBots = [];
let lapStart = Date.now();
const shipGroup = new THREE.Group();
const keys = {};

// --- 1. ENVIRONMENT ---
function initWorld() {
    scene.clear();
    scene.background = new THREE.Color(0x000003);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(10, 10, 10);
    scene.add(sun);

    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for(let i=0; i<6000; i++) starPos.push((Math.random()-0.5)*3000, (Math.random()-0.5)*3000, (Math.random()-0.5)*3000);
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({color: 0xffffff, size: 1.1})));
}

// --- 2. BIGGER SPACESHIP ---
window.buildShip = function() {
    shipGroup.clear();
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(shipSettings.color), metalness: 0.8, roughness: 0.2 });
    
    // Scale the whole group up
    shipGroup.scale.set(1.5, 1.5, 1.5);

    shipBody = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 4.5), mat);
    shipGroup.add(shipBody);

    if (shipSettings.model === 'Speeder') {
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.6, 2.5, 4), mat);
        nose.rotation.x = Math.PI/2; nose.position.z = 3;
        shipGroup.add(nose);
    } else if (shipSettings.model === 'Tanker') {
        const shield = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.2, 0.6), mat);
        shield.position.z = 1.8;
        shipGroup.add(shield);
    } else {
        const wings = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.15, 2), mat);
        shipGroup.add(wings);
    }

    thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.6), new THREE.MeshBasicMaterial({color: 0x00ffff}));
    thruster.rotation.x = Math.PI/2; thruster.position.z = -2.4;
    shipGroup.add(thruster);
    scene.add(shipGroup);
}

// --- 3. SHORT & WIDE TRACK ---
function generateTrack() {
    const pts = [];
    const r = 130; // Smaller radius = Shorter loop
    // Reduced segments (60 instead of 100) = even shorter track
    for (let i = 0; i <= 60; i++) {
        const t = (i / 60) * Math.PI * 2;
        pts.push(new THREE.Vector3(r*(2+Math.cos(3*t))*Math.cos(2*t), r*(2+Math.cos(3*t))*Math.sin(2*t), r*Math.sin(3*t)));
    }
    curve = new THREE.CatmullRomCurve3(pts);
    curve.closed = true;
    
    // Radius 40 (Wider) instead of 25
    tubeMesh = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 80, 40, 12, true), 
        new THREE.MeshStandardMaterial({color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.12})
    );
    scene.add(tubeMesh);
}

// --- 4. MULTIPLAYER BOTS ---
function spawnBots() {
    aiBots.forEach(b => scene.remove(b.mesh));
    aiBots = [];
    if(!isMultiplayer) return;
    const colors = [0xff0000, 0xffff00, 0x00ff00];
    for(let i=0; i<3; i++) {
        const bMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 5), new THREE.MeshStandardMaterial({color: colors[i]}));
        scene.add(bMesh);
        aiBots.push({ mesh: bMesh, progress: Math.random(), lat: (Math.random()-0.5)*30 });
    }
}

// --- 5. LOGIC ---
window.setShipModel = (m) => { shipSettings.model = m; window.buildShip(); };
document.getElementById('shipColor').oninput = (e) => { shipSettings.color = e.target.value; window.buildShip(); };
window.toggleMultiplayer = () => {
    isMultiplayer = !isMultiplayer;
    document.getElementById('multi-btn').innerText = isMultiplayer ? "MODE: MULTIPLAYER" : "MODE: OFFLINE";
};

window.startGame = () => {
    document.getElementById('menu-overlay').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    spawnBots();
    lapStart = Date.now();
    gameActive = true;
};

// --- 6. LOOP ---
function animate() {
    requestAnimationFrame(animate);
    
    if(!gameActive) {
        shipGroup.rotation.y += 0.01;
        // Pushing camera back (25) to see the full track preview
        camera.position.set(0, 30, 80);
        camera.lookAt(0, 0, 0);
    } else {
        const isNitro = keys['Shift'] && nitro > 0;
        if (keys['w']) speed += 0.009; else speed *= 0.985;
        speed = Math.max(0, Math.min(speed, isNitro ? 3.0 : 1.6));
        
        if (keys['a']) lateral -= 0.7; if (keys['d']) lateral += 0.7;
        lateral = Math.max(-35, Math.min(lateral, 35)); // Wider steering for wider track

        progress += speed * 0.0006;
        if(progress > 1) {
            progress = 0;
            const lapTime = ((Date.now() - lapStart) / 1000).toFixed(2);
            document.getElementById('leaderboard').innerHTML = `
                <div class="leader-item">YOU: ${lapTime}s</div>
                <div class="leader-item">BOT 1: 24.12s</div>
                <div class="leader-item">BOT 2: 26.55s</div>
            `;
            lapStart = Date.now();
        }

        const pos = curve.getPointAt(progress);
        const look = curve.getPointAt((progress + 0.01) % 1);
        shipGroup.position.copy(pos);
        shipGroup.lookAt(look);
        shipGroup.translateX(lateral);
        shipGroup.translateY(-15); // Adjusted for wider tube

        aiBots.forEach(bot => {
            bot.progress += 0.0005;
            const bPos = curve.getPointAt(bot.progress % 1);
            bot.mesh.position.copy(bPos);
            bot.mesh.lookAt(curve.getPointAt((bot.progress + 0.01) % 1));
            bot.mesh.translateY(-15); bot.mesh.translateX(bot.lat);
        });

        const camT = new THREE.Vector3(0, 8, -22).applyQuaternion(shipGroup.quaternion).add(shipGroup.position);
        camera.position.lerp(camT, 0.15);
        camera.lookAt(shipGroup.position);
        
        document.getElementById('speed-display').innerText = Math.floor(speed * 450);
    }
    renderer.render(scene, camera);
}

// Add Leaderboard Div to body via JS if not in HTML
if(!document.getElementById('leaderboard')) {
    const lb = document.createElement('div');
    lb.id = 'leaderboard';
    document.getElementById('ui-layer').appendChild(lb);
}

initWorld(); 
generateTrack(); 
window.buildShip(); 
animate();

window.onkeydown = (e) => keys[e.key] = true;
window.onkeyup = (e) => keys[e.key] = false;
