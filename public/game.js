const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 20000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('game-container').appendChild(renderer.domElement);

let speed = 0, progress = 0, lateral = 0, nitro = 100, gameActive = false, winSeq = false;
let shipSettings = { color: "#00ffff", model: 'Interceptor' };
let curve, tubeMesh, shipBody, thruster;
let aiBots = [];
const shipGroup = new THREE.Group();
const keys = {};

function initWorld() {
    scene.clear();
    scene.background = new THREE.Color(0x000005);
    scene.add(new THREE.AmbientLight(0xffffff, 1.8)); // HIGH BRIGHTNESS
    const sun = new THREE.PointLight(0xffffff, 5, 10000); sun.position.set(500, 500, 500); scene.add(sun);

    // Galaxies & Planets
    const starGeo = new THREE.BufferGeometry(); const starPos = [];
    for(let i=0; i<15000; i++) starPos.push((Math.random()-0.5)*10000, (Math.random()-0.5)*10000, (Math.random()-0.5)*10000);
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({color: 0xffffff, size: 2})));

    const colors = [0xff4400, 0x00aaff, 0x88ff00, 0xff00ff];
    for(let i=0; i<8; i++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(150 + Math.random()*200, 32, 32), new THREE.MeshPhongMaterial({color: colors[i%4], emissive: colors[i%4], emissiveIntensity: 0.3}));
        p.position.set((Math.random()-0.5)*9000, (Math.random()-0.5)*9000, (Math.random()-0.5)*9000);
        scene.add(p);
    }
}

window.setShip = (m) => { shipSettings.model = m; window.buildShip(); };
window.buildShip = function() {
    shipGroup.clear(); shipGroup.scale.set(3, 3, 3);
    const mat = new THREE.MeshPhongMaterial({ color: new THREE.Color(shipSettings.color), specular: 0xffffff, shininess: 120, emissive: new THREE.Color(shipSettings.color), emissiveIntensity: 0.3 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 4), mat); shipGroup.add(hull);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), new THREE.MeshPhongMaterial({color: 0x000000}));
    glass.position.set(0, 0.3, 0.6); glass.scale.set(1, 0.5, 2); shipGroup.add(glass);
    
    if (shipSettings.model === 'Speeder') {
        const n = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3, 4), mat); n.rotation.x = 1.57; n.position.z = 2.5; shipGroup.add(n);
    } else if (shipSettings.model === 'Vanguard') {
        const wingL = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 2), mat); wingL.position.set(1.8, 0, -0.5); shipGroup.add(wingL);
        const wingR = wingL.clone(); wingR.position.x = -1.8; shipGroup.add(wingR);
    } else if (shipSettings.model === 'Zenith') {
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2, 2.5), mat); f.position.z = -1; shipGroup.add(f);
    }
    thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 0.6), new THREE.MeshBasicMaterial({color: 0x00ffff}));
    thruster.rotation.x = 1.57; thruster.position.z = -2.2; shipGroup.add(thruster);
    scene.add(shipGroup);
}

window.generateTrack = function(id = 1) {
    if(tubeMesh) scene.remove(tubeMesh);
    const pts = []; let r = 200 + (id * 30);
    for (let i = 0; i <= 100; i++) {
        const t = (i / 100) * Math.PI * 2;
        pts.push(new THREE.Vector3(r*(2+Math.cos(3*t))*Math.cos(2*t), r*(2+Math.cos(3*t))*Math.sin(2*t), r*Math.sin(3*t)));
    }
    curve = new THREE.CatmullRomCurve3(pts); curve.closed = true;
    tubeMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 100, 85, 16, true), new THREE.MeshStandardMaterial({color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.2}));
    scene.add(tubeMesh);
}

window.startGame = () => {
    if(!curve) window.generateTrack(1);
    document.getElementById('menu-overlay').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    aiBots.forEach(b => scene.remove(b.mesh)); aiBots = [];
    for(let i=0; i<5; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(4, 1.5, 8), new THREE.MeshStandardMaterial({color: 0xff0044, emissive: 0xff0000}));
        scene.add(b); aiBots.push({ mesh: b, progress: Math.random()*0.1, lat: (Math.random()-0.5)*140, name: `BOT-0${i+1}` });
    }
    gameActive = true;
};

function animate() {
    requestAnimationFrame(animate);
    if(winSeq) {
        shipGroup.rotation.y += 0.1; camera.position.z += 2; camera.lookAt(shipGroup.position);
    } else if(!gameActive) {
        shipGroup.rotation.y += 0.01; camera.position.set(25, 15, 45); camera.lookAt(0,0,0);
    } else {
        const isNitro = keys['shift'] && nitro > 0;
        speed = Math.max(0, Math.min(speed + (keys['w'] ? 0.025 : -0.015), isNitro ? 6.5 : 3.2));
        let tilt = 0;
        if (keys['a']) { lateral += 3.2; tilt = 0.5; } // Fixed L/R
        if (keys['d']) { lateral -= 3.2; tilt = -0.5; }
        lateral = Math.max(-75, Math.min(75, lateral));
        progress += speed * 0.0004;

        if(progress > 0.99) winSeq = true;

        const p = curve.getPointAt(progress % 1);
        const look = curve.getPointAt((progress + 0.01) % 1);
        if(p && look) {
            shipGroup.position.copy(p); shipGroup.lookAt(look); shipGroup.rotation.z = tilt;
            const right = new THREE.Vector3().setFromMatrixColumn(shipGroup.matrix, 0);
            shipGroup.position.addScaledVector(right, -lateral);
            shipGroup.position.addScaledVector(new THREE.Vector3(0,-1,0).applyQuaternion(shipGroup.quaternion), 40);
            camera.position.lerp(new THREE.Vector3(0,25,-60).applyQuaternion(shipGroup.quaternion).add(shipGroup.position), 0.1);
            camera.lookAt(shipGroup.position);
        }

        const racers = [{name: 'PLAYER', prog: progress % 1}];
        aiBots.forEach(bot => {
            bot.progress += 0.00035;
            bot.mesh.position.copy(curve.getPointAt(bot.progress % 1));
            bot.mesh.lookAt(curve.getPointAt((bot.progress + 0.01) % 1));
            const bR = new THREE.Vector3().setFromMatrixColumn(bot.mesh.matrix, 0);
            bot.mesh.position.addScaledVector(bR, -bot.lat);
            bot.mesh.position.addScaledVector(new THREE.Vector3(0,-1,0).applyQuaternion(bot.mesh.quaternion), 40);
            racers.push({name: bot.name, prog: bot.progress % 1});
        });
        
        racers.sort((a,b) => b.prog - a.prog);
        document.getElementById('leaderboard').innerHTML = racers.map((r,i) => `<div class="lb-row" ${r.name==='PLAYER'?'id="rank-player"':''}>${i+1}. ${r.name}</div>`).join('');
        document.getElementById('speed-display').innerHTML = `${Math.floor(speed * 480)} <span>KM/H</span>`;
        document.getElementById('nitro-bar').style.width = nitro + "%";
        if(isNitro) { nitro -= 0.7; thruster.scale.set(4,4,4); camera.fov = 100; } else { if(nitro < 100) nitro += 0.4; thruster.scale.set(1,1,1); camera.fov = 75; }
        camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
}

window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);
const bind = (id, k) => { const el = document.getElementById(id); el.ontouchstart = (e) => { e.preventDefault(); keys[k] = true; }; el.ontouchend = () => keys[k] = false; };
bind('btn-left', 'a'); bind('btn-right', 'd'); bind('btn-gas', 'w'); bind('btn-nitro', 'shift');

window.onload = () => {
    initWorld(); window.generateTrack(1); window.buildShip();
    let w = 0; const b = document.getElementById('loading-progress');
    const iv = setInterval(() => { w += 10; b.style.width = w + '%'; if(w>=100) { clearInterval(iv); document.getElementById('splash-screen').classList.add('fade-out'); } }, 100);
};
animate();
