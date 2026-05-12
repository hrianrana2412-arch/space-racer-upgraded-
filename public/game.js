// INITIALIZATION WRAPPER
window.addEventListener('load', () => {
    
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

    // 1. WORLD SETUP
    function initWorld() {
        scene.background = new THREE.Color(0x000008);
        scene.fog = new THREE.FogExp2(0x000008, 0.00008);
        scene.add(new THREE.AmbientLight(0xffffff, 1.2));
        
        const sun = new THREE.PointLight(0x00ffff, 5, 2000);
        sun.position.set(0, 100, 0); scene.add(sun);

        const starGeo = new THREE.BufferGeometry();
        const starPos = [];
        for(let i=0; i<10000; i++) starPos.push((Math.random()-0.5)*20000, (Math.random()-0.5)*20000, (Math.random()-0.5)*20000);
        starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
        scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({color: 0xffffff, size: 2})));
    }

    // 2. SHIP GENERATOR
    window.setShip = (m) => { shipSettings.model = m; window.buildShip(); };
    window.buildShip = function() {
        shipGroup.clear(); shipGroup.scale.set(3, 3, 3);
        const mat = new THREE.MeshStandardMaterial({ color: 0x00ffff, metalness: 0.8, roughness: 0.2, emissive: 0x00ffff, emissiveIntensity: 0.3 });
        shipGroup.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 4.5), mat));

        if(shipSettings.model === 'Zenith') {
            const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, 1.5), mat); fin.position.z = -1; shipGroup.add(fin);
        } else if(shipSettings.model === 'Phantom') {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.1, 8, 32), mat); ring.rotation.y = 1.57; shipGroup.add(ring);
        } else {
            const w1 = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, 2), mat); w1.position.set(1.5, 0, -0.5); shipGroup.add(w1);
            const w2 = w1.clone(); w2.position.x = -1.5; shipGroup.add(w2);
        }
        
        thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 0.8), new THREE.MeshBasicMaterial({color: 0x00ffff}));
        thruster.rotation.x = 1.57; thruster.position.z = -2.5; shipGroup.add(thruster);
        scene.add(shipGroup);
    }

    // 3. TITAN TRACK
    window.generateTrack = function() {
        const pts = []; let r = 400;
        for (let i = 0; i <= 100; i++) {
            const t = (i / 100) * Math.PI * 2;
            pts.push(new THREE.Vector3(r*(2+Math.cos(3*t))*Math.cos(2*t), r*(2+Math.cos(3*t))*Math.sin(2*t), r*Math.sin(3*t)));
        }
        curve = new THREE.CatmullRomCurve3(pts); curve.closed = true;
        tubeMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 100, 80, 12, true), new THREE.MeshStandardMaterial({color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.1}));
        scene.add(tubeMesh);
    }

    // 4. THE GAME LOOP
    function animate() {
        requestAnimationFrame(animate);
        if(!gameActive) {
            shipGroup.rotation.y += 0.01;
            camera.position.set(30, 20, 60); camera.lookAt(0,0,0);
        } else {
            const isNitro = keys['shift'] && nitro > 0;
            speed = Math.max(0, Math.min(speed + (keys['w'] ? 0.04 : -0.03), isNitro ? 8.0 : 4.0));
            if (keys['a']) lateral += 4; if (keys['d']) lateral -= 4;
            lateral = Math.max(-70, Math.min(70, lateral));
            progress += speed * 0.00045;

            const p = curve.getPointAt(progress % 1);
            const look = curve.getPointAt((progress + 0.01) % 1);
            if(p && look) {
                shipGroup.position.copy(p); shipGroup.lookAt(look);
                const right = new THREE.Vector3().setFromMatrixColumn(shipGroup.matrix, 0);
                shipGroup.position.addScaledVector(right, -lateral);
                
                // TITAN LOCK: Forces ship to track floor
                const down = new THREE.Vector3(0, -1, 0).applyQuaternion(shipGroup.quaternion);
                shipGroup.position.addScaledVector(down, 45); 

                // ASPHALT CAMERA
                const camGoal = shipGroup.position.clone().add(new THREE.Vector3(0, 15, -45).applyQuaternion(shipGroup.quaternion));
                camera.position.lerp(camGoal, 0.1); camera.lookAt(shipGroup.position);
                
                if(isNitro) { camera.fov = 95; camera.position.x += (Math.random()-0.5)*0.5; } 
                else { camera.fov = 75; }
                camera.updateProjectionMatrix();
            }

            document.getElementById('speedo').innerHTML = Math.floor(speed * 500) + "<span>KM/H</span>";
            document.getElementById('nitro-fill').style.width = nitro + "%";
            if(isNitro) { nitro -= 0.7; thruster.scale.set(4,4,4); } else { if(nitro < 100) nitro += 0.2; thruster.scale.set(1,1,1); }
        }
        renderer.render(scene, camera);
    }

    // 5. START UP LOGIC
    initWorld(); window.generateTrack(); window.buildShip();
    
    // SAFE BINDING
    const startBtn = document.getElementById('start-btn');
    if(startBtn) {
        startBtn.onclick = () => {
            document.getElementById('menu-overlay').style.display = 'none';
            document.getElementById('ui-layer').style.display = 'block';
            gameActive = true;
            
            // Bind buttons ONLY after UI is visible
            const bind = (id, k) => {
                const el = document.getElementById(id);
                if(el) {
                    el.onmousedown = el.ontouchstart = (e) => { e.preventDefault(); keys[k] = true; };
                    el.onmouseup = el.onmouseleave = el.ontouchend = () => keys[k] = false;
                }
            };
            bind('l-btn', 'a'); bind('r-btn', 'd'); bind('g-btn', 'w'); bind('n-btn', 'shift');
        };
    }

    // Key Listeners
    window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

    // Splash Simulation
    let w = 0; const f = document.getElementById('load-fill');
    const iv = setInterval(() => { w += 10; f.style.width = w + '%'; if(w >= 100) { clearInterval(iv); document.getElementById('splash-screen').style.opacity = '0'; setTimeout(() => document.getElementById('splash-screen').style.display = 'none', 1000); } }, 100);

    animate();
});
