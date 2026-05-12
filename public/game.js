const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 35000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.getElementById('game-container').appendChild(renderer.domElement);

let speed = 0, progress = 0, lateral = 0, nitro = 100, gameActive = false;
let shipSettings = { model: 'Vanguard' };
let curve, tubeMesh, shipBody, thruster;
let bots = [];
const shipGroup = new THREE.Group();
const keys = {};

function initWorld() {
    scene.clear();
    scene.background = new THREE.Color(0x000008);
    scene.fog = new THREE.FogExp2(0x000008, 0.00008);
    
    scene.add(new THREE.AmbientLight(0xffffff, 1.2)); 
    const pLight = new THREE.PointLight(0x00ffff, 5, 2000);
    pLight.position.set(0, 100, 0); scene.add(pLight);

    // Deep Space Background
    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for(let i=0; i<15000; i++) starPos.push((Math.random()-0.5)*20000, (Math.random()-0.5)*20000, (Math.random()-0.5)*20000);
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({color: 0xffffff, size: 3})));
}

window.setShip = (m) => { shipSettings.model = m; window.buildShip(); };
window.buildShip = function() {
    shipGroup.clear(); shipGroup.scale.set(3, 3, 3);
    const mat = new THREE.MeshStandardMaterial({ color: 0x00ffff, metalness: 0.9, roughness: 0.1, emissive: 0x00ffff, emissiveIntensity: 0.5 });
    
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 4.5), mat); shipGroup.add(hull);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), new THREE.MeshPhongMaterial({color: 0x111111, transparent: true, opacity: 0.8}));
    canopy.position.set(0, 0.3, 0.8); canopy.scale.set(1, 0.6, 1.8); shipGroup.add(canopy);

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

window.generateTrack = function() {
    if(tubeMesh) scene.remove(tubeMesh);
    const pts = []; let r = 450;
    for (let i = 0; i <= 100; i++) {
        const t = (i / 100) * Math.PI * 2;
        pts.push(new THREE.Vector3(r*(2+Math.cos(3*t))*Math.cos(2*t), r*(2+Math.cos(3*t))*Math.sin(2*t), r*Math.sin(3*t)));
    }
    curve = new THREE.CatmullRomCurve3(pts); curve.closed = true;
    
    // ASPHALT UPGRADE: Glowing Tube Surface
    const geo = new THREE.TubeGeometry(curve, 150, 80, 16, true);
    tubeMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.15}));
    scene.add(tubeMesh);

    // Neon Gates
    for(let i=0; i<50; i++) {
        const gate = new THREE.Mesh(new THREE.TorusGeometry(85, 0.5, 8, 32), new THREE.MeshBasicMaterial({color: 0x00ffff}));
        const p = curve.getPointAt(i/50); gate.position.copy(p);
        gate.lookAt(curve.getPointAt((i/50 + 0.01)%1)); scene.add(gate);
    }
}

function animate() {
    requestAnimationFrame(animate);
    if(!gameActive) {
        shipGroup.rotation.y += 0.015;
        camera.position.set(30, 20, 60); camera.lookAt(0,0,0);
    } else {
        const isNitro = keys['shift'] && nitro > 0;
        speed = Math.max(0, Math.min(speed + (keys['w'] ? 0.04 : -0.03), isNitro ? 8.2 : 4.0));
        
        let tilt = 0;
        if (keys['a']) { lateral += 4.2; tilt = 0.5; } 
        if (keys['d']) { lateral -= 4.2; tilt = -0.5; }
        lateral = Math.max(-70, Math.min(70, lateral));
        progress += speed * 0.00048;

        const p = curve.getPointAt(progress % 1);
        const look = curve.getPointAt((progress + 0.01) % 1);
        if(p && look) {
            shipGroup.position.copy(p); shipGroup.lookAt(look); shipGroup.rotation.z = tilt;
            const right = new THREE.Vector3().setFromMatrixColumn(shipGroup.matrix, 0);
            shipGroup.position.addScaledVector(right, -lateral);
            
            // TITAN LOCK: Forces ship to track floor
            const down = new THREE.Vector3(0, -1, 0).applyQuaternion(shipGroup.quaternion);
            shipGroup.position.addScaledVector(down, 45); 

            // CINEMATIC ASPHALT CAMERA
            const camOffset = new THREE.Vector3(0, 16, -50).applyQuaternion(shipGroup.quaternion);
            camera.position.lerp(shipGroup.position.clone().add(camOffset), 0.1);
            camera.lookAt(shipGroup.position);
            
            if(isNitro) {
                camera.fov = 100;
                camera.position.x += (Math.random()-0.5) * 0.5; // Nitro Shake
            } else { camera.fov = 75; }
            camera.updateProjectionMatrix();
        }

        const racers = [{name: 'YOU', p: progress % 1}];
        bots.forEach(b => {
            b.prog += 0.00042;
            b.mesh.position.copy(curve.getPointAt(b.prog % 1));
            b.mesh.lookAt(curve.getPointAt((b.prog + 0.01) % 1));
            const bR = new THREE.Vector3().setFromMatrixColumn(b.mesh.matrix, 0);
            b.mesh.position.addScaledVector(bR, -b.lat).addScaledVector(new THREE.Vector3(0,-1,0).applyQuaternion(b.mesh.quaternion), 45);
            racers.push({name: b.name, p: b.prog % 1});
        });

        racers.sort((a,b) => b.p - a.p);
        document.getElementById('rank-list').innerHTML = racers.map((r,i) => `<b>${i+1}</b> ${r.name}`).join('<br>');
        document.getElementById('speedo').innerHTML = Math.floor(speed * 520) + "<span>KM/H</span>";
        document.getElementById('nitro-fill').style.width = nitro + "%";
        if(isNitro) { nitro -= 0.8; thruster.scale.set(5,5,5); thruster.material.color.set(0xff00ff); } 
        else { if(nitro < 100) nitro += 0.3; thruster.scale.set(1,1,1); thruster.material.color.set(0x00ffff); }
    }
    renderer.render(scene, camera);
}

window.onload = () => {
    initWorld(); window.generateTrack(); window.buildShip();
    document.getElementById('start-race-btn').onclick = () => {
        document.getElementById('menu-overlay').classList.add('hidden');
        document.getElementById('ui-layer').classList.remove('hidden');
        gameActive = true;
    };
    const bind = (id, k) => {
        const el = document.getElementById(id); if(!el) return;
        el.onmousedown = el.ontouchstart = (e) => { e.preventDefault(); keys[k] = true; };
        el.onmouseup = el.onmouseleave = el.ontouchend = () => keys[k] = false;
    };
    bind('l-btn', 'a'); bind('r-btn', 'd'); bind('g-btn', 'w'); bind('n-btn', 'shift');
    let w = 0; const f = document.getElementById('load-fill');
    const iv = setInterval(() => { w += 10; f.style.width = w + '%'; if(w >= 100) { clearInterval(iv); document.getElementById('splash-screen').classList.add('fade'); } }, 150);
};

window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);
animate();
