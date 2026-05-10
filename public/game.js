// --- 1. CORE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000005);
scene.fog = new THREE.Fog(0x000005, 1, 1500);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const light = new THREE.PointLight(0x00ffff, 2, 1000);
scene.add(light);

// --- 2. ENVIRONMENT (Stars & Planets) ---
const starGeo = new THREE.BufferGeometry();
const starCoords = [];
for (let i = 0; i < 3000; i++) {
    starCoords.push((Math.random() - 0.5) * 3000, (Math.random() - 0.5) * 3000, (Math.random() - 0.5) * 3000);
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starCoords, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2 })));

const planet = new THREE.Mesh(
    new THREE.SphereGeometry(100, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xff4400, emissive: 0x220000 })
);
planet.position.set(400, 200, -800);
scene.add(planet);

// --- 3. THE TRACK ---
const trackPoints = [];
for (let i = 0; i <= 100; i++) {
    const t = (i / 100) * Math.PI * 2;
    const r = 200;
    const x = r * (2 + Math.cos(3 * t)) * Math.cos(2 * t);
    const y = r * (2 + Math.cos(3 * t)) * Math.sin(2 * t);
    const z = r * Math.sin(3 * t);
    trackPoints.push(new THREE.Vector3(x, y, z));
}
const curve = new THREE.CatmullRomCurve3(trackPoints);
curve.closed = true;

const tubeGeo = new THREE.TubeGeometry(curve, 200, 25, 12, true);
const tubeMat = new THREE.MeshStandardMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.2 });
const trackMesh = new THREE.Mesh(tubeGeo, tubeMat);
scene.add(trackMesh);

// --- 4. THE REALISTIC INTERCEPTOR ---
const shipGroup = new THREE.Group();

const fuselage = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.8, 5),
    new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.2 })
);
shipGroup.add(fuselage);

const cockpit = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 16, 16),
    new THREE.MeshPhongMaterial({ color: 0x00ffff, transparent: true, opacity: 0.7 })
);
cockpit.position.set(0, 0.4, 1);
shipGroup.add(cockpit);

const wings = new THREE.Mesh(
    new THREE.BoxGeometry(4, 0.2, 2), 
    new THREE.MeshStandardMaterial({ color: 0x555555 })
);
wings.position.z = -0.5;
shipGroup.add(wings);

const thruster = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 0.2, 16),
    new THREE.MeshBasicMaterial({ color: 0x00ffff })
);
thruster.rotation.x = Math.PI / 2;
thruster.position.z = -2.5;
shipGroup.add(thruster);

scene.add(shipGroup);

// --- 5. CONTROLS & PHYSICS ---
let speed = 0, progress = 0, lateral = 0, drift = 0;
const keys = {};

window.onkeydown = (e) => keys[e.key] = true;
window.onkeyup = (e) => keys[e.key] = false;

function animate() {
    requestAnimationFrame(animate);

    // Speed
    if (keys['w'] || keys['ArrowUp']) speed += 0.005;
    else if (keys['s'] || keys['ArrowDown']) speed -= 0.01;
    else speed *= 0.98;
    speed = Math.max(0, Math.min(speed, 1.5));

    // Centrifugal Drift (Track curvature pull)
    const curveIntensity = Math.sin(progress * Math.PI * 10) * 0.15; 
    drift += curveIntensity * speed;
    drift *= 0.95; 

    // Steering
    if (keys['a'] || keys['ArrowLeft']) lateral -= 0.4;
    if (keys['d'] || keys['ArrowRight']) lateral += 0.4;
    
    // Wall Collision Logic
    let totalPos = lateral + drift;
    if (totalPos > 18 || totalPos < -18) {
        speed *= 0.95; 
        lateral *= -0.8; 
        drift *= -1;
    }
    lateral = Math.max(-19, Math.min(lateral, 19));

    // Movement on track
    progress += speed * 0.0004;
    if (progress > 1) progress = 0;

    const pos = curve.getPointAt(progress);
    const tan = curve.getTangentAt(progress).normalize();
    
    shipGroup.position.copy(pos);
    shipGroup.lookAt(pos.clone().add(tan));
    shipGroup.translateX(lateral);
    
    // Position inside the tube floor
    const normalDir = new THREE.Vector3(0,0,0).sub(pos).normalize();
    shipGroup.position.add(normalDir.multiplyScalar(5));

    // Visuals (Banking & Thruster)
    const tilt = (keys['a']?-0.8:0) + (keys['d']?0.8:0) + (drift * 0.5);
    shipGroup.rotation.z = THREE.MathUtils.lerp(shipGroup.rotation.z, tilt, 0.1);
    thruster.scale.setScalar(1 + Math.random() * 0.2);

    // Camera with shake
    const camOffset = new THREE.Vector3(0, 6, -18);
    camOffset.applyQuaternion(shipGroup.quaternion);
    const shake = (Math.random() - 0.5) * (speed * 0.06);
    camera.position.copy(shipGroup.position.clone().add(camOffset).addScalar(shake));
    camera.lookAt(shipGroup.position.clone().add(tan.multiplyScalar(10)));

    const speedUI = document.getElementById('speed-display');
    if(speedUI) speedUI.innerText = Math.floor(speed * 450);

    renderer.render(scene, camera);
}

window.onresize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};

animate();
