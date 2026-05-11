const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

let speed = 0, progress = 0, lateral = 0, nitro = 100, gameActive = false;
let currentTrack = 'Neon Circuit';
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

window.selectTrack = (name) => { currentTrack = name; window.generateTrack(); };
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
    tubeMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 100, 65, 12, true), new THREE.MeshStandardMaterial({color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.3}));
    scene.add(tubeMesh);
}

const bindBtn = (id, key) => {
    const el = document.getElementById(id);
    if(!el) return;
    const press = (e) => { e.preventDefault(); keys[key] = true; if(navigator.vibrate) navigator.vibrate(15); };
    const release = (e) => { e.preventDefault(); keys[key] = false; };
    el.addEventListener('touchstart', press, { passive: false });
    el.addEventListener('touchend', release, { passive: false });
    el.addEventListener('mousedown', press);
    el.addEventListener('mouseup', release);
};

window.startGame = () => {
    document.getElementById('menu-overlay').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    if (navigator.vibrate) navigator.vibrate(50);
    const docElm = document.documentElement;
    if (docElm.requestFullscreen) docElm.requestFullscreen();

    bindBtn('btn-left', 'a'); bindBtn('btn-right', 'd');
    bindBtn('btn-gas', 'w'); bindBtn('btn-nitro', 'shift');
    gameActive = true;
};

function animate() {
    requestAnimationFrame(animate);
    if(!gameActive) {
        shipGroup.rotation.y += 0.01;
        camera.position.set(15, 10, 35); camera.lookAt(0,0,0);
    } else {
        const isNitro = (keys['shift'] || keys['Shift']) && nitro > 0;
        speed = Math.max(0, Math.min(speed + (keys['w'] || keys['arrowup'] ? 0.015 : -0.018), isNitro ? 4.2 : 2.2));
        
        if (keys['a'] || keys['arrowleft']) lateral -= 2.0;
        if (keys['d'] || keys['arrowright']) lateral += 2.0;
        lateral = Math.max(-60, Math.min(60));

        progress += speed * 0.0005;
        if(progress > 1) { 
            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
            location.reload(); 
        }

        const p = curve.getPointAt(progress);
        shipGroup.position.copy(p);
        shipGroup.lookAt(curve.getPointAt((progress + 0.01) % 1));
        shipGroup.translateX(lateral); shipGroup.translateY(-28);

        camera.position.lerp(new THREE.Vector3(0,14,-35).applyQuaternion(shipGroup.quaternion).add(shipGroup.position), 0.15);
        camera.lookAt(shipGroup.position);
        
        document.getElementById('speed-display').innerText = Math.floor(speed * 480) + " KM/H";
        document.getElementById('nitro-bar').style.width = nitro + "%";
        if(isNitro) { 
            nitro -= 0.6; 
            thruster.scale.set(2, 2, 2); 
            camera.fov = THREE.MathUtils.lerp(camera.fov, 90, 0.1);
        } else { 
            if(nitro < 100) nitro += 0.2; 
            thruster.scale.set(1, 1, 1); 
            camera.fov = THREE.MathUtils.lerp(camera.fov, 75, 0.1);
        }
        camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
}

window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

document.getElementById('shipColor').oninput = (e) => { shipSettings.color = e.target.value; window.buildShip(); };
window.setShipModel = (m) => { shipSettings.model = m; window.buildShip(); };

initWorld(); window.generateTrack(); window.buildShip(); animate();
