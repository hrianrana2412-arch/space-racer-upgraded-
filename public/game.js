// --- 1. CORE ENGINE ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

let speed = 0, progress = 0, lateral = 0, nitro = 100, gameActive = false, isMultiplayer = false;
let shipSettings = { color: "#ff00ff", model: 'Interceptor' };
let curve, tubeGeo, shipBody, thruster;
const shipGroup = new THREE.Group();
const keys = {};

// --- 2. THE UNIVERSE ---
function initWorld() {
    scene.clear();
    scene.background = new THREE.Color(0x000005);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(10, 10, 10);
    scene.add(sun);

    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for(let i=0; i<10000; i++) starPos.push((Math.random()-0.5)*4000, (Math.random()-0.5)*4000, (Math.random()-0.5)*4000);
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({color: 0xffffff, size: 0.9})));
}

// --- 3. SHIP GARAGE ---
window.buildShip = function() {
    shipGroup.clear();
    const mat = new THREE.MeshStandardMaterial({ 
        color: new THREE.Color(shipSettings.color), 
        metalness: 0.8, 
        roughness: 0.2 
    });
    
    shipBody = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 4), mat);
    shipGroup.add(shipBody);

    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), new THREE.MeshPhongMaterial({color: 0x00ffff, transparent:true, opacity:0.5}));
    cockpit.position.set(0, 0.3, 1);
    shipGroup.add(cockpit);

    if(shipSettings.model === 'Interceptor') {
        const wings = new THREE.Mesh(new THREE.BoxGeometry(5, 0.1, 2), mat);
        shipGroup.add(wings);
    } else if (shipSettings.model === 'Speeder') {
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.6, 3, 4), mat);
        nose.rotation.x = Math.PI / 2; nose.position.set(0, 0, 2.5);
        shipGroup.add(nose);
    } else if (shipSettings.model === 'Tanker') {
        const shield = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 0.5), mat);
        shield.position.set(0, 0, 1.8);
        shipGroup.add(shield);
    }

    thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 0.6), new THREE.MeshBasicMaterial({color: 0x00ffff}));
    thruster.rotation.x = Math.PI/2; thruster.position.set(0, 0, -2.1);
    shipGroup.add(thruster);
    
    if(!scene.children.includes(shipGroup)) scene.add(shipGroup);
}

// --- 4. BUTTON HOOKS (Ensuring HTML can see these) ---
window.setShipModel = function(m) { 
    shipSettings.model = m; 
    window.buildShip(); 
};

window.toggleMultiplayer = function() {
    isMultiplayer = !isMultiplayer;
    const btn = document.getElementById('multi-btn');
    if(btn) btn.innerText = isMultiplayer ? "MODE: MULTIPLAYER" : "MODE: OFFLINE";
};

document.getElementById('shipColor').oninput = (e) => { 
    shipSettings.color = e.target.value; 
    window.buildShip(); 
};

window.startGame = function(trackType) {
    initWorld();
    const r = (trackType === 'Asteroid Run') ? 240 : 150;
    const pts = [];
    for (let i = 0; i <= 100; i++) {
        const t = (i / 100) * Math.PI * 2;
        pts.push(new THREE.Vector3(r*(2+Math.cos(3*t))*Math.cos(2*t), r*(2+Math.cos(3*t))*Math.sin(2*t), r*Math.sin(3*t)));
    }
    curve = new THREE.CatmullRomCurve3(pts);
    curve.closed = true;
    tubeGeo = new THREE.TubeGeometry(curve, 150, 25, 12, true);
    scene.add(new THREE.Mesh(tubeGeo, new THREE.MeshStandardMaterial({color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.15})));
    
    window.buildShip();
    document.getElementById('menu-overlay').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    gameActive = true;
};

// --- 5. ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);
    
    if(!gameActive) {
        shipGroup.rotation.y += 0.01;
        camera.position.set(0, 5, 12);
        camera.lookAt(0,0,0);
        renderer.render(scene, camera);
        return;
    }

    if(!tubeGeo || !tubeGeo.frenetFrames) return;

    // Control Physics
    const isNitro = keys['Shift'] && nitro > 0;
    if (keys['w'] || keys['ArrowUp']) speed += 0.007;
    else if (keys['s'] || keys['ArrowDown']) speed -= 0.015;
    else speed *= 0.985;
    speed = Math.max(0, Math.min(speed, isNitro ? 2.8 : 1.4));

    if (keys['a'] || keys['ArrowLeft']) lateral -= 0.5;
    if (keys['d'] || keys['ArrowRight']) lateral += 0.5;
    lateral = Math.max(-18, Math.min(lateral, 18));

    // Nitro Camera Warp
    if(isNitro) { 
        nitro -= 0.7; thruster.material.color.setHex(0xff00ff); 
        camera.fov = THREE.MathUtils.lerp(camera.fov, 95, 0.1);
    } else {
        if(nitro < 100) nitro += 0.25; thruster.material.color.setHex(0x00ffff);
        camera.fov = THREE.MathUtils.lerp(camera.fov, 75, 0.1);
    }
    camera.updateProjectionMatrix();

    // Movement
    progress += speed * 0.0004;
    if(progress > 1) progress = 0;

    const pos = curve.getPointAt(progress);
    const tan = curve.getTangentAt(progress).normalize();
    const frames = tubeGeo.frenetFrames;
    const index = Math.floor(progress * (frames.normals.length - 1));
    
    shipGroup.position.copy(pos)
        .add(frames.binormals[index].clone().multiplyScalar(lateral))
        .add(frames.normals[index].clone().multiplyScalar(15));
    
    shipGroup.lookAt(pos.clone().add(tan));
    shipBody.rotation.z = THREE.MathUtils.lerp(shipBody.rotation.z, (keys['a']?-0.8:0)+(keys['d']?0.8:0), 0.1);

    // Dynamic Camera Follow
    const camOff = new THREE.Vector3(0, 7, -18).applyQuaternion(shipGroup.quaternion);
    camera.position.copy(shipGroup.position.clone().add(camOff));
    camera.lookAt(shipGroup.position.clone().add(tan.multiplyScalar(10)));

    document.getElementById('speed-display').innerText = Math.floor(speed * 420);
    document.getElementById('nitro-bar').style.width = nitro + '%';
    renderer.render(scene, camera);
}

window.onkeydown = (e) => keys[e.key] = true;
window.onkeyup = (e) => keys[e.key] = false;

window.onresize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};

initWorld(); 
window.buildShip(); 
animate();
