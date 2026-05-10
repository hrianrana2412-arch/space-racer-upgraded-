 // --- SCENE SETUP ---
 const scene = new THREE.Scene();
 const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.0015);
scene.fog = new THREE.FogExp2(0x000000, 0.0012);
 
 
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 3000);
 const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
 const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
 renderer.setSize(window.innerWidth, window.innerHeight);
 renderer.setSize(window.innerWidth, window.innerHeight);
 renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
 renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
 document.getElementById('game-container').appendChild(renderer.domElement);
 document.getElementById('game-container').appendChild(renderer.domElement);
 
 
 // --- LIGHTING ---
 // --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
 scene.add(ambientLight);
 scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
const pLight = new THREE.PointLight(0x00ffff, 1, 100);
dirLight.position.set(100, 200, 50);
scene.add(pLight);
scene.add(dirLight);


// --- TRACK GENERATION (Torus Knot) ---
// --- GENERATE NEON TRACK ---
const pathRadius = 400;
const pathRadius = 300;
const tubeRadius = 25;
const tubeRadius = 15;
const trackGeometry = new THREE.TorusKnotGeometry(pathRadius, tubeRadius, 600, 40, 2, 3);
const trackGeometry = new THREE.TorusKnotGeometry(pathRadius, tubeRadius, 400, 32, 2, 3);
 const trackMaterial = new THREE.MeshStandardMaterial({
 const trackMaterial = new THREE.MeshStandardMaterial({
    color: 0x111111,
    color: 0x050505,
     wireframe: true,
     wireframe: true,
     emissive: 0x00ffff,
     emissive: 0x00ffff,
    emissiveIntensity: 0.5
    emissiveIntensity: 0.4
 });
 });
 const trackMesh = new THREE.Mesh(trackGeometry, trackMaterial);
 const trackMesh = new THREE.Mesh(trackGeometry, trackMaterial);
 scene.add(trackMesh);
 scene.add(trackMesh);
 
 
// Create a mathematical curve from the track for navigation
const points = [];
const posAttr = trackGeometry.attributes.position;
for (let i = 0; i < posAttr.count; i += 15) { // Sample points
    points.push(new THREE.Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)));
}
const closedSpline = new THREE.CatmullRomCurve3(points);
closedSpline.closed = true;

// Pre-calculate Frenet Frames for ultra-stable orientation
const frenetFrames = closedSpline.computeFrenetFrames(2000, true);

 // --- PLAYER SHIP ---
 // --- PLAYER SHIP ---
 const shipGroup = new THREE.Group();
 const shipGroup = new THREE.Group();
 scene.add(shipGroup);
 scene.add(shipGroup);
 
 
// Main Body
const bodyGeo = new THREE.ConeGeometry(2.5, 7, 4);
const bodyGeo = new THREE.ConeGeometry(2, 6, 4);
 bodyGeo.rotateX(Math.PI / 2);
 bodyGeo.rotateX(Math.PI / 2);
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xff00ff, emissiveIntensity: 0.3 });
const shipBody = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xff00ff, emissiveIntensity: 0.5 }));
const shipBody = new THREE.Mesh(bodyGeo, bodyMat);
 shipGroup.add(shipBody);
 shipGroup.add(shipBody);
 
 
// Engine Glow
const engineGlow = new THREE.Mesh(new THREE.CircleGeometry(1.2, 16), new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide }));
const engineGeo = new THREE.CircleGeometry(1, 16);
engineGlow.position.z = -3.5;
const engineMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, side: THREE.DoubleSide });
const engineGlow = new THREE.Mesh(engineGeo, engineMat);
engineGlow.position.z = -3.1;
 shipGroup.add(engineGlow);
 shipGroup.add(engineGlow);
 
 
// --- GAME PHYSICS & STATE ---
// --- PHYSICS STATE ---
 let speed = 0;
 let speed = 0;
const maxSpeed = 2.5;
const maxSpeed = 1.5; 
const nitroSpeed = 4.0;
const nitroSpeed = 2.4;
const acceleration = 0.02;
const acceleration = 0.008;
const braking = 0.05;
const braking = 0.03;
const friction = 0.005;
const friction = 0.004;
 let nitro = 100;
 let nitro = 100;

 let trackPosition = 0;
 let trackPosition = 0;
const trackCurve = new THREE.CurvePath();
const points = trackGeometry.attributes.position.array;
const vectorPoints = [];
for (let i = 0; i < points.length; i += 3) {
    if(i % 120 === 0) { 
        vectorPoints.push(new THREE.Vector3(points[i], points[i+1], points[i+2]));
    }
}
const closedSpline = new THREE.CatmullRomCurve3(vectorPoints);
closedSpline.closed = true;

 let lateralOffset = 0;
 let lateralOffset = 0;
const turnSpeed = 0.3;
const turnSpeed = 0.4;
 
 
 // --- INPUTS ---
 // --- INPUTS ---
 const keys = { w: false, a: false, s: false, d: false, shift: false };
 const keys = { w: false, a: false, s: false, d: false, shift: false };
window.addEventListener('keydown', (e) => {
const handleKey = (e, val) => {
    if(e.key === 'w' || e.key === 'ArrowUp') keys.w = true;
    if(['w','ArrowUp'].includes(e.key)) keys.w = val;
    if(e.key === 'a' || e.key === 'ArrowLeft') keys.a = true;
    if(['a','ArrowLeft'].includes(e.key)) keys.a = val;
    if(e.key === 's' || e.key === 'ArrowDown') keys.s = true;
    if(['s','ArrowDown'].includes(e.key)) keys.s = val;
    if(e.key === 'd' || e.key === 'ArrowRight') keys.d = true;
    if(['d','ArrowRight'].includes(e.key)) keys.d = val;
    if(e.key === 'Shift') keys.shift = true;
    if(e.key === 'Shift') keys.shift = val;
});
};
window.addEventListener('keyup', (e) => {
window.addEventListener('keydown', (e) => handleKey(e, true));
    if(e.key === 'w' || e.key === 'ArrowUp') keys.w = false;
window.addEventListener('keyup', (e) => handleKey(e, false));
    if(e.key === 'a' || e.key === 'ArrowLeft') keys.a = false;

    if(e.key === 's' || e.key === 'ArrowDown') keys.s = false;
// Mobile Touch
    if(e.key === 'd' || e.key === 'ArrowRight') keys.d = false;
    if(e.key === 'Shift') keys.shift = false;
});

// Mobile Controls
 const bindTouch = (id, key) => {
 const bindTouch = (id, key) => {
     const el = document.getElementById(id);
     const el = document.getElementById(id);
     if(el) {
     if(el) {
         el.addEventListener('touchstart', (e) => { e.preventDefault(); keys[key] = true; });
         el.addEventListener('touchstart', (e) => { e.preventDefault(); keys[key] = true; });
         el.addEventListener('touchend', (e) => { e.preventDefault(); keys[key] = false; });
         el.addEventListener('touchend', (e) => { e.preventDefault(); keys[key] = false; });
     }
     }
 }
 }
bindTouch('btn-accel', 'w');
bindTouch('btn-accel', 'w'); bindTouch('btn-brake', 's');
bindTouch('btn-brake', 's');
bindTouch('btn-left', 'a'); bindTouch('btn-right', 'd');
bindTouch('btn-left', 'a');
bindTouch('btn-right', 'd');
 bindTouch('btn-nitro', 'shift');
 bindTouch('btn-nitro', 'shift');
 
 
// --- UI ELEMENTS ---
// --- UI ---
 const speedUI = document.getElementById('speed-display');
 const speedUI = document.getElementById('speed-display');
 const nitroUI = document.getElementById('nitro-bar');
 const nitroUI = document.getElementById('nitro-bar');
 
 
 @@ -110,97 +97,76 @@ const clock = new THREE.Clock();
 
 
 function animate() {
 function animate() {
     requestAnimationFrame(animate);
     requestAnimationFrame(animate);

    
    // 1. INPUT & SPEED PHYSICS
    // 1. Logic & Input
     let currentMax = keys.shift && nitro > 0 ? nitroSpeed : maxSpeed;
     let currentMax = keys.shift && nitro > 0 ? nitroSpeed : maxSpeed;
     if (keys.w) speed += acceleration;
     if (keys.w) speed += acceleration;
     else if (keys.s) speed -= braking;
     else if (keys.s) speed -= braking;
     else speed -= friction;
     else speed -= friction;
 
 
    // Nitro FOV and Speed Effect
     if (keys.shift && nitro > 0 && speed > 0.5) {
     if (keys.shift && nitro > 0 && speed > 0.5) {
        nitro -= 0.5;
        nitro -= 0.6;
        camera.fov = THREE.MathUtils.lerp(camera.fov, 90, 0.1);
        camera.fov = THREE.MathUtils.lerp(camera.fov, 85, 0.1);
        engineGlow.material.color.setHex(0xff00ff);
     } else {
     } else {
        if(nitro < 100) nitro += 0.1;
        if(nitro < 100) nitro += 0.15;
        camera.fov = THREE.MathUtils.lerp(camera.fov, 75, 0.1);
        camera.fov = THREE.MathUtils.lerp(camera.fov, 70, 0.1);
        engineGlow.material.color.setHex(0x00ffff);
     }
     }
     camera.updateProjectionMatrix();
     camera.updateProjectionMatrix();
 
 
    if (speed > currentMax) speed -= friction * 2;
    speed = THREE.MathUtils.clamp(speed, 0, currentMax);
    if (speed < 0) speed = 0;
 
 
    // Steering logic
     if (keys.a) lateralOffset -= turnSpeed;
     if (keys.a) lateralOffset -= turnSpeed;
     if (keys.d) lateralOffset += turnSpeed;
     if (keys.d) lateralOffset += turnSpeed;
    lateralOffset = THREE.MathUtils.clamp(lateralOffset, -tubeRadius + 5, tubeRadius - 5);
    lateralOffset = THREE.MathUtils.clamp(lateralOffset, -tubeRadius + 6, tubeRadius - 6);
 
 
    // 2. TRACK POSITION LOGIC
    // 2. Track Navigation (Frenet Frame Math)
     trackPosition += (speed * 0.0001);
     trackPosition += (speed * 0.0001);
     if (trackPosition >= 1) trackPosition -= 1;
     if (trackPosition >= 1) trackPosition -= 1;
 
 
    // GET STABLE FRENET FRAME (The Fix)
    const frameIndex = Math.floor(trackPosition * 1999);
     const pos = closedSpline.getPointAt(trackPosition);
     const pos = closedSpline.getPointAt(trackPosition);
     const tangent = closedSpline.getTangentAt(trackPosition).normalize();
     const tangent = closedSpline.getTangentAt(trackPosition).normalize();

    // This calculates the 'floor' of the tube accurately
    const frenetFrames = closedSpline.computeFrenetFrames(1000, true);
    const frameIndex = Math.floor(trackPosition * 1000);
    // SWAP: Use Normal for the side-offset and Binormal for the 'Up' orientation
     const normal = frenetFrames.normals[frameIndex];
     const normal = frenetFrames.normals[frameIndex];
     const binormal = frenetFrames.binormals[frameIndex];
     const binormal = frenetFrames.binormals[frameIndex];
 
 
    // This puts the ship INSIDE the tube
    // Position ship INSIDE the tube using the Normal vector
     const finalPos = pos.clone().add(normal.clone().multiplyScalar(lateralOffset));
     const finalPos = pos.clone().add(normal.clone().multiplyScalar(lateralOffset));
     shipGroup.position.copy(finalPos);
     shipGroup.position.copy(finalPos);
 
 
    // Orientation: Face forward, but use the BINORMAL as the 'Up' vector
    // Orientation: Use Binormal as the "Up" vector to keep ship feet on the floor
     const lookAtPos = pos.clone().add(tangent);
     const lookAtPos = pos.clone().add(tangent);
    const m = new THREE.Matrix4();
    const m = new THREE.Matrix4().lookAt(shipGroup.position, lookAtPos, binormal);
    m.lookAt(shipGroup.position, lookAtPos, binormal); 
     shipGroup.quaternion.slerp(new THREE.Quaternion().setFromRotationMatrix(m), 0.2);
     shipGroup.quaternion.slerp(new THREE.Quaternion().setFromRotationMatrix(m), 0.2);
 
 
    // Smoothly orient ship to face forward using the track's normal
    // Banking
    const lookAtPos = pos.clone().add(tangent);
    const bankTarget = (keys.a ? 0.7 : 0) + (keys.d ? -0.7 : 0);
    const m = new THREE.Matrix4();
    m.lookAt(shipGroup.position, lookAtPos, normal);
    shipGroup.quaternion.slerp(new THREE.Quaternion().setFromRotationMatrix(m), 0.2);

    // Visual banking for "Asphalt" feel
    const bankTarget = (keys.a ? 0.8 : 0) + (keys.d ? -0.8 : 0);
     shipBody.rotation.z = THREE.MathUtils.lerp(shipBody.rotation.z, bankTarget, 0.1);
     shipBody.rotation.z = THREE.MathUtils.lerp(shipBody.rotation.z, bankTarget, 0.1);
 
 
    // 3. PRO-LEVEL CAMERA FOLLOW
    // 3. Camera Follow
    const camOffset = new THREE.Vector3(0, 6, -15);
    const camOffset = new THREE.Vector3(0, 7, -18);
     camOffset.applyQuaternion(shipGroup.quaternion);
     camOffset.applyQuaternion(shipGroup.quaternion);
    const targetCamPos = shipGroup.position.clone().add(camOffset);
    camera.position.lerp(shipGroup.position.clone().add(camOffset), 0.12);

    camera.position.lerp(targetCamPos, 0.1);
     camera.lookAt(shipGroup.position.clone().add(tangent.clone().multiplyScalar(10)));
     camera.lookAt(shipGroup.position.clone().add(tangent.clone().multiplyScalar(10)));
 
 
    // 4. UI UPDATES
    // 4. Update UI
    speedUI.innerHTML = Math.floor(speed * 100) + ' <span style="font-size: 14px;">KM/H</span>';
    speedUI.innerHTML = Math.floor(speed * 300) + ' <span style="font-size: 14px;">KM/H</span>';
     nitroUI.style.width = nitro + '%';
     nitroUI.style.width = nitro + '%';
     updateMinimap();
     updateMinimap();
 
 
     renderer.render(scene, camera);
     renderer.render(scene, camera);
 }
 }
// --- MINIMAP LOGIC ---

 const minimapCanvas = document.getElementById('minimap');
 const minimapCanvas = document.getElementById('minimap');
 const ctx = minimapCanvas.getContext('2d');
 const ctx = minimapCanvas.getContext('2d');
 function updateMinimap() {
 function updateMinimap() {
    minimapCanvas.width = 150;
    minimapCanvas.width = 150; minimapCanvas.height = 150;
    minimapCanvas.height = 150;
     ctx.clearRect(0, 0, 150, 150);
     ctx.clearRect(0, 0, 150, 150);

    const x = 75 + Math.cos(trackPosition * Math.PI * 2) * 50;
    const mapScale = 150; 
    const y = 75 + Math.sin(trackPosition * Math.PI * 2) * 50;
    const x = (trackPosition * mapScale) % 150;
    ctx.fillStyle = '#0ff';
    const y = 75; 
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#ff00ff';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
 }
 }
 
 
 window.addEventListener('resize', () => {
 window.addEventListener('resize', () => {
 @@ -209,4 +175,4 @@ window.addEventListener('resize', () => {
     renderer.setSize(window.innerWidth, window.innerHeight);
     renderer.setSize(window.innerWidth, window.innerHeight);
 });
 });
 
 
animate();
animate();

