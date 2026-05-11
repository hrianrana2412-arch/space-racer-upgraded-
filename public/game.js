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
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(50, 100, 50);
    scene.add(sun);
}

// --- REALISTIC SHIP DESIGNS ---
window.setShip = (m) => { shipSettings.model = m; window.buildShip(); };
window.buildShip = function() {
    shipGroup.clear();
    shipGroup.scale.set(3, 3, 3);
    const mat = new THREE.MeshPhongMaterial({ color: new THREE.Color(shipSettings.color), specular: 0x555555, shininess: 100 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 1, roughness: 0.2 });

    // Cockpit Base
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 3), mat);
    shipGroup.add(hull);

    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), new THREE.MeshPhongMaterial({color: 0x000000, transparent: true, opacity: 0.7}));
    glass.position.set(0, 0.3, 0.8); glass.scale.set(1, 0.5, 2);
    shipGroup.add(glass);

    if (shipSettings.model === 'Interceptor') {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(5, 0.1, 1.5), mat); wing.position.z = -0.5; shipGroup.add(wing);
        const engine1 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.5), metalMat); engine1.rotation.x = 1.57; engine1.position.set(1.5, 0, -1); shipGroup.add(engine1);
        const engine2 = engine1.clone(); engine2.position.x = -1.5; shipGroup.add(engine2);
    } else if (shipSettings.model === 'Speeder') {
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3, 4), mat); nose.rotation.x = 1.57; nose.position.z = 2.5; shipGroup.add(nose);
        const finL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 1), mat); finL.position.set(0.8, 0, -1); finL.rotation.z = 0.5; shipGroup.add(finL);
        const finR = finL.clone(); finR.position.x = -0.8; finR.rotation.z = -0.5; shipGroup.add(finR);
    } else if (shipSettings.model === 'Tanker') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(3, 1.5, 4), mat); shipGroup.add(body);
        const shield = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 0.2), mat); shield.position.z = 1.5; shipGroup.add(shield);
    } else {
        // Default Vanguard/Image style
        const wingL = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 2), mat); wingL.position.set(1.5, 0, -0.5); wingL.rotation.y = 0.3; shipGroup.add(wingL);
        const wingR = wingL.clone(); wingR.position.x = -1.5; wingR.rotation.y = -0.3; shipGroup.add(wingR);
    }
    
    thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 0.5), new THREE.MeshBasicMaterial({color: 0x00ffff}));
    thruster.rotation.x = 1.57; thruster.position.z = -1.8; shipGroup.add(thruster);
    scene.add(shipGroup);
}

const trackList = document.getElementById('track-list');
for(let i=1; i<=10; i++) {
    const btn = document.createElement('button'); btn.innerText = `Sect-${i}`;
    btn.onclick = () => { window.generateTrack(i); };
    if(trackList) trackList.appendChild(btn);
}

window.generateTrack = function(id = 1) {
    if(tubeMesh) scene.remove(tubeMesh);
    const pts = []; let r = 150 + (id * 10);
    for (let i = 0; i <= 80; i++) {
        const t = (i / 80) * Math.PI * 2;
        pts.push(new THREE.Vector3(r*(2+Math.cos(3*t))*Math.cos(2*t), r*(2+Math.cos(3*t))*Math.sin(2*t), r*Math.sin(3*t)));
    }
    curve = new THREE.CatmullRomCurve3(pts); curve.closed = true;
    tubeMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 100, 70, 12, true), new THREE.MeshStandardMaterial({color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.2}));
    scene.add(tubeMesh);
}

const bindBtn = (id, key) => {
    const el = document.getElementById(id); if(!el) return;
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
    gameActive = true;
};

function animate() {
    requestAnimationFrame(animate);
    if(!gameActive) {
        shipGroup.rotation.y += 0.01;
        camera.position.set(15, 10, 35); camera.lookAt(0,0,0);
    } else {
        const isNitro = keys['shift'] && nitro > 0;
        speed = Math.max(0, Math.min(speed + (keys['w'] ? 0.02 : -0.015), isNitro ? 5.0 : 2.5));
        
        // FIXED STEERING: Swapped axes (+ to -) to fix inversion
        let tilt = 0;
        if (keys['a']) { lateral += 2.5; tilt = 0.5; } // Goes Right when A/Left pressed
        if (keys['d']) { lateral -= 2.5; tilt = -0.5; } // Goes Left when D/Right pressed
        lateral = Math.max(-65, Math.min(65, lateral));

        progress += speed * 0.0004;
        const p = curve.getPointAt(progress % 1);
        const look = curve.getPointAt((progress + 0.01) % 1);
        
        if(p && look) {
            shipGroup.position.copy(p);
            shipGroup.lookAt(look);
            
            // Apply lean/tilt for realism
            shipGroup.rotation.z = tilt;

            const right = new THREE.Vector3().setFromMatrixColumn(shipGroup.matrix, 0);
            shipGroup.position.addScaledVector(right, -lateral); // Negative applied here to fix inversion
            const down = new THREE.Vector3(0, -1, 0).applyQuaternion(shipGroup.quaternion);
            shipGroup.position.addScaledVector(down, 35);

            camera.position.lerp(new THREE.Vector3(0,18,-45).applyQuaternion(shipGroup.quaternion).add(shipGroup.position), 0.1);
            camera.lookAt(shipGroup.position);
        }
        
        document.getElementById('speed-display').innerText = Math.floor(speed * 480) + " KM/H";
        const nBar = document.getElementById('nitro-bar');
        if(nBar) nBar.style.width = nitro + "%";
        if(isNitro) { nitro -= 0.8; thruster.scale.set(3,3,3); } else { if(nitro < 100) nitro += 0.3; thruster.scale.set(1,1,1); }
    }
    renderer.render(scene, camera);
}

window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);
bindBtn('btn-left', 'a'); bindBtn('btn-right', 'd'); bindBtn('btn-gas', 'w'); bindBtn('btn-nitro', 'shift');

initWorld(); window.buildShip(); animate();
