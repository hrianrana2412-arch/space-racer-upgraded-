const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 20000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

let speed = 0, progress = 0, lateral = 0, nitro = 100, gameActive = false, winSequence = false;
let shipSettings = { color: "#00ffff", model: 'Interceptor' };
let curve, tubeMesh, shipBody, thruster;
let aiBots = [];
const shipGroup = new THREE.Group();
const keys = {};

// --- 1. THE UNIVERSE (Stars & Planets) ---
function initWorld() {
    scene.clear();
    scene.background = new THREE.Color(0x000005);
    
    // Ambient light for the ship, Point lights for the "Sun"
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const sun = new THREE.PointLight(0xffffff, 4, 10000);
    sun.position.set(500, 500, 500);
    scene.add(sun);

    // Starfield
    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for(let i=0; i<15000; i++) starPos.push((Math.random()-0.5)*10000, (Math.random()-0.5)*10000, (Math.random()-0.5)*10000);
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({color: 0xffffff, size: 2}));
    scene.add(stars);

    // Planets
    const colors = [0xff4400, 0x0044ff, 0x44ff00, 0xff00ff];
    for(let i=0; i<8; i++) {
        const planetGeo = new THREE.SphereGeometry(100 + Math.random()*200, 32, 32);
        const planetMat = new THREE.MeshPhongMaterial({color: colors[i%4], emissive: colors[i%4], emissiveIntensity: 0.2});
        const planet = new THREE.Mesh(planetGeo, planetMat);
        planet.position.set((Math.random()-0.5)*8000, (Math.random()-0.5)*8000, (Math.random()-0.5)*8000);
        scene.add(planet);
    }
}

// --- 2. THE SHIPS (6 Real Designs) ---
window.setShip = (m) => { shipSettings.model = m; window.buildShip(); };
window.buildShip = function() {
    shipGroup.clear(); shipGroup.scale.set(3, 3, 3);
    const mat = new THREE.MeshPhongMaterial({ color: new THREE.Color(shipSettings.color), specular: 0xffffff, shininess: 100, emissive: new THREE.Color(shipSettings.color), emissiveIntensity: 0.2 });
    
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 4), mat); shipGroup.add(hull);
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), new THREE.MeshPhongMaterial({color: 0x000000}));
    cockpit.position.set(0, 0.3, 0.6); cockpit.scale.set(1, 0.5, 1.5); shipGroup.add(cockpit);

    if (shipSettings.model === 'Speeder') {
        const n = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3, 4), mat); n.rotation.x = 1.57; n.position.z = 2.5; shipGroup.add(n);
    } else if (shipSettings.model === 'Vanguard') {
        const wL = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 2), mat); wL.position.set(1.5, 0, -0.5); shipGroup.add(wL);
        const wR = wL.clone(); wR.position.x = -1.5; shipGroup.add(wR);
    } else if (shipSettings.model === 'Tanker') {
        const b = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 3), mat); shipGroup.add(b);
    } else if (shipSettings.model === 'Phantom') {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.1, 8, 20), mat); ring.rotation.y = 1.57; shipGroup.add(ring);
    } else if (shipSettings.model === 'Zenith') {
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2, 2), mat); f.position.z = -1; shipGroup.add(f);
    }
    
    thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 0.6), new THREE.MeshBasicMaterial({color: 0x00ffff}));
    thruster.rotation.x = 1.57; thruster.position.z = -2.1; shipGroup.add(thruster);
    scene.add(shipGroup);
}

// --- 3. TRACK & MULTIPLAYER ---
window.generateTrack = function(id = 1) {
    if(tubeMesh) scene.remove(tubeMesh);
    const pts = []; let r = 200 + (id * 20);
    for (let i = 0; i <= 100; i++) {
        const t = (i / 100) * Math.PI * 2;
        pts.push(new THREE.Vector3(r*(2+Math.cos(3*t))*Math.cos(2*t), r*(2+Math.cos(3*t))*Math.sin(2*t), r*Math.sin(3*t)));
    }
    curve = new THREE.CatmullRomCurve3(pts); curve.closed = true;
    tubeMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 100, 80, 16, true), new THREE.MeshStandardMaterial({color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.3}));
    scene.add(tubeMesh);
}

window.startGame = () => {
    if(!curve) window.generateTrack(1);
    document.getElementById('menu-overlay').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    
    // Spawn Rivals
    aiBots.forEach(b => scene.remove(b.mesh)); aiBots = [];
    for(let i=0; i<5; i++) {
        const bM = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 8), new THREE.MeshStandardMaterial({color: 0xff0055, emissive: 0xff0000, emissiveIntensity: 0.5}));
        scene.add(bM); aiBots.push({ mesh: bM, progress: Math.random()*0.1, lat: (Math.random()-0.5)*120 });
    }
    gameActive = true;
};

function animate() {
    requestAnimationFrame(animate);
    if(winSequence) {
        shipGroup.rotation.y += 0.1; camera.position.z += 2; camera.lookAt(shipGroup.position);
    } else if(!gameActive) {
        shipGroup.rotation.y += 0.01; camera.position.set(20, 15, 45); camera.lookAt(0,0,0);
    } else {
        const isNitro = keys['shift'] && nitro > 0;
        speed = Math.max(0, Math.min(speed + (keys['w'] ? 0.025 : -0.015), isNitro ? 6.0 : 3.0));
        if (keys['a']) lateral += 3; if (keys['d']) lateral -= 3;
        lateral = Math.max(-70, Math.min(70, lateral));
        progress += speed * 0.0004;

        if(progress > 0.99) { winSequence = true; document.getElementById('win-screen').classList.remove('hidden'); }

        const p = curve.getPointAt(progress % 1);
        shipGroup.position.copy(p);
        shipGroup.lookAt(curve.getPointAt((progress + 0.01) % 1));
        const right = new THREE.Vector3().setFromMatrixColumn(shipGroup.matrix, 0);
        shipGroup.position.addScaledVector(right, -lateral);
        shipGroup.position.addScaledVector(new THREE.Vector3(0,-1,0).applyQuaternion(shipGroup.quaternion), 40);

        aiBots.forEach(bot => {
            bot.progress += 0.00038;
            bot.mesh.position.copy(curve.getPointAt(bot.progress % 1));
            bot.mesh.lookAt(curve.getPointAt((bot.progress + 0.01) % 1));
            const bRight = new THREE.Vector3().setFromMatrixColumn(bot.mesh.matrix, 0);
            bot.mesh.position.addScaledVector(bRight, bot.lat);
            bot.mesh.position.addScaledVector(new THREE.Vector3(0,-1,0).applyQuaternion(bot.mesh.quaternion), 40);
        });

        camera.position.lerp(new THREE.Vector3(0,25,-60).applyQuaternion(shipGroup.quaternion).add(shipGroup.position), 0.1);
        camera.lookAt(shipGroup.position);
        
        document.getElementById('speed-display').innerText = Math.floor(speed * 480) + " KM/H";
        document.getElementById('nitro-bar').style.width = nitro + "%";
        if(isNitro) { nitro -= 0.7; thruster.scale.set(4,4,4); camera.fov = 95; } else { if(nitro < 100) nitro += 0.4; thruster.scale.set(1,1,1); camera.fov = 75; }
        camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
}

// Controls
window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);
const bind = (id, k) => { const el = document.getElementById(id); el.ontouchstart = (e) => { e.preventDefault(); keys[k] = true; }; el.ontouchend = () => keys[k] = false; };
bind('btn-left', 'a'); bind('btn-right', 'd'); bind('btn-gas', 'w'); bind('btn-nitro', 'shift');

initWorld(); window.buildShip(); animate();
