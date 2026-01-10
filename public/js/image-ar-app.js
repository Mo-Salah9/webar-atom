// Image-based AR App with Three.js and simple marker recognition

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';
import { AtomModel } from './atom.js';

class ImageARApp {
    constructor() {
        // Core components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.video = null;
        this.canvas = null;
        
        // AR components
        this.currentModel = null;
        this.models = new Map(); // Store different models
        this.isDetecting = false;
        
        // Marker detection
        this.markers = [
            {
                id: 'atom',
                name: 'Atom Model',
                description: 'Interactive 3D atom visualization showing protons, neutrons, and electrons.',
                color: '#ff3333',
                detected: false
            },
            {
                id: 'molecule',
                name: 'Molecule Model', 
                description: 'Water molecule (H2O) showing atomic bonds and structure.',
                color: '#3333ff',
                detected: false
            }
        ];
        
        // Detection state
        this.lastDetectionTime = 0;
        this.detectionCooldown = 2000; // 2 seconds between switches
        this.currentMarkerType = null;
        
        // Interaction state
        this.isDragging = false;
        this.isScaling = false;
        this.previousTouch = { x: 0, y: 0 };
        this.initialPinchDistance = 0;
        this.rotationSpeed = 0.01;
        this.scaleSpeed = 0.01;
        
        this.init();
    }

    async init() {
        try {
            console.log('🚀 Starting Image-based AR App...');
            
            await this.setupCamera();
            this.setupThreeJS();
            this.setupEventListeners();
            this.setupControls();
            this.startDetection();
            this.animate();
            
            console.log('✅ Image AR App initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize AR App:', error);
            this.showError('Failed to initialize camera. Please allow camera access and try again.');
        }
    }

    async setupCamera() {
        this.video = document.getElementById('arVideo');
        
        const constraints = {
            video: {
                facingMode: 'environment', // Use back camera
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = stream;
            
            return new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    console.log('📹 Camera initialized');
                    resolve();
                };
            });
        } catch (error) {
            console.error('Camera access error:', error);
            throw error;
        }
    }

    setupThreeJS() {
        this.canvas = document.getElementById('arCanvas');
        
        // Scene
        this.scene = new THREE.Scene();
        
        // Camera - match video aspect ratio
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        this.camera.position.set(0, 0, 2);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas,
            alpha: true,
            antialias: true 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Lighting
        this.setupLighting();
        
        console.log('🎨 Three.js setup complete');
    }

    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(2, 2, 2);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);

        // Point light for better illumination
        const pointLight = new THREE.PointLight(0xffffff, 0.5);
        pointLight.position.set(-2, 2, 2);
        this.scene.add(pointLight);
    }

    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Touch events for model manipulation
        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.onTouchEnd(e));
        
        // Mouse events for desktop
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
    }

    setupControls() {
        const rotateBtn = document.getElementById('rotateBtn');
        const scaleUpBtn = document.getElementById('scaleUpBtn');
        const scaleDownBtn = document.getElementById('scaleDownBtn');
        const resetBtn = document.getElementById('resetBtn');

        if (rotateBtn) rotateBtn.addEventListener('click', () => this.autoRotateModel());
        if (scaleUpBtn) scaleUpBtn.addEventListener('click', () => this.scaleModel(1.2));
        if (scaleDownBtn) scaleDownBtn.addEventListener('click', () => this.scaleModel(0.8));
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetModel());
    }

    startDetection() {
        this.isDetecting = true;
        this.detectMarkers();
        console.log('🔍 Marker detection started');
    }

    detectMarkers() {
        if (!this.isDetecting || !this.video) return;

        // Create a canvas for image processing
        if (!this.detectionCanvas) {
            this.detectionCanvas = document.createElement('canvas');
            this.detectionContext = this.detectionCanvas.getContext('2d');
        }

        // Set canvas size to match video
        this.detectionCanvas.width = this.video.videoWidth || 640;
        this.detectionCanvas.height = this.video.videoHeight || 480;

        // Draw current video frame to canvas
        this.detectionContext.drawImage(this.video, 0, 0, this.detectionCanvas.width, this.detectionCanvas.height);

        // Get image data for processing
        const imageData = this.detectionContext.getImageData(0, 0, this.detectionCanvas.width, this.detectionCanvas.height);
        
        // Simple color-based detection (looking for our marker colors)
        const detected = this.simpleColorDetection(imageData);
        
        if (detected.marker) {
            this.onMarkerDetected(detected.marker);
        }

        // Continue detection
        requestAnimationFrame(() => this.detectMarkers());
    }

    simpleColorDetection(imageData) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        let redPixels = 0;
        let bluePixels = 0;
        let blackPixels = 0;
        
        // Sample pixels to detect marker colors
        for (let i = 0; i < data.length; i += 16) { // Sample every 4th pixel
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Detect red (atom marker nucleus)
            if (r > 200 && g < 100 && b < 100) {
                redPixels++;
            }
            
            // Detect blue (molecule marker)
            if (r < 100 && g < 150 && b > 200) {
                bluePixels++;
            }
            
            // Detect black (marker borders)
            if (r < 50 && g < 50 && b < 50) {
                blackPixels++;
            }
        }
        
        // Simple threshold-based detection
        const threshold = 50;
        
        if (redPixels > threshold && blackPixels > threshold * 2) {
            return { marker: 'atom', confidence: redPixels };
        } else if (bluePixels > threshold && blackPixels > threshold * 2) {
            return { marker: 'molecule', confidence: bluePixels };
        }
        
        return { marker: null };
    }

    onMarkerDetected(markerId) {
        const now = Date.now();
        
        // Check cooldown and if it's a different marker
        if (now - this.lastDetectionTime < this.detectionCooldown || this.currentMarkerType === markerId) {
            return;
        }
        
        console.log(`🎯 Marker detected: ${markerId}`);
        
        const marker = this.markers.find(m => m.id === markerId);
        if (!marker) return;

        // Remove current model if exists
        if (this.currentModel) {
            console.log(`🗑️ Removing previous model: ${this.currentMarkerType}`);
            this.scene.remove(this.currentModel);
            if (this.currentModel.dispose) {
                this.currentModel.dispose();
            }
            this.currentModel = null;
        }

        // Create and add new model
        console.log(`✨ Spawning new model: ${markerId}`);
        this.currentModel = this.createModel(markerId);
        if (this.currentModel) {
            this.scene.add(this.currentModel);
            this.showModelInfo(marker);
            this.showControls();
            this.hideModelSelector();
            
            this.currentMarkerType = markerId;
            this.lastDetectionTime = now;
            
            // Show success message
            this.showTemporaryMessage(`${marker.name} spawned! 🎉`);
        }
    }

    createModel(type) {
        let model;
        
        switch (type) {
            case 'atom':
                // Create atom model
                const atom = new AtomModel();
                model = atom.getGroup();
                model.scale.setScalar(0.3);
                model.position.set(0, 0, -1);
                break;
                
            case 'molecule':
                // Create simple water molecule
                model = this.createWaterMolecule();
                model.scale.setScalar(0.5);
                model.position.set(0, 0, -1);
                break;
                
            default:
                console.warn('Unknown model type:', type);
                return null;
        }
        
        // Add common properties
        model.userData.type = type;
        model.userData.originalScale = model.scale.x;
        model.userData.originalPosition = model.position.clone();
        
        return model;
    }

    createWaterMolecule() {
        const molecule = new THREE.Group();
        
        // Oxygen atom (red)
        const oxygenGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const oxygenMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xff4444,
            metalness: 0.1,
            roughness: 0.3
        });
        const oxygen = new THREE.Mesh(oxygenGeometry, oxygenMaterial);
        oxygen.position.set(0, 0, 0);
        molecule.add(oxygen);
        
        // Hydrogen atoms (white)
        const hydrogenGeometry = new THREE.SphereGeometry(0.05, 12, 12);
        const hydrogenMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            metalness: 0.1,
            roughness: 0.3
        });
        
        const hydrogen1 = new THREE.Mesh(hydrogenGeometry, hydrogenMaterial);
        hydrogen1.position.set(0.15, 0.1, 0);
        molecule.add(hydrogen1);
        
        const hydrogen2 = new THREE.Mesh(hydrogenGeometry, hydrogenMaterial);
        hydrogen2.position.set(0.15, -0.1, 0);
        molecule.add(hydrogen2);
        
        // Bonds (cylinders)
        const bondGeometry = new THREE.CylinderGeometry(0.01, 0.01, 0.15);
        const bondMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
        
        const bond1 = new THREE.Mesh(bondGeometry, bondMaterial);
        bond1.position.set(0.075, 0.05, 0);
        bond1.rotation.z = -Math.PI / 6;
        molecule.add(bond1);
        
        const bond2 = new THREE.Mesh(bondGeometry, bondMaterial);
        bond2.position.set(0.075, -0.05, 0);
        bond2.rotation.z = Math.PI / 6;
        molecule.add(bond2);
        
        return molecule;
    }

    // Touch event handlers
    onTouchStart(event) {
        event.preventDefault();
        if (!this.currentModel) return;

        if (event.touches.length === 1) {
            // Single touch - rotation
            this.isDragging = true;
            this.previousTouch.x = event.touches[0].clientX;
            this.previousTouch.y = event.touches[0].clientY;
        } else if (event.touches.length === 2) {
            // Two touches - scaling
            this.isScaling = true;
            this.isDragging = false;
            const dx = event.touches[0].clientX - event.touches[1].clientX;
            const dy = event.touches[0].clientY - event.touches[1].clientY;
            this.initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
        }
    }

    onTouchMove(event) {
        event.preventDefault();
        if (!this.currentModel) return;

        if (this.isDragging && event.touches.length === 1) {
            const deltaX = event.touches[0].clientX - this.previousTouch.x;
            const deltaY = event.touches[0].clientY - this.previousTouch.y;
            
            this.currentModel.rotation.y += deltaX * this.rotationSpeed;
            this.currentModel.rotation.x += deltaY * this.rotationSpeed;
            
            this.previousTouch.x = event.touches[0].clientX;
            this.previousTouch.y = event.touches[0].clientY;
        } else if (this.isScaling && event.touches.length === 2) {
            const dx = event.touches[0].clientX - event.touches[1].clientX;
            const dy = event.touches[0].clientY - event.touches[1].clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            const scale = distance / this.initialPinchDistance;
            const newScale = this.currentModel.userData.originalScale * scale;
            this.currentModel.scale.setScalar(Math.max(0.1, Math.min(2, newScale)));
        }
    }

    onTouchEnd(event) {
        event.preventDefault();
        this.isDragging = false;
        this.isScaling = false;
    }

    // Mouse event handlers
    onMouseDown(event) {
        if (!this.currentModel) return;
        this.isDragging = true;
        this.previousTouch.x = event.clientX;
        this.previousTouch.y = event.clientY;
    }

    onMouseMove(event) {
        if (!this.currentModel || !this.isDragging) return;
        
        const deltaX = event.clientX - this.previousTouch.x;
        const deltaY = event.clientY - this.previousTouch.y;
        
        this.currentModel.rotation.y += deltaX * this.rotationSpeed;
        this.currentModel.rotation.x += deltaY * this.rotationSpeed;
        
        this.previousTouch.x = event.clientX;
        this.previousTouch.y = event.clientY;
    }

    onMouseUp(event) {
        this.isDragging = false;
    }

    onWheel(event) {
        if (!this.currentModel) return;
        event.preventDefault();
        
        const scale = event.deltaY > 0 ? 0.9 : 1.1;
        this.scaleModel(scale);
    }

    // Control methods
    autoRotateModel() {
        if (!this.currentModel) return;
        
        // Simple auto-rotation animation
        const rotateAnimation = () => {
            if (this.currentModel) {
                this.currentModel.rotation.y += 0.02;
                requestAnimationFrame(rotateAnimation);
            }
        };
        rotateAnimation();
    }

    scaleModel(factor) {
        if (!this.currentModel) return;
        
        const currentScale = this.currentModel.scale.x;
        const newScale = Math.max(0.1, Math.min(3, currentScale * factor));
        this.currentModel.scale.setScalar(newScale);
    }

    resetModel() {
        if (!this.currentModel) return;
        
        this.currentModel.scale.setScalar(this.currentModel.userData.originalScale);
        this.currentModel.position.copy(this.currentModel.userData.originalPosition);
        this.currentModel.rotation.set(0, 0, 0);
    }

    // UI methods
    showModelInfo(marker) {
        const modelInfo = document.getElementById('modelInfo');
        const modelTitle = document.getElementById('modelTitle');
        const modelDescription = document.getElementById('modelDescription');
        
        if (modelInfo && modelTitle && modelDescription) {
            modelTitle.textContent = marker.name;
            modelDescription.textContent = marker.description;
            modelInfo.classList.add('visible');
        }
    }

    showControls() {
        const controls = document.getElementById('manipulationControls');
        if (controls) {
            controls.classList.remove('hidden');
        }
    }

    hideModelSelector() {
        const selector = document.getElementById('modelSelector');
        if (selector) {
            selector.style.display = 'none';
        }
    }

    onWindowResize() {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Animate current model if it exists
        if (this.currentModel && this.currentModel.animate) {
            this.currentModel.animate(0.016); // ~60fps
        }
        
        this.renderer.render(this.scene, this.camera);
    }

    showTemporaryMessage(message, duration = 3000) {
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            top: 20%;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(76, 205, 196, 0.9);
            color: white;
            padding: 15px 25px;
            border-radius: 25px;
            z-index: 1000;
            text-align: center;
            font-size: 16px;
            font-weight: bold;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease-out;
        `;
        
        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
                to { transform: translateX(-50%) translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        messageDiv.textContent = message;
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.remove();
            style.remove();
        }, duration);
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 0, 0, 0.9);
            color: white;
            padding: 20px;
            border-radius: 10px;
            z-index: 1000;
            text-align: center;
            max-width: 300px;
        `;
        errorDiv.innerHTML = `
            <h3>⚠️ Error</h3>
            <p>${message}</p>
            <button onclick="this.parentElement.remove()" 
                    style="background: white; color: red; border: none; padding: 10px 20px; border-radius: 5px; margin-top: 10px; cursor: pointer;">
                Close
            </button>
        `;
        document.body.appendChild(errorDiv);
    }

    dispose() {
        this.isDetecting = false;
        
        if (this.video && this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
        }
        
        if (this.currentModel && this.currentModel.dispose) {
            this.currentModel.dispose();
        }
        
        console.log('🧹 Image AR App disposed');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Starting Image-based AR App...');
    window.imageARApp = new ImageARApp();
});

// Handle app lifecycle
window.addEventListener('beforeunload', () => {
    if (window.imageARApp) {
        window.imageARApp.dispose();
    }
});

export { ImageARApp };