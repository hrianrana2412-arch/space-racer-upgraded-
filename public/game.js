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

function initWorld() {
    scene.clear();
    scene.background = new THREE.Color(0x000005);
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const sun = new THREE.PointLight(0xffffff, 4, 10000);
    sun.position.set(500, 500, 500);
    scene.add(sun);

    // Stars
    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for(let i=0; i<15000; i++) starPos.push((Math.random()-0.5)*10000, (Math.random()-0.5)*10000, (Math.random()-0.5)*10000);
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({color: 0xffffff, size: 2})));

    // Planets
    const colors = [0xff4400, 0x00aaff, 0x88ff00, 0xff00ff];
    for(let i=0; i<8; i++) {
        const pGeo = new THREE.SphereGeometry(150 + Math.random()*200, 32, 32);
        const pMat = new THREE.MeshPhongMaterial({color: colors[i%4], emissive: colors[i%4], emissiveIntensity: 0.2});
        const planet = new THREE.Mesh(pGeo, pMat);
        planet.position.set((Math.random()-0.5)*9000, (Math.random()-0.5)*9000, (Math.random()-0.5)*9000);
        scene.add(planet);
    }
}

window.setShip = (m) => { shipSettings.model = m; window.buildShip(); };
window.buildShip = function() {
    shipGroup.clear(); shipGroup.scale.set(3, 3, 3);
    const mat = new THREE.MeshPhongMaterial({ color: new THREE.Color(shipSettings.color), specular: 0xffffff, shininess: 100, emissive: new THREE.Color(shipSettings.color), emissiveIntensity: 0.3 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 4), mat); shipGroup.add(hull);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), new THREE.MeshPhongMaterial({color: 0x000000, transparent: true, opacity: 0.8}));
    glass.position.set(0, 0.3, 0.6); glass.scale.set(1, 0.5, 2); shipGroup.add(glass);
    
    if (shipSettings.model === 'Speeder') {
        const n = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3, 4), mat); n.rotation.x = 1.57; n.position.z = 2.5; shipGroup.add(n);
    } else if (shipSettings.model === 'Vanguard') {
        const wL = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 2), mat); wL.position.set(1.8, 0, -0.5); shipGroup.add(wingL);
        const wR = wL.clone(); wR.position.x = -1.8; shipGroup.add(wR);
    } else if (shipSettings.model === 'Zenith') {
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2, 2.5), mat); f.position.z = -1; shipGroup.add(f);
    } else if (shipSettings.model === 'Phantom') {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.1, 8, 30), mat); ring.rotation.y = 1.57; shipGroup.add(ring);
    } else if (shipSettings.model === 'Tanker') {
        const s = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2, 1), mat); shipGroup.add(s);
    } else {
        const w = new THREE.Mesh(new THREE.BoxGeometry(6, 0.1, 2), mat); shipGroup.add(w);
    }
    thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 0.6), new THREE.MeshBasicMaterial({color: 0x00ffff}));
    thruster.rotation.x = 1.57; thruster.position.z = -2.2; shipGroup.add(thruster);
    scene.add(shipGroup);
}

window.generateTrack = function(id = 1) {
    if(tubeMesh) scene.remove(tubeMesh);
    const pts = []; let r = 200 + (id * 25);
    for (let i = 0; i <= 100; i++) {
        const t = (i / 100) * Math.PI * 2;
        pts.push(new THREE.Vector3(r*(2+Math.cos(3*t))*Math.cos(2*t), r*(2+Math.cos(3*t))*Math.sin(2*t), r*Math.sin(3*t)));
    }
    curve = new THREE.CatmullRomCurve3(pts); curve.closed = true;
    tubeMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 100, 85, 16, true), new THREE.MeshStandardMaterial({color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.25}));
    scene.add(tubeMesh);
}

window.startGame = () => {
    if(!curve) window.generateTrack(1);
    document.getElementById('menu-overlay').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    aiBots.forEach(b => scene.remove(b.mesh)); aiBots = [];
    for(let i=0; i<5; i++) {
        const bM = new THREE.Mesh(new THREE.BoxGeometry(4, 1.5, 8), new THREE.MeshStandardMaterial({color: 0xff0044, emissive: 0xff0000, emissiveIntensity: 0.6}));
        scene.add(bM); aiBots.push({ mesh: bM, progress: Math.random()*0.1, lat: (Math.random()-0.5)*140 });
    }
    gameActive = true;
};

function animate() {
    requestAnimationFrame(animate);
    if(winSequence) {
        shipGroup.rotation.y += 0.1; camera.position.z += 2; camera.lookAt(shipGroup.position);
    } else if(!gameActive) {
        shipGroup.rotation.y += 0.01; camera.position.set(25, 15, 45); camera.lookAt(0,0,0);
    } else {
        const isNitro = keys['shift'] && nitro > 0;
        speed = Math.max(0, Math.min(speed + (keys['w'] ? 0.025 : -0.015), isNitro ? 6.5 : 3.2));
        let tilt = 0;
        if (keys['a']) { lateral += 3.2; tilt = 0.5; } 
        if (keys['d']) { lateral -= 3.2; tilt = -0.5; }
        lateral = Math.max(-75, Math.min(75, lateral));
        progress += speed * 0.0004;

        if(progress > 0.99) { winSequence = true; document.getElementById('win-screen').classList.remove('hidden'); }

        const p = curve.getPointAt(progress % 1);
        const look = curve.getPointAt((progress + 0.01) % 1);
        if(p && look) {
            shipGroup.position.copy(p); shipGroup.lookAt(look); shipGroup.rotation.z = tilt;
            const right = new THREE.Vector3().setFromMatrixColumn(shipGroup.matrix, 0);
            shipGroup.position.addScaledVector(right, -lateral);
            shipGroup.position.addScaledVector(new THREE.Vector3(0,-1,0).applyQuaternion(shipGroup.quaternion), 40);
            camera.position.lerp(new THREE.Vector3(0,25,-60).applyQuaternion(shipGroup.quaternion).add(shipGroup.position), 0.1);
            camera.lookAt(shipGroup.position);
        }

        aiBots.forEach(bot => {
            bot.progress += 0.00035;
            bot.mesh.position.copy(curve.getPointAt(bot.progress % 1));
            bot.mesh.lookAt(curve.getPointAt((bot.progress + 0.01) % 1));
            const bR = new THREE.Vector3().setFromMatrixColumn(bot.mesh.matrix, 0);
            bot.mesh.position.addScaledVector(bR, -bot.lat);
            bot.mesh.position.addScaledVector(new THREE.Vector3(0,-1,0).applyQuaternion(bot.mesh.quaternion), 40);
        });

        document.getElementById('speed-display').innerText = Math.floor(speed * 480) + " KM/H";
        document.getElementById('nitro-bar').style.width = nitro + "%";
        if(isNitro) { nitro -= 0.7; thruster.scale.set(4,4,4); camera.fov = 100; } else { if(nitro < 100) nitro += 0.4; thruster.scale.set(1,1,1); camera.fov = 75; }
        camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
}

// Controls
window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);
const bind = (id, k) => { 
    const el = document.getElementById(id); 
    el.addEventListener('touchstart', (e) => { e.preventDefault(); keys[k] = true; }, {passive:false}); 
    el.addEventListener('touchend', (e) => { e.preventDefault(); keys[k] = false; }, {passive:false}); 
};
bind('btn-left', 'a'); bind('btn-right', 'd'); bind('btn-gas', 'w'); bind('btn-nitro', 'shift');

// Splash Hide Logic
window.onload = () => {
    initWorld(); window.generateTrack(1); window.buildShip();
    let width = 0;
    const bar = document.getElementById('loading-progress');
    const interval = setInterval(() => {
        width += 10; bar.style.width = width + '%';
        if(width >= 100) {
            clearInterval(interval);
            document.getElementById('splash-screen').classList.add('fade-out');
            setTimeout(() => document.getElementById('splash-screen').style.display = 'none', 1000);
        }
    }, 100);
};
animate();
