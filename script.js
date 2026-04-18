import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// Configuration
const config = {
    name: 'Hằng',
    particleCount: 15000,
    particleColor: 0xff0080, // Pink
    heartSize: 15,
    textSize: 4,
    transitionDuration: 2.5
};

// Scene Variables
let scene, camera, renderer, composer, controls, bloomPass;
let particles, geometry, material;
let isHeart = false;
let currentPoints = [];
let targetPoints = [];
let namePoints = [];
let heartPoints = [];

// Initialize Scene
async function init() {
    console.log("Initializing Scene...");
    try {
        scene = new THREE.Scene();
        
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 30;

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.getElementById('container').appendChild(renderer.domElement);
        console.log("Renderer attached.");

        // Controls
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.5;

        // Post Processing (Bloom)
        const renderScene = new RenderPass(scene, camera);
        bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.6, // Initial low strength for text
            0.5,
            0.1
        );
        
        composer = new EffectComposer(renderer);
        composer.addPass(renderScene);
        composer.addPass(bloomPass);

        // Wait for fonts to load with timeout
        console.log("Waiting for fonts...");
        const fontTimeout = new Promise(resolve => setTimeout(resolve, 2000));
        await Promise.race([document.fonts.ready, fontTimeout]);
        console.log("Fonts ready (or timed out).");
        
        // Generate Point Sets
        generatePoints();
        createParticleSystem();
        console.log("Particle system created.");

        // Event Listeners
        window.addEventListener('resize', onWindowResize);
        window.addEventListener('mousedown', (e) => {
            if (!e.target.closest('.ui')) toggleMorph();
        });
        window.addEventListener('touchstart', (e) => {
            if (!e.target.closest('.ui')) {
                e.preventDefault();
                toggleMorph();
            }
        });

        // UI Listeners
        const nameInput = document.getElementById('nameInput');
        const changeBtn = document.getElementById('changeBtn');

        changeBtn.addEventListener('click', () => {
            updateName(nameInput.value);
        });

        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                updateName(nameInput.value);
            }
        });

        animate();
    } catch (error) {
        console.error("Initialization failed:", error);
    }
}

function updateName(newName) {
    if (!newName || newName === config.name) return;
    
    config.name = newName;
    console.log("Updating name to:", config.name);
    
    const rawNamePoints = sampleTextPoints(config.name);
    namePoints = fillPoints(rawNamePoints, config.particleCount);
    
    isHeart = false;
    triggerMorph(namePoints);
}

function sampleTextPoints(name) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 1000;
    canvas.height = 300;
    
    ctx.fillStyle = '#fff';
    ctx.font = '900 200px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, canvas.width / 2, canvas.height / 2);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const samplingRatio = 2;
    
    const points = [];
    for (let y = 0; y < canvas.height; y += samplingRatio) {
        for (let x = 0; x < canvas.width; x += samplingRatio) {
            const index = (y * canvas.width + x) * 4;
            if (pixels[index + 3] > 128) {
                points.push({
                    x: (x - canvas.width / 2) * (config.textSize / 100),
                    y: -(y - canvas.height / 2) * (config.textSize / 100),
                    z: (Math.random() - 0.5) * 2
                });
            }
        }
    }
    return points;
}

function generatePoints() {
    const rawNamePoints = sampleTextPoints(config.name);
    namePoints = fillPoints(rawNamePoints, config.particleCount);

    const rawHeartPoints = [];
    for (let i = 0; i < config.particleCount; i++) {
        const t = Math.random() * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        
        const scale = config.heartSize / 16;
        const volume = (Math.random() * 2) + 1;
        rawHeartPoints.push({
            x: x * scale * volume * 0.8,
            y: y * scale * volume * 0.8,
            z: (Math.random() - 0.5) * 5 * volume
        });
    }

    heartPoints = fillPoints(rawHeartPoints, config.particleCount);
}

function fillPoints(source, targetCount) {
    const result = [];
    if (source.length === 0) {
        for (let i = 0; i < targetCount * 3; i++) result.push(0);
        return new Float32Array(result);
    }
    for (let i = 0; i < targetCount; i++) {
        const point = source[i % source.length];
        result.push(point.x, point.y, point.z);
    }
    return new Float32Array(result);
}

function createParticleSystem() {
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(namePoints), 3));
    
    const colors = new Float32Array(config.particleCount * 3);
    for (let i = 0; i < config.particleCount; i++) {
        const mix = Math.random();
        colors[i * 3] = 1; 
        colors[i * 3 + 1] = 0.2 + mix * 0.5; 
        colors[i * 3 + 2] = 0.5 + mix * 0.5; 
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    material = new THREE.PointsMaterial({
        size: 0.1, // Reduced size for clearer text
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);
}

function toggleMorph() {
    isHeart = !isHeart;
    const targetSet = isHeart ? heartPoints : namePoints;
    triggerMorph(targetSet);
}

function triggerMorph(targetSet) {
    const positions = geometry.attributes.position.array;
    
    // Animate bloom strength for legibility
    gsap.to(bloomPass, {
        strength: isHeart ? 1.2 : 0.4, // Less glow for name, more for heart
        duration: 2,
        ease: "power2.inOut"
    });

    for (let i = 0; i < config.particleCount; i++) {
        const i3 = i * 3;
        gsap.to(positions, {
            [i3]: targetSet[i3],
            [i3 + 1]: targetSet[i3 + 1],
            [i3 + 2]: targetSet[i3 + 2],
            duration: config.transitionDuration + Math.random() * 1.5,
            ease: "expo.inOut",
            onUpdate: () => {
                geometry.attributes.position.needsUpdate = true;
            }
        });
    }

    gsap.to(camera.position, {
        z: isHeart ? 40 : 30,
        duration: 2,
        ease: "power2.inOut"
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) composer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    
    const time = Date.now() * 0.001;
    if (particles) {
        particles.rotation.y += 0.001;
        particles.position.y = Math.sin(time) * 0.5;
    }

    if (composer) composer.render();
}

init();
