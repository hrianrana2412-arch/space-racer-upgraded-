const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

let speed = 0, progress = 0, lateral = 0, nitro = 100, gameActive = false, winSequence = false;
let currentTrackId = 1;
let shipSettings = { color: "#00ffff", model: 'Interceptor' };
let curve, tubeMesh, shipBody, thruster;
let aiBots = [];
const shipGroup = new THREE.Group();
const keys = {};

function initWorld() {
    scene.clear();
    scene.background = new THREE.Color(0x000008);
    scene.add(new THREE.AmbientLight(0xffffff, 1.8)); // HEAVILY BOOSTED LIGHT
    const sun = new THREE.PointLight(0xffffff, 3, 5000);
    sun.position.set(0, 300, 100);
    scene.add(sun);
}

window.setShip = (m) => { shipSettings.model = m; window.buildShip(); };
window.buildShip = function() {
    shipGroup.clear(); shipGroup.scale.set(3, 3, 3);
    const mat = new THREE.MeshPhongMaterial({ color: new THREE.Color(shipSettings.color), specular: 0xffffff, shininess: 120, emissive: new THREE.Color(shipSettings.color), emissiveIntensity: 0.4 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 4), mat); shipGroup.add(hull);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), new THREE.MeshPhongMaterial({color: 0x000000}));
    glass.position.set(0, 0.3, 0.8); glass.scale.set(1, 0.5, 2); shipGroup.add(glass);
    
    if (shipSettings.model === 'Speeder') {
        const n = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3, 4), mat); n.rotation.x = 1.57; n.position.z = 2.5; shipGroup.add(n);
    } else if (shipSettings.model === 'Vanguard') {
        const wL = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 2), mat); wL.position.set(1.5, 0, -0.5); shipGroup.add(wL);
        const wR = wL.clone(); wR.position.x = -1.5; shipGroup.add(wR);
    } else if (shipSettings.model === 'Zenith') {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2, 1.5), mat); fin.position.z = -1; shipGroup.add(fin);
    }
    thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 0.6), new THREE.MeshBasicMaterial({color: 0x00ffff}));
    thruster.rotation.x = 1.57; thruster.position.z = -2.1; shipGroup.add(thruster);
    scene.add(shipGroup);
}

const trackList = document.getElementById('track-list');
for(let i=1; i<=10; i++) {
    const btn = document.createElement('button'); btn.innerText = `SECTOR ${i}`;
    btn.onclick = () => { currentTrackId = i; window.generateTrack(i); };
    trackList.appendChild(btn);
}

window.generateTrack = function(id = 1) {
    if(tubeMesh) scene.remove(tubeMesh);
    const pts = []; let r = 180 + (id * 15);
    for (let i = 0; i <= 80; i++) {
        const t = (i / 80) * Math.PI * 2;
        pts.push(new THREE.Vector3(r*(2+Math.cos(3*t))*Math.cos(2*t), r*(2+Math.cos(3*t))*Math.sin(2*t), r*Math.sin(3*t)));
    }
    curve = new THREE.CatmullRomCurve3(pts); curve.closed = true;
    tubeMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 100, 75, 16, true), new THREE.MeshStandardMaterial({color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.25}));
    scene.add(tubeMesh);
}

window.startGame = () => {
    if(!curve) window.generateTrack(1);
    document.getElementById('menu-overlay').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    aiBots.forEach(b => scene.remove(b.mesh)); aiBots = [];
    for(let i=0; i<4; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(4, 1.5, 8), new THREE.MeshStandardMaterial({color: 0xff0044, emissive: 0xff0000}));
        scene.add(b); aiBots.push({ mesh: b, progress: Math.random()*0.1, lat: (Math.random()-0.5)*100 });
    }
    gameActive = true;
};

function animate() {
    requestAnimationFrame(animate);
    if(winSequence) {
        shipGroup.rotation.y += 0.05;
        camera.position.x += 1; camera.lookAt(shipGroup.position);
    } else if(!gameActive) {
        shipGroup.rotation.y += 0.01;
        camera.position.set(15, 10, 35); camera.lookAt(0,0,0);
    } else {
        const isNitro = keys['shift'] && nitro > 0;
        speed = Math.max(0, Math.min(speed + (keys['w'] ? 0.025 : -0.015), isNitro ? 5.5 : 2.8));
        if (keys['a']) lateral += 2.8; if (keys['d']) lateral -= 2.8;
        lateral = Math.max(-65, Math.min(65, lateral)); // LOCK TO TRACK
        progress += speed * 0.0004;

        if(progress > 0.99) { 
            winSequence = true; gameActive = false; 
            document.getElementById('win-screen').classList.remove('hidden'); 
        }

        const p = curve.getPointAt(progress % 1);
        shipGroup.position.copy(p);
        shipGroup.lookAt(curve.getPointAt((progress + 0.01) % 1));
        const right = new THREE.Vector3().setFromMatrixColumn(shipGroup.matrix, 0);
        shipGroup.position.addScaledVector(right, -lateral);
        shipGroup.position.addScaledVector(new THREE.Vector3(0,-1,0).applyQuaternion(shipGroup.quaternion), 35);

        aiBots.forEach(bot => {
            bot.progress += 0.00035;
            bot.mesh.position.copy(curve.getPointAt(bot.progress % 1));
            bot.mesh.lookAt(curve.getPointAt((bot.progress + 0.01) % 1));
            const bRight = new THREE.Vector3().setFromMatrixColumn(bot.mesh.matrix, 0);
            bot.mesh.position.addScaledVector(bRight, bot.lat);
            bot.mesh.position.addScaledVector(new THREE.Vector3(0,-1,0).applyQuaternion(bot.mesh.quaternion), 35);
        });

        camera.position.lerp(new THREE.Vector3(0,20,-50).applyQuaternion(shipGroup.quaternion).add(shipGroup.position), 0.1);
        camera.lookAt(shipGroup.position);
        document.getElementById('speed-display').innerText = Math.floor(speed * 480) + " KM/H";
        document.getElementById('nitro-bar').style.width = nitro + "%";
        if(isNitro) { nitro -= 0.8; thruster.scale.set(4,4,4); camera.fov = 90; } else { if(nitro < 100) nitro += 0.4; thruster.scale.set(1,1,1); camera.fov = 75; }
        camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
}

window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);
const bindBtn = (id, k) => { 
    const el = document.getElementById(id); 
    el.ontouchstart = (e) => { e.preventDefault(); keys[k] = true; }; 
    el.ontouchend = () => keys[k] = false; 
};
bindBtn('btn-left', 'a'); bindBtn('btn-right', 'd'); bindBtn('btn-gas', 'w'); bindBtn('btn-nitro', 'shift');
initWorld(); window.buildShip(); animate();
