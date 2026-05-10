// --- 1. ENGINE ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

let speed = 0, progress = 0, lateral = 0, nitro = 100, gameActive = false, isMultiplayer = false;
let currentTrack = 'Neon Circuit';
let shipSettings = { color: "#00ffff", model: 'Interceptor' };
let curve, tubeMesh, shipBody, thruster, trackOutline;
const shipGroup = new THREE.Group();
const keys = {};

// --- 2. BRIGHTER WORLD ---
function initWorld() {
    scene.clear();
    scene.background = new THREE.Color(0x000008);
    
    // Add multiple strong lights to fix darkness
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const sun = new THREE.PointLight(0xffffff, 2, 5000);
    sun.position.set(0, 500, 500);
    scene.add(sun);

    // Glowing Stars
    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for(let i=0; i<12000; i++) starPos.push((Math.random()-0.5)*5000, (Math.random()-0.5)*5000, (Math.random()-0.5)*5000);
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({color: 0xffffff, size: 1.5, transparent: true, opacity: 0.8})));
}

// --- 3. CUSTOMIZATION (More Parts) ---
window.buildShip = function() {
    shipGroup.clear();
    shipGroup.scale.set(2.8, 2.8, 2.8);
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(shipSettings.color), metalness: 0.9, roughness: 0.1 });
    
    shipBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 4), mat);
    shipGroup.add(shipBody);

    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), new THREE.MeshPhongMaterial({color: 0x00ffff, emissive: 0x00ffff, emissiveIntensity: 0.5}));
    cockpit.position.set(0, 0.3, 0.8);
    shipGroup.add(cockpit);

    if (shipSettings.model === 'Speeder') {
        const n = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.5, 4), mat); n.rotation.x = 1.57; n.position.z = 2.8; shipGroup.add(n);
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 1), mat); fin.position.set(0, 0.6, -1); shipGroup.add(fin);
    } else if (shipSettings.model === 'Tanker') {
        const s = new THREE.Mesh(new THREE.BoxGeometry(4, 2.5, 0.8), mat); s.position.z = 1.5; shipGroup.add(s);
        const lSide = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 4), mat); lSide.position.x = -1.8; shipGroup.add(lSide);
        const rSide = lSide.clone(); rSide.position.x = 1.8; shipGroup.add(rSide);
    } else {
        const w = new THREE.Mesh(new THREE.BoxGeometry(6, 0.1, 2.5), mat); shipGroup.add(w);
        const tipL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 1), mat); tipL.position.set(-2.9, 0.3, 0); shipGroup.add(tipL);
        const tipR = tipL.clone(); tipR.position.x = 2.9; shipGroup.add(tipR);
    }
    
    thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 0.6), new THREE.MeshBasicMaterial({color: 0xff00ff}));
    thruster.rotation.x = 1.57; thruster.position.z = -2.3; shipGroup.add(thruster);
    scene.add(shipGroup);
}

// --- 4. WIDER TRACKS & OUTLINE ---
window.selectTrack = (name) => { currentTrack = name; window.generateTrack(); };

window.generateTrack = function() {
    if(tubeMesh) scene.remove(tubeMesh);
    if(trackOutline) scene.remove(trackOutline);

    const pts = [];
    let r = 180, loops = 3;
    if(currentTrack === 'Hyper Loop') { r = 100; loops = 1; }
    if(currentTrack === 'Deep Void') { r = 250; loops = 6; }

    for (let i = 0; i <= 100; i++) {
        const t = (i / 100) * Math.PI * 2;
        pts.push(new THREE.Vector3(r*(2+Math.cos(loops*t))*Math.cos(2*t), r*(2+Math.cos(loops*t))*Math.sin(2*t), r*Math.sin(loops*t)));
    }
    curve = new THREE.CatmullRomCurve3(pts);
    curve.closed = true;

    // The Wider Tube (Radius 60!)
    const tubeGeo = new THREE.TubeGeometry(curve, 100, 60, 16, true);
    tubeMesh = new THREE.Mesh(tubeGeo, new THREE.MeshStandardMaterial({color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.08}));
    scene.add(tubeMesh);

    // THE OUTLINE PREVIEW
    const points = curve.getPoints(200);
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    trackOutline = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({color: 0xff00ff, linewidth: 2}));
    scene.add(trackOutline);
}

// --- 5. GAME LOGIC ---
window.setShipModel = (m) => { shipSettings.model = m; window.buildShip(); };
window.toggleMultiplayer = () => {
    isMultiplayer = !isMultiplayer;
    document.getElementById('multi-btn').innerText = isMultiplayer ? "MODE: MULTIPLAYER" : "MODE: OFFLINE";
};

document.getElementById('shipColor').oninput = (e) => { shipSettings.color = e.target.value; window.buildShip(); };

window.startGame = () => {
    document.getElementById('menu-overlay').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    progress = 0; speed = 0; gameActive = true;
};

function animate() {
    requestAnimationFrame(animate);
    if(!gameActive) {
        shipGroup.rotation.y += 0.01;
        trackOutline.rotation.z += 0.003;
        // Moved camera much closer (X: 15, Y: 10, Z: 35)
        camera.position.set(15, 10, 35); 
        camera.lookAt(0, 0, 0);
    } else {
        const isNitro = keys['Shift'] && nitro > 0;
        speed = Math.max(0, Math.min(speed + (keys['w']?0.01:-0.015), isNitro ? 3.8 : 1.9));
        if (keys['a']) lateral -= 1.2; if (keys['d']) lateral += 1.2;
        lateral = Math.max(-55, Math.min(55));

        progress += speed * 0.0005;
        if(progress > 1) { 
            document.getElementById('victory-screen').classList.remove('hidden');
            gameActive = false;
            setTimeout(() => location.reload(), 6000);
        }

        const p = curve.getPointAt(progress);
        shipGroup.position.copy(p);
        shipGroup.lookAt(curve.getPointAt((progress + 0.01) % 1));
        shipGroup.translateX(lateral); shipGroup.translateY(-25);

        const camT = new THREE.Vector3(0,12,-30).applyQuaternion(shipGroup.quaternion).add(shipGroup.position);
        camera.position.lerp(camT, 0.1);
        camera.lookAt(shipGroup.position);
        document.getElementById('speed-display').innerText = Math.floor(speed * 500) + " KM/H";
    }
    renderer.render(scene, camera);
}

initWorld(); window.generateTrack(); window.buildShip(); animate();
window.onkeydown=(e)=>keys[e.key]=true; window.onkeyup=(e)=>keys[e.key]=false;
