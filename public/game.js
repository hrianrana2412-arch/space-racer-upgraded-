const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

let speed = 0, progress = 0, lateral = 0, nitro = 100, gameActive = false;
let shipSettings = { color: "#00ffff", model: 'Interceptor' };
let curve, tubeMesh, shipBody, thruster;
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

window.buildShip = function() {
    shipGroup.clear();
    shipGroup.scale.set(3, 3, 3);
    const mat = new THREE.MeshPhongMaterial({ 
        color: new THREE.Color(shipSettings.color), 
        specular: 0xffffff, shininess: 120,
        emissive: new THREE.Color(shipSettings.color), emissiveIntensity: 0.4
    });
    shipBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 4), mat);
    shipGroup.add(shipBody);

    if (shipSettings.model === 'Speeder') {
        const n = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.5, 4), mat); n.rotation.x = 1.57; n.position.z = 2.8; shipGroup.add(n);
    } else if (shipSettings.model === 'Tanker') {
        const s = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.2, 0.6), mat); s.position.z = 1.5; shipGroup.add(s);
    } else {
        const w = new THREE.Mesh(new THREE.BoxGeometry(6, 0.1, 2), mat); shipGroup.add(w);
    }
    thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.5), new THREE.MeshBasicMaterial({color: 0x00ffff}));
    thruster.rotation.x = 1.57; thruster.position.z = -2.2; shipGroup.add(thruster);
    scene.add(shipGroup);
}

window.generateTrack = function() {
    if(tubeMesh) scene.remove(tubeMesh);
    const pts = [];
    let r = 180;
    for (let i = 0; i <= 80; i++) {
        const t = (i / 80) * Math.PI * 2;
        pts.push(new THREE.Vector3(r*(2+Math.cos(3*t))*Math.cos(2*t), r*(2+Math.cos(3*t))*Math.sin(2*t), r*Math.sin(3*t)));
    }
    curve = new THREE.CatmullRomCurve3(pts);
    curve.closed = true;
    tubeMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 100, 70, 12, true), new THREE.MeshStandardMaterial({color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.3}));
    scene.add(tubeMesh);
}

// --- HARDENED CONTROLS ---
const bindBtn = (id, key) => {
    const el = document.getElementById(id);
    if(!el) return;

    const start = (e) => { e.preventDefault(); keys[key] = true; };
    const end = (e) => { e.preventDefault(); keys[key] = false; };

    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('touchend', end, { passive: false });
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', end);
    el.addEventListener('mouseleave', end);
};

window.startGame = () => {
    window.generateTrack();
    document.getElementById('menu-overlay').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    
    // Explicitly bind with lowercase keys
    bindBtn('btn-left', 'a'); 
    bindBtn('btn-right', 'd');
    bindBtn('btn-gas', 'w'); 
    bindBtn('btn-nitro', 'shift');
    
    gameActive = true;
};

function animate() {
    requestAnimationFrame(animate);
    
    if(!gameActive) {
        shipGroup.rotation.y += 0.01;
        camera.position.set(15, 10, 35); camera.lookAt(0,0,0);
        renderer.render(scene, camera);
        return;
    }

    if(!curve) return;

    // Movement Logic
    const isNitro = (keys['shift'] || keys['Shift']) && nitro > 0;
    speed = Math.max(0, Math.min(speed + (keys['w'] ? 0.02 : -0.02), isNitro ? 4.5 : 2.5));
    
    // Steering Logic (Direct Offset)
    if (keys['a']) lateral -= 2.5;
    if (keys['d']) lateral += 2.5;
    lateral = Math.max(-65, Math.min(65, lateral));

    progress += speed * 0.0005;
    if(progress > 1) progress = 0;

    const p = curve.getPointAt(progress % 1);
    const look = curve.getPointAt((progress + 0.01) % 1);
    
    if(p && look) {
        shipGroup.position.copy(p);
        shipGroup.lookAt(look);

        // This is the new stable steering method
        const right = new THREE.Vector3().setFromMatrixColumn(shipGroup.matrix, 0);
        shipGroup.position.addScaledVector(right, lateral);
        
        // Push ship down into the tube
        const down = new THREE.Vector3(0, -1, 0).applyQuaternion(shipGroup.quaternion);
        shipGroup.position.addScaledVector(down, 30);

        // Camera follow
        const camOffset = new THREE.Vector3(0, 15, -40).applyQuaternion(shipGroup.quaternion);
        camera.position.copy(shipGroup.position).add(camOffset);
        camera.lookAt(shipGroup.position);
    }
    
    // UI Updates
    document.getElementById('speed-display').innerText = Math.floor(speed * 480) + " KM/H";
    const nBar = document.getElementById('nitro-bar');
    if(nBar) nBar.style.width = nitro + "%";
    
    if(isNitro) {
        nitro -= 0.8; 
        if(thruster) thruster.scale.set(2.5, 2.5, 2.5);
    } else {
        if(nitro < 100) nitro += 0.25; 
        if(thruster) thruster.scale.set(1, 1, 1);
    }

    renderer.render(scene, camera);
}

// PC Support
window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

document.getElementById('shipColor').oninput = (e) => { shipSettings.color = e.target.value; window.buildShip(); };
window.setShipModel = (m) => { shipSettings.model = m; window.buildShip(); };

initWorld(); window.buildShip(); animate();
