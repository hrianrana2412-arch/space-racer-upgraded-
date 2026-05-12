/** * TITAN-ASPHALT CORE ENGINE 
 */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 40000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('game-container').appendChild(renderer.domElement);

let speed = 0, progress = 0, lateral = 0, nitro = 100, gameActive = false;
let shipSettings = { model: 'Vanguard' };
let curve, tubeMesh, thruster;
const shipGroup = new THREE.Group();
const keys = {};

// WORLD BUILDER
function initWorld() {
    scene.clear();
    scene.background = new THREE.Color(0x000008);
    scene.fog = new THREE.FogExp2(0x000008, 0.00007);
    scene.add(new THREE.AmbientLight(0xffffff, 1.3)); 
    
    const pLight = new THREE.PointLight(0x00ffff, 5, 2500);
    pLight.position.set(0, 100, 0); scene.add(pLight);

    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for(let i=0; i<15000; i++) starPos.push((Math.random()-0.5)*25000, (Math.random()-0.5)*25000, (Math.random()-0.5)*25000);
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({color: 0xffffff, size: 3})));
}

// SHIP GEOMETRY
window.setShip = (m) => { shipSettings.model = m; window.buildShip(); };
window.buildShip = function() {
    shipGroup.clear(); shipGroup.scale.set(3, 3, 3);
    const mat = new THREE.MeshStandardMaterial({ color: 0x00ffff, metalness: 0.9, roughness: 0.1, emissive: 0x00ffff, emissiveIntensity: 0.4 });
    
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 4.5), mat); shipGroup.add(hull);

    if (shipSettings.model === 'Zenith') {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.8, 1.8), mat); fin.position.z = -1.2; shipGroup.add(fin);
    } else if (shipSettings.model === 'Phantom') {
        const r1 = new THREE.Mesh(new THREE.TorusGeometry(2, 0.1, 8, 32), mat); r1.rotation.y = 1.57; shipGroup.add(r1);
    } else {
        const wL = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 2.5), mat); wL.position.set(2, 0, -0.5); shipGroup.add(wL);
        const wR = wL.clone(); wR.position.x = -2; shipGroup.add(wR);
    }
    
    thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.8), new THREE.MeshBasicMaterial({color: 0x00ffff}));
    thruster.rotation.x = 1.57; thruster.position.z = -2.5; shipGroup.add(thruster);
    scene.add(shipGroup);
}

// TRACK GENERATION
window.generateTrack = function() {
    if(tubeMesh) scene.remove(tubeMesh);
    const pts = []; let r = 450;
    for (let i = 0; i <= 100; i++) {
        const t = (i / 100) * Math.PI * 2;
        pts.push(new THREE.Vector3(r*(2+Math.cos(3*t))*Math.cos(2*t), r*(2+Math.cos(3*t))*Math.sin(2*t), r*Math.sin(3*t)));
    }
    curve = new THREE.CatmullRomCurve3(pts); curve.closed = true;
    tubeMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 150, 80, 16, true), new THREE.MeshStandardMaterial({color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.1}));
    scene.add(tubeMesh);
}

// PHYSICS & ANIMATION
function animate() {
    requestAnimationFrame(animate);
    if(!gameActive) {
        shipGroup.rotation.y += 0.015;
        camera.position.set(30, 20, 60); camera.lookAt(0,0,0);
    } else {
        const isNitro = keys['shift'] && nitro > 0;
        speed = Math.max(0, Math.min(speed + (keys['w'] ? 0.04 : -0.03), isNitro ? 8.5 : 4.0));
        
        let tilt = 0;
        if (keys['a']) { lateral += 4.5; tilt = 0.5; } 
        if (keys['d']) { lateral -= 4.5; tilt = -0.5; }
        lateral = Math.max(-70, Math.min(70, lateral));
        progress += speed * 0.00045;

        const p = curve.getPointAt(progress % 1);
        const look = curve.getPointAt((progress + 0.01) % 1);
        
        if(p && look) {
            shipGroup.position.copy(p); shipGroup.lookAt(look); shipGroup.rotation.z = tilt;
            const right = new THREE.Vector3().setFromMatrixColumn(shipGroup.matrix, 0);
            shipGroup.position.addScaledVector(right, -lateral);
            
            // TITAN LOCK: Fix to Track Surface
            const down = new THREE.Vector3(0, -1, 0).applyQuaternion(shipGroup.quaternion);
            shipGroup.position.addScaledVector(down, 45); 

            // CINEMATIC CAMERA
            const camOffset = new THREE.Vector3(0, 16, -50).applyQuaternion(shipGroup.quaternion);
            camera.position.lerp(shipGroup.position.clone().add(camOffset), 0.1);
            camera.lookAt(shipGroup.position);
            
            if(isNitro) { camera.fov = 98; camera.position.x += (Math.random()-0.5) * 0.5; } 
            else { camera.fov = 75; }
            camera.updateProjectionMatrix();
        }

        // HUD UPDATES (Failsafe)
        const spdEl = document.getElementById('speedo');
        const nitEl = document.getElementById('nitro-fill');
        if(spdEl) spdEl.innerHTML = Math.floor(speed * 500) + "<span>KM/H</span>";
        if(nitEl) nitEl.style.width = nitro + "%";

        if(isNitro) { nitro -= 0.8; thruster.scale.set(5,5,5); } 
        else { if(nitro < 100) nitro += 0.3; thruster.scale.set(1,1,1); }
    }
    renderer.render(scene, camera);
}

// THE "NUCLEAR" INITIALIZATION
function setupEverything() {
    initWorld(); 
    window.generateTrack(); 
    window.buildShip();

    // Bind Start Button
    const startBtn = document.getElementById('start-race-btn');
    if(startBtn) {
        startBtn.onclick = () => {
            document.getElementById('menu-overlay').classList.add('hidden');
            document.getElementById('ui-layer').classList.remove('hidden');
            gameActive = true;
        };
    }

    // Bind Controls with Failsafe
    const bind = (id, k) => {
        const el = document.getElementById(id);
        if(!el) return;
        el.onmousedown = el.ontouchstart = (e) => { e.preventDefault(); keys[k] = true; };
        el.onmouseup = el.onmouseleave = el.ontouchend = () => keys[k] = false;
    };
    bind('l-btn', 'a'); bind('r-btn', 'd'); bind('g-btn', 'w'); bind('n-btn', 'shift');

    // Splash Screen Clear
    let w = 0;
    const iv = setInterval(() => {
        w += 10; const fill = document.getElementById('load-fill');
        if(fill) fill.style.width = w + '%';
        if(w >= 100) { clearInterval(iv); document.getElementById('splash-screen').classList.add('fade'); }
    }, 100);
}

// Force a 500ms delay to let the browser breathe
window.addEventListener('load', () => {
    setTimeout(setupEverything, 500);
});

window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

animate();
