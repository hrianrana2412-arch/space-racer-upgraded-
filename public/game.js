const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 30000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('game-container').appendChild(renderer.domElement);

let speed = 0, progress = 0, lateral = 0, nitro = 100, gameActive = false;
let shipSettings = { model: 'Vanguard' };
let curve, tubeMesh, shipBody, thruster;
let bots = [];
const shipGroup = new THREE.Group();
const keys = {};

function initWorld() {
    scene.clear();
    scene.background = new THREE.Color(0x000005);
    scene.add(new THREE.AmbientLight(0xffffff, 1.8)); 
    const pLight = new THREE.PointLight(0xffffff, 3, 10000);
    pLight.position.set(200, 500, 200); scene.add(pLight);

    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for(let i=0; i<10000; i++) starPos.push((Math.random()-0.5)*15000, (Math.random()-0.5)*15000, (Math.random()-0.5)*15000);
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({color: 0xffffff, size: 2.5})));
}

window.setShip = (m) => { shipSettings.model = m; window.buildShip(); };
window.buildShip = function() {
    shipGroup.clear(); shipGroup.scale.set(3, 3, 3);
    const mat = new THREE.MeshPhongMaterial({ color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.4 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 4), mat); shipGroup.add(hull);
    
    if (shipSettings.model === 'Zenith') {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 1.5), mat); fin.position.z = -1; shipGroup.add(fin);
    } else {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 2), mat); wing.position.set(0, 0, -0.5); shipGroup.add(wing);
    }
    
    thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 0.6), new THREE.MeshBasicMaterial({color: 0x00ffff}));
    thruster.rotation.x = 1.57; thruster.position.z = -2.2; shipGroup.add(thruster);
    scene.add(shipGroup);
}

window.generateTrack = function() {
    if(tubeMesh) scene.remove(tubeMesh);
    const pts = []; let r = 400;
    for (let i = 0; i <= 100; i++) {
        const t = (i / 100) * Math.PI * 2;
        pts.push(new THREE.Vector3(r*(2+Math.cos(3*t))*Math.cos(2*t), r*(2+Math.cos(3*t))*Math.sin(2*t), r*Math.sin(3*t)));
    }
    curve = new THREE.CatmullRomCurve3(pts); curve.closed = true;
    tubeMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 100, 85, 12, true), new THREE.MeshStandardMaterial({color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.25}));
    scene.add(tubeMesh);
}

function animate() {
    requestAnimationFrame(animate);
    if(!gameActive) {
        shipGroup.rotation.y += 0.01;
        camera.position.set(20, 15, 50); camera.lookAt(0,0,0);
    } else {
        const isNitro = keys['shift'] && nitro > 0;
        speed = Math.max(0, Math.min(speed + (keys['w'] ? 0.03 : -0.02), isNitro ? 7.5 : 3.8));
        
        if (keys['a']) lateral += 3.8; 
        if (keys['d']) lateral -= 3.8;
        lateral = Math.max(-75, Math.min(75, lateral));
        progress += speed * 0.00045;

        const p = curve.getPointAt(progress % 1);
        const look = curve.getPointAt((progress + 0.01) % 1);
        if(p && look) {
            shipGroup.position.copy(p); shipGroup.lookAt(look);
            const right = new THREE.Vector3().setFromMatrixColumn(shipGroup.matrix, 0);
            shipGroup.position.addScaledVector(right, -lateral);
            const down = new THREE.Vector3(0, -1, 0).applyQuaternion(shipGroup.quaternion);
            shipGroup.position.addScaledVector(down, 42); // STICK TO TRACK

            const camOffset = new THREE.Vector3(0, 14, -48).applyQuaternion(shipGroup.quaternion);
            camera.position.copy(shipGroup.position).add(camOffset);
            camera.lookAt(shipGroup.position);
        }

        document.getElementById('lb').innerHTML = "1. YOU<br>2. BOT-1<br>3. BOT-2";
        document.getElementById('speedo').innerHTML = Math.floor(speed * 480) + "<span>KM/H</span>";
        document.getElementById('nitro-fill').style.width = nitro + "%";
        if(isNitro) { nitro -= 0.7; thruster.scale.set(4,4,4); camera.fov = 98; } else { if(nitro < 100) nitro += 0.4; thruster.scale.set(1,1,1); camera.fov = 75; }
        camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
}

// THE FIX: Move everything inside window.onload
window.onload = () => {
    initWorld(); 
    window.generateTrack(); 
    window.buildShip();
    
    // Bind the start button
    document.getElementById('start-race-btn').onclick = () => {
        document.getElementById('menu-overlay').classList.add('hidden');
        document.getElementById('ui-layer').classList.remove('hidden');
        gameActive = true;
    };

    // Bind controls
    const bind = (id, k) => {
        const el = document.getElementById(id);
        if(!el) return;
        el.onmousedown = el.ontouchstart = (e) => { e.preventDefault(); keys[k] = true; };
        el.onmouseup = el.onmouseleave = el.ontouchend = () => keys[k] = false;
    };
    bind('l-btn', 'a'); bind('r-btn', 'd'); bind('g-btn', 'w'); bind('n-btn', 'shift');

    // Remove splash screen after 2 seconds
    let w = 0;
    const iv = setInterval(() => {
        w += 10; document.getElementById('load-fill').style.width = w + '%';
        if(w >= 100) { clearInterval(iv); document.getElementById('splash-screen').classList.add('fade'); }
    }, 100);
};

window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

animate();
