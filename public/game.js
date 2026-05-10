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

function initWorld() {
    scene.clear();
    scene.background = new THREE.Color(0x000005);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.position.set(10, 10, 10);
    scene.add(sun);
    
    const starGeo = new THREE.BufferGeometry();
    const starPos = [];
    for(let i=0; i<5000; i++) starPos.push((Math.random()-0.5)*3000, (Math.random()-0.5)*3000, (Math.random()-0.5)*3000);
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({color: 0xffffff, size: 1})));
}

function buildShip() {
    shipGroup.clear();
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(shipSettings.color), metalness: 0.8 });
    shipBody = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 4), mat);
    shipGroup.add(shipBody);

    if(shipSettings.model === 'Speeder') {
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2, 4), mat);
        nose.rotation.x = Math.PI/2; nose.position.z = 2.5;
        shipGroup.add(nose);
    } else if(shipSettings.model === 'Tanker') {
        const shield = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 0.5), mat);
        shield.position.z = 1.5;
        shipGroup.add(shield);
    } else {
        const wings = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 2), mat);
        shipGroup.add(wings);
    }

    thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.5), new THREE.MeshBasicMaterial({color: 0x00ffff}));
    thruster.rotation.x = Math.PI/2; thruster.position.z = -2.2;
    shipGroup.add(thruster);
    scene.add(shipGroup);
}

window.setShipModel = (m) => { shipSettings.model = m; buildShip(); };
document.getElementById('shipColor').oninput = (e) => { shipSettings.color = e.target.value; buildShip(); };
window.toggleMultiplayer = () => {
    isMultiplayer = !isMultiplayer;
    document.getElementById('multi-btn').innerText = isMultiplayer ? "MODE: MULTIPLAYER" : "MODE: OFFLINE";
};

window.startGame = () => {
    initWorld();
    const pts = [];
    for (let i = 0; i <= 100; i++) {
        const t = (i / 100) * Math.PI * 2;
        pts.push(new THREE.Vector3(150*(2+Math.cos(3*t))*Math.cos(2*t), 150*(2+Math.cos(3*t))*Math.sin(2*t), 150*Math.sin(3*t)));
    }
    curve = new THREE.CatmullRomCurve3(pts);
    curve.closed = true;
    tubeGeo = new THREE.TubeGeometry(curve, 100, 25, 12, true);
    scene.add(new THREE.Mesh(tubeGeo, new THREE.MeshStandardMaterial({color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.15})));
    
    buildShip();
    document.getElementById('menu-overlay').classList.add('hidden');
    document.getElementById('ui-layer').classList.remove('hidden');
    gameActive = true;
};

function animate() {
    requestAnimationFrame(animate);
    if(!gameActive) {
        shipGroup.rotation.y += 0.01;
        camera.position.set(0, 5, 12);
        camera.lookAt(0,0,0);
    } else {
        const isNitro = keys['Shift'] && nitro > 0;
        if (keys['w']) speed += 0.007; else speed *= 0.98;
        speed = Math.max(0, Math.min(speed, isNitro ? 2.8 : 1.4));
        if (keys['a']) lateral -= 0.5; if (keys['d']) lateral += 0.5;
        lateral = Math.max(-18, Math.min(lateral, 18));
        
        progress += speed * 0.0004;
        if(progress > 1) progress = 0;
        
        const pos = curve.getPointAt(progress);
        const tan = curve.getTangentAt(progress).normalize();
        const frames = tubeGeo.frenetFrames;
        const index = Math.floor(progress * (frames.normals.length - 1));
        
        shipGroup.position.copy(pos).add(frames.binormals[index].clone().multiplyScalar(lateral)).add(frames.normals[index].clone().multiplyScalar(15));
        shipGroup.lookAt(pos.clone().add(tan));
        
        const camOff = new THREE.Vector3(0, 7, -18).applyQuaternion(shipGroup.quaternion);
        camera.position.copy(shipGroup.position.clone().add(camOff));
        camera.lookAt(shipGroup.position);
        
        document.getElementById('speed-display').innerText = Math.floor(speed * 400);
    }
    renderer.render(scene, camera);
}

window.onkeydown = (e) => keys[e.key] = true;
window.onkeyup = (e) => keys[e.key] = false;
initWorld(); buildShip(); animate();
