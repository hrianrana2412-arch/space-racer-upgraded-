const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 40000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('game-container').appendChild(renderer.domElement);

let speed = 0, progress = 0, lateral = 0, nitro = 100, gameActive = false;
let shipSettings = { model: 'Vanguard' };
let curve, tubeMesh, shipBody, thruster;
const shipGroup = new THREE.Group();
const keys = {};

function initWorld() {
    scene.clear();
    scene.background = new THREE.Color(0x000008);
    scene.fog = new THREE.FogExp2(0x000008, 0.00006);
    scene.add(new THREE.AmbientLight(0xffffff, 1.5)); 
    
    const pLight = new THREE.PointLight(0x00ffff, 6, 3000);
    pLight.position.set(0, 200, 0); scene.add(pLight);

    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for(let i=0; i<15000; i++) starPos.push((Math.random()-0.5)*25000, (Math.random()-0.5)*25000, (Math.random()-0.5)*25000);
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({color: 0xffffff, size: 4})));
}

window.setShip = (m) => { shipSettings.model = m; window.buildShip(); };
window.buildShip = function() {
    shipGroup.clear(); shipGroup.scale.set(3, 3, 3);
    const mat = new THREE.MeshStandardMaterial({ color: 0x00ffff, metalness: 0.9, roughness: 0.05, emissive: 0x00ffff, emissiveIntensity: 0.6 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, 4.8), mat); shipGroup.add(hull);

    if (shipSettings.model === 'Zenith') {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.2, 2), mat); fin.position.z = -1.5; shipGroup.add(fin);
    } else if (shipSettings.model === 'Phantom') {
        const r1 = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.15, 12, 40), mat); r1.rotation.y = 1.57; shipGroup.add(r1);
    } else {
        const wL = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.15, 2.8), mat); wL.position.set(2.2, 0, -0.5); shipGroup.add(wL);
        const wR = wL.clone(); wR.position.x = -2.2; shipGroup.add(wR);
    }
    
    thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 1), new THREE.MeshBasicMaterial({color: 0x00ffff}));
    thruster.rotation.x = 1.57; thruster.position.z = -2.8; shipGroup.add(thruster);
    scene.add(shipGroup);
}

window.generateTrack = function() {
    if(tubeMesh) scene.remove(tubeMesh);
    const pts = []; let r = 500;
    for (let i = 0; i <= 100; i++) {
        const t = (i / 100) * Math.PI * 2;
        pts.push(new THREE.Vector3(r*(2+Math.cos(3*t))*Math.cos(2*t), r*(2+Math.cos(3*t))*Math.sin(2*t), r*Math.sin(3*t)));
    }
    curve = new THREE.CatmullRomCurve3(pts); curve.closed = true;
    tubeMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 200, 90, 16, true), new THREE.MeshStandardMaterial({color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.1}));
    scene.add(tubeMesh);
}

function animate() {
    requestAnimationFrame(animate);
    if(!gameActive) {
        shipGroup.rotation.y += 0.02;
        camera.position.set(35, 25, 70); camera.lookAt(0,0,0);
    } else {
        const isNitro = keys['shift'] && nitro > 0;
        speed = Math.max(0, Math.min(speed + (keys['w'] ? 0.05 : -0.04), isNitro ? 8.5 : 4.2));
        if (keys['a']) lateral += 4.5; if (keys['d']) lateral -= 4.5;
        lateral = Math.max(-75, Math.min(75, lateral));
        progress += speed * 0.0005;

        const p = curve.getPointAt(progress % 1);
        const look = curve.getPointAt((progress + 0.01) % 1);
        if(p && look) {
            shipGroup.position.copy(p); shipGroup.lookAt(look);
            const right = new THREE.Vector3().setFromMatrixColumn(shipGroup.matrix, 0);
            shipGroup.position.addScaledVector(right, -lateral);
            const down = new THREE.Vector3(0, -1, 0).applyQuaternion(shipGroup.quaternion);
            shipGroup.position.addScaledVector(down, 48); 

            const targetCam = shipGroup.position.clone().add(new THREE.Vector3(0, 18, -55).applyQuaternion(shipGroup.quaternion));
            camera.position.lerp(targetCam, 0.12);
            camera.lookAt(shipGroup.position);
            
            if(isNitro) { camera.fov = 105; camera.position.x += (Math.random()-0.5) * 0.8; } else { camera.fov = 75; }
            camera.updateProjectionMatrix();
        }

        document.getElementById('speedo').innerHTML = Math.floor(speed * 540) + "<span>KM/H</span>";
        document.getElementById('nitro-fill').style.width = nitro + "%";
        if(isNitro) { nitro -= 0.9; thruster.scale.set(6,6,6); } 
        else { if(nitro < 100) nitro += 0.35; thruster.scale.set(1,1,1); }
    }
    renderer.render(scene, camera);
}

// BINDING LOGIC
function setupControls() {
    const bind = (id, k) => {
        const el = document.getElementById(id);
        if(!el) return console.warn("Waiting for " + id);
        el.onmousedown = el.ontouchstart = (e) => { e.preventDefault(); keys[k] = true; };
        el.onmouseup = el.onmouseleave = el.ontouchend = () => keys[k] = false;
    };

    const startBtn = document.getElementById('start-race-btn');
    if(startBtn) {
        startBtn.onclick = () => {
            document.getElementById('menu-overlay').classList.add('fade');
            setTimeout(() => {
                document.getElementById('menu-overlay').classList.add('hidden');
                document.getElementById('ui-layer').classList.remove('hidden');
                gameActive = true;
            }, 500);
        };
    }

    bind('l-btn', 'a'); bind('r-btn', 'd'); bind('g-btn', 'w'); bind('n-btn', 'shift');
}

window.onload = () => {
    initWorld(); window.generateTrack(); window.buildShip();
    
    // DELAY BINDING TO PREVENT NULL ERROR
    setTimeout(setupControls, 500);

    let w = 0; const f = document.getElementById('load-fill');
    const iv = setInterval(() => { 
        w += 5; if(f) f.style.width = w + '%'; 
        if(w >= 100) { 
            clearInterval(iv); document.getElementById('splash-screen').classList.add('fade');
            setTimeout(() => document.getElementById('splash-screen').classList.add('hidden'), 1000);
        } 
    }, 50);
};

window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);
animate();
