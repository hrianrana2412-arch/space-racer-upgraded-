const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 30000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
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
    scene.background = new THREE.Color(0x000005);
    scene.add(new THREE.AmbientLight(0xffffff, 1.8)); 
    const pLight = new THREE.PointLight(0xffffff, 3, 10000);
    pLight.position.set(200, 500, 200);
    scene.add(pLight);

    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for(let i=0; i<12000; i++) starPos.push((Math.random()-0.5)*15000, (Math.random()-0.5)*15000, (Math.random()-0.5)*15000);
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({color: 0xffffff, size: 2.5})));

    const pColors = [0xff4400, 0x00aaff, 0xff00ff];
    for(let i=0; i<6; i++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(250, 32, 32), new THREE.MeshPhongMaterial({color: pColors[i%3], emissive: pColors[i%3], emissiveIntensity: 0.4}));
        p.position.set((Math.random()-0.5)*10000, (Math.random()-0.5)*10000, (Math.random()-0.5)*10000);
        scene.add(p);
    }
}

window.setShip = (m) => { shipSettings.model = m; window.buildShip(); };
window.buildShip = function() {
    shipGroup.clear(); shipGroup.scale.set(3, 3, 3);
    const mat = new THREE.MeshPhongMaterial({ color: 0x00ffff, specular: 0xffffff, shininess: 100, emissive: 0x00ffff, emissiveIntensity: 0.4 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 4), mat); shipGroup.add(hull);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 1.2), new THREE.MeshBasicMaterial({color: 0x000000}));
    glass.position.set(0, 0.35, 0.5); shipGroup.add(glass);

    if (shipSettings.model === 'Vanguard') {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 2), mat); wing.position.set(0, 0, -0.5); shipGroup.add(wing);
    } else if (shipSettings.model === 'Zenith') {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 1.5), mat); fin.position.z = -1; shipGroup.add(fin);
    } else if (shipSettings.model === 'Phantom') {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.1, 8, 30), mat); ring.rotation.y = 1.57; shipGroup.add(ring);
    }
    
    thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 0.6), new THREE.MeshBasicMaterial({color: 0x00ffff}));
    thruster.rotation.x = 1.57; thruster.position.z = -2.2; shipGroup.add(thruster);
    scene.add(shipGroup);
}

window.generateTrack = function(id = 1) {
    if(tubeMesh) scene.remove(tubeMesh);
    const pts = []; let r = 400 + (id * 50);
    for (let i = 0; i <= 100; i++) {
        const t = (i / 100) * Math.PI * 2;
        pts.push(new THREE.Vector3(r*(2+Math.cos(3*t))*Math.cos(2*t), r*(2+Math.cos(3*t))*Math.sin(2*t), r*Math.sin(3*t)));
    }
    curve = new THREE.CatmullRomCurve3(pts); curve.closed = true;
    tubeMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 100, 85, 12, true), new THREE.MeshStandardMaterial({color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.25}));
    scene.add(tubeMesh);
}

const bind = (id, k) => {
    const el = document.getElementById(id);
    if(!el) return;
    el.ontouchstart = (e) => { e.preventDefault(); keys[k] = true; };
    el.ontouchend = () => keys[k] = false;
};

window.startGame = () => {
    document.getElementById('menu-overlay').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    
    // Bind buttons ONLY after they are visible in HUD
    bind('l-btn', 'a'); bind('r-btn', 'd'); bind('g-btn', 'w'); bind('n-btn', 'shift');

    bots.forEach(b => scene.remove(b.mesh)); bots = [];
    for(let i=0; i<4; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(4, 1.5, 8), new THREE.MeshStandardMaterial({color: 0xff0044, emissive: 0xff0000}));
        scene.add(b); bots.push({ mesh: b, prog: Math.random()*0.1, lat: (Math.random()-0.5)*140, name: `STORM-${i+1}` });
    }
    gameActive = true;
};

function animate() {
    requestAnimationFrame(animate);
    if(!gameActive) {
        shipGroup.rotation.y += 0.01;
        camera.position.set(20, 15, 50); camera.lookAt(0,0,0);
    } else {
        const isNitro = keys['shift'] && nitro > 0;
        speed = Math.max(0, Math.min(speed + (keys['w'] ? 0.03 : -0.02), isNitro ? 7.5 : 3.8));
        
        let tilt = 0;
        if (keys['a']) { lateral += 3.8; tilt = 0.5; } 
        if (keys['d']) { lateral -= 3.8; tilt = -0.5; }
        lateral = Math.max(-75, Math.min(75, lateral));
        progress += speed * 0.00045;

        const p = curve.getPointAt(progress % 1);
        const look = curve.getPointAt((progress + 0.01) % 1);
        
        if(p && look) {
            shipGroup.position.copy(p); shipGroup.lookAt(look); shipGroup.rotation.z = tilt;
            const right = new THREE.Vector3().setFromMatrixColumn(shipGroup.matrix, 0);
            shipGroup.position.addScaledVector(right, -lateral);
            const down = new THREE.Vector3(0, -1, 0).applyQuaternion(shipGroup.quaternion);
            shipGroup.position.addScaledVector(down, 42);

            const camOffset = new THREE.Vector3(0, 14, -48).applyQuaternion(shipGroup.quaternion);
            camera.position.copy(shipGroup.position).add(camOffset);
            camera.lookAt(shipGroup.position);
            if(isNitro) camera.position.addScaledVector(down, 3);
        }

        const racers = [{name: 'YOU', p: progress % 1}];
        bots.forEach(b => {
            b.prog += 0.00038;
            b.mesh.position.copy(curve.getPointAt(b.prog % 1));
            b.mesh.lookAt(curve.getPointAt((b.prog + 0.01) % 1));
            const bR = new THREE.Vector3().setFromMatrixColumn(b.mesh.matrix, 0);
            b.mesh.position.addScaledVector(bR, -b.lat);
            b.mesh.position.addScaledVector(new THREE.Vector3(0,-1,0).applyQuaternion(b.mesh.quaternion), 42);
            racers.push({name: b.name, p: b.prog % 1});
        });

        racers.sort((a,b) => b.p - a.p);
        document.getElementById('lb').innerHTML = racers.map((r,i) => `<b>${i+1}.</b> ${r.name}`).join('<br>');
        document.getElementById('speedo').innerHTML = Math.floor(speed * 480) + "<span>KM/H</span>";
        document.getElementById('nitro-fill').style.width = nitro + "%";
        if(isNitro) { nitro -= 0.7; thruster.scale.set(4,4,4); camera.fov = 98; } else { if(nitro < 100) nitro += 0.4; thruster.scale.set(1,1,1); camera.fov = 75; }
        camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
}

window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

window.onload = () => {
    initWorld(); window.generateTrack(1); window.buildShip();
    let w = 0; const f = document.getElementById('load-fill');
    const iv = setInterval(() => { w+=10; f.style.width = w+'%'; if(w>=100){ clearInterval(iv); document.getElementById('splash-screen').classList.add('fade'); } }, 100);
};
animate();
