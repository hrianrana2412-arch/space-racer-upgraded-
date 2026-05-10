// --- 1. CORE SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000005);
scene.fog = new THREE.FogExp2(0x000005, 0.001);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const pointLight = new THREE.PointLight(0x00ffff, 2, 600);
scene.add(pointLight);

// --- 2. THE ENVIRONMENT (Stars & Planets) ---
function addSpaceDecor() {
    // Starfield
    const starGeo = new THREE.BufferGeometry();
    const starCoords = [];
    for (let i = 0; i < 5000; i++) {
        starCoords.push((Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 2000);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starCoords, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5 }));
    scene.add(stars);

    // Random Planets
    const colors = [0xff4400, 0x44ff00, 0x0044ff, 0xffff00];
    for(let i=0; i<8; i++) {
        const planet = new THREE.Mesh(
            new THREE.SphereGeometry(Math.random() * 50 + 20, 32, 32),
            new THREE.MeshStandardMaterial({ color: colors[i%4], roughness: 0.8 })
        );
        planet.position.set((Math.random()-0.5)*1000, (Math.random()-0.5)*1000, (Math.random()-0.5)*1000);
        scene.add(planet);
    }
}
addSpaceDecor();

// --- 3. THE TRACK ---
const curve = new THREE.TorusKnotCurve(160, 40, 2, 3);
const tubeGeo = new THREE.TubeGeometry(curve, 200, 20, 12, true);
const tubeMat = new THREE.MeshStandardMaterial({ 
    color: 0x111111, wireframe: true, emissive: 0x00ffff, emissiveIntensity: 0.3 
});
const trackMesh = new THREE.Mesh(tubeGeo, tubeMat);
scene.add(trackMesh);

// --- 4. PLAYER SHIP ---
const shipGroup = new THREE.Group();
const body = new THREE.Mesh(
    new THREE.ConeGeometry(2, 6, 4),
    new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0xff00ff, emissiveIntensity: 0.5 })
);
body.rotateX(Math.PI / 2);
shipGroup.add(body);
scene.add(shipGroup);

// --- 5. PHYSICS & INPUTS ---
let speed = 0, progress = 0, lateral = 0;
const keys = {};
window.onkeydown = (e) => keys[e.key] = true;
window.onkeyup = (e) => keys[e.key] = false;

function animate() {
    requestAnimationFrame(animate);

    // Controls
    if (keys['w'] || keys['ArrowUp']) speed += 0.005;
    else if (keys['s'] || keys['ArrowDown']) speed -= 0.01;
    else speed *= 0.98;
    speed = Math.max(0, Math.min(speed, 1.2));

    if (keys['a'] || keys['ArrowLeft']) lateral -= 0.3;
    if (keys['d'] || keys['ArrowRight']) lateral += 0.3;
    lateral = Math.max(-12, Math.min(lateral, 12));

    // Movement Logic
    progress += speed * 0.0004;
    if (progress > 1) progress = 0;

    // Get track data
    const pt = curve.getPointAt(progress);
    const tan = curve.getTangentAt(progress).normalize();
    
    // Get Frenet Frame (Crucial for staying INSIDE)
    const frames = tubeGeo.frenetFrames;
    const index = Math.floor(progress * (frames.normals.length - 1));
    const normal = frames.normals[index];   // Points to the center of the tube
    const binormal = frames.binormals[index]; // Points to the side

    // THE FIX: Start at the spine (pt), then move to the side (binormal) 
    // then move slightly towards the wall (normal)
    const finalPos = pt.clone()
        .add(binormal.clone().multiplyScalar(lateral))
        .add(normal.clone().multiplyScalar(15)); // This pulls the ship INSIDE the wall
    
    shipGroup.position.copy(finalPos);

    // Orientation
    const lookAtPos = pt.clone().add(tan);
    shipGroup.lookAt(lookAtPos);
    
    // Visual Banking
    body.rotation.z = THREE.MathUtils.lerp(body.rotation.z, (keys['a']?-0.8:0) + (keys['d']?0.8:0), 0.1);

    // Camera
    const camOffset = new THREE.Vector3(0, 6, -18);
    camOffset.applyQuaternion(shipGroup.quaternion);
    camera.position.lerp(shipGroup.position.clone().add(camOffset), 0.1);
    camera.lookAt(shipGroup.position.clone().add(tan.multiplyScalar(10)));

    // UI
    document.getElementById('speed-display').innerText = Math.floor(speed * 450);

    renderer.render(scene, camera);
}

window.onresize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};

animate();
