// Advanced Image Recognition AR App using OpenCV.js for real image detection

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';
import { AtomModel } from './atom.js';

// Global OpenCV ready flag
window.onOpenCvReady = function() {
    console.log('✅ OpenCV.js is ready');
    window.cvReady = true;
};

class RealImageARApp {
    constructor() {
        // Core components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.video = null;
        this.canvas = null;
        
        // OpenCV components
        this.cvReady = false;
        this.referenceImages = new Map();
        this.detector = null;
        this.matcher = null;
        
        // AR components
        this.currentModel = null;
        this.models = new Map();
        this.isDetecting = false;
        
        // Reference image definitions
        this.imageTargets = [
            {
                id: 'atom',
                name: 'Atom Structure',
                description: 'Interactive 3D atom with protons, neutrons, and electrons orbiting the nucleus.',
                imagePath: 'images/atom-simple.svg',
                keypoints: null,
                descriptors: null
            },
            {
                id: 'molecule',
                name: 'Water Molecule',
                description: 'H₂O molecule showing covalent bonds, polarity, and molecular geometry.',
                imagePath: 'images/water-simple.svg',
                keypoints: null,
                descriptors: null
            }
        ];
        
        // Detection state
        this.lastDetectionTime = 0;
        this.detectionCooldown = 2000;
        this.currentImageType = null;
        this.detectionThreshold = 10; // Minimum matches needed
        
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
            console.log('🚀 Starting Real Image AR App...');
            
            await this.waitForOpenCV();
            await this.setupCamera();
            await this.loadReferenceImages();
            this.setupThreeJS();
            this.setupEventListeners();
            this.setupControls();
            this.startDetection();
            this.animate();
            
            console.log('✅ Real Image AR App initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize AR App:', error);
            this.showError('Failed to initialize. Please ensure camera access and try again.');
        }
    }

    async waitForOpenCV() {
        return new Promise((resolve) => {
            if (window.cvReady) {
                this.cvReady = true;
                resolve();
            } else {
                const checkCV = () => {
                    if (window.cvReady) {
                        this.cvReady = true;
                        resolve();
                    } else {
                        setTimeout(checkCV, 100);
                    }
                };
                checkCV();
            }
        });
    }

    async setupCamera() {
        this.video = document.getElementById('arVideo');
        
        const constraints = {
            video: {
                facingMode: 'environment',
                width: { ideal: 1280, max: 1920 },
                height: { ideal: 720, max: 1080 }
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

    async loadReferenceImages() {
        if (!this.cvReady || !window.cv) {
            console.warn('OpenCV not ready, using fallback detection');
            return;
        }

        console.log('📚 Loading reference images...');
        
        // Initialize OpenCV components
        this.detector = new cv.ORB(500); // ORB feature detector
        this.matcher = new cv.BFMatcher(cv.NORM_HAMMING, true);

        for (const target of this.imageTargets) {
            try {
                const features = await this.extractImageFeatures(target.imagePath);
                target.keypoints = features.keypoints;
                target.descriptors = features.descriptors;
                console.log(`✅ Loaded features for ${target.name}: ${features.keypoints.length} keypoints`);
            } catch (error) {
                console.error(`❌ Failed to load features for ${target.name}:`, error);
            }
        }
    }

    async extractImageFeatures(imagePath) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                try {
                    // Create canvas and draw image
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    
                    // Convert to OpenCV Mat
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const src = cv.matFromImageData(imageData);
                    const gray = new cv.Mat();
                    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
                    
                    // Extract features
                    const keypoints = new cv.KeyPointVector();
                    const descriptors = new cv.Mat();
                    this.detector.detectAndCompute(gray, new cv.Mat(), keypoints, descriptors);
                    
                    // Clean up
                    src.delete();
                    gray.delete();
                    
                    resolve({
                        keypoints: keypoints,
                        descriptors: descriptors
                    });
                } catch (error) {
                    reject(error);
                }
            };
            
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = imagePath;
        });
    }

    setupThreeJS() {
        this.canvas = document.getElementById('arCanvas');
        
        // Scene
        this.scene = new THREE.Scene();
        
        // Camera
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
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(2, 2, 2);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);

        const pointLight = new THREE.PointLight(0xffffff, 0.5);
        pointLight.position.set(-2, 2, 2);
        this.scene.add(pointLight);
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.onTouchEnd(e));
        
        // Mouse events
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
        this.detectRealImages();
        console.log('🔍 Real image detection started');
    }

    detectRealImages() {
        if (!this.isDetecting || !this.video) return;

        try {
            if (this.cvReady && window.cv && this.imageTargets.some(t => t.descriptors)) {
                this.performFeatureMatching();
            } else {
                // Fallback to simple color detection
                this.performSimpleDetection();
            }
        } catch (error) {
            console.error('Detection error:', error);
        }

        // Continue detection
        requestAnimationFrame(() => this.detectRealImages());
    }

    performFeatureMatching() {
        if (!this.detectionCanvas) {
            this.detectionCanvas = document.createElement('canvas');
            this.detectionContext = this.detectionCanvas.getContext('2d');
        }

        // Set canvas size
        this.detectionCanvas.width = this.video.videoWidth || 640;
        this.detectionCanvas.height = this.video.videoHeight || 480;

        // Draw current frame
        this.detectionContext.drawImage(this.video, 0, 0, this.detectionCanvas.width, this.detectionCanvas.height);

        try {
            // Convert to OpenCV Mat
            const imageData = this.detectionContext.getImageData(0, 0, this.detectionCanvas.width, this.detectionCanvas.height);
            const frame = cv.matFromImageData(imageData);
            const gray = new cv.Mat();
            cv.cvtColor(frame, gray, cv.COLOR_RGBA2GRAY);

            // Extract features from current frame
            const keypoints = new cv.KeyPointVector();
            const descriptors = new cv.Mat();
            this.detector.detectAndCompute(gray, new cv.Mat(), keypoints, descriptors);

            if (descriptors.rows > 0) {
                // Match against reference images
                let bestMatch = null;
                let bestScore = 0;

                for (const target of this.imageTargets) {
                    if (!target.descriptors || target.descriptors.rows === 0) continue;

                    try {
                        const matches = new cv.DMatchVector();
                        this.matcher.match(descriptors, target.descriptors, matches);

                        // Filter good matches
                        const goodMatches = [];
                        for (let i = 0; i < matches.size(); i++) {
                            const match = matches.get(i);
                            if (match.distance < 50) { // Threshold for good matches
                                goodMatches.push(match);
                            }
                        }

                        if (goodMatches.length > bestScore && goodMatches.length >= this.detectionThreshold) {
                            bestScore = goodMatches.length;
                            bestMatch = target;
                        }

                        matches.delete();
                    } catch (matchError) {
                        console.warn(`Matching error for ${target.name}:`, matchError);
                    }
                }

                if (bestMatch) {
                    console.log(`🎯 Image matched: ${bestMatch.name} (${bestScore} matches)`);
                    this.onImageDetected(bestMatch.id);
                }
            }

            // Clean up
            frame.delete();
            gray.delete();
            keypoints.delete();
            descriptors.delete();

        } catch (error) {
            console.error('Feature matching error:', error);
            // Fallback to simple detection
            this.performSimpleDetection();
        }
    }

    performSimpleDetection() {
        // Fallback detection method using color analysis
        if (!this.detectionCanvas) {
            this.detectionCanvas = document.createElement('canvas');
            this.detectionContext = this.detectionCanvas.getContext('2d');
        }

        this.detectionCanvas.width = this.video.videoWidth || 640;
        this.detectionCanvas.height = this.video.videoHeight || 480;
        this.detectionContext.drawImage(this.video, 0, 0, this.detectionCanvas.width, this.detectionCanvas.height);

        const imageData = this.detectionContext.getImageData(0, 0, this.detectionCanvas.width, this.detectionCanvas.height);
        const detected = this.analyzeImageColors(imageData);
        
        if (detected.target) {
            this.onImageDetected(detected.target);
        }
    }

    analyzeImageColors(imageData) {
        const data = imageData.data;
        let redPixels = 0, bluePixels = 0, greenPixels = 0, orangePixels = 0;
        
        // Sample pixels for color analysis
        for (let i = 0; i < data.length; i += 16) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Detect colors specific to our reference images
            if (r > 180 && g < 100 && b < 100) redPixels++; // Red (oxygen, protons)
            if (r < 100 && g < 150 && b > 180) bluePixels++; // Blue (neutrons)
            if (r < 150 && g > 180 && b < 150) greenPixels++; // Green (electrons)
            if (r > 200 && g > 150 && b < 100) orangePixels++; // Orange (nucleus glow)
        }
        
        const threshold = 30;
        
        // Atom detection: red + blue + green + orange (multi-colored scientific diagram)
        if (redPixels > threshold && bluePixels > threshold/2 && (greenPixels > threshold/3 || orangePixels > threshold/2)) {
            return { target: 'atom', confidence: redPixels + bluePixels + greenPixels };
        }
        
        // Water molecule detection: predominantly red and blue with some white
        if (redPixels > threshold && bluePixels > threshold/2 && greenPixels < threshold/2) {
            return { target: 'molecule', confidence: redPixels + bluePixels };
        }
        
        return { target: null };
    }

    onImageDetected(imageId) {
        const now = Date.now();
        
        if (now - this.lastDetectionTime < this.detectionCooldown || this.currentImageType === imageId) {
            return;
        }
        
        console.log(`🎯 Real image detected: ${imageId}`);
        
        const target = this.imageTargets.find(t => t.id === imageId);
        if (!target) return;

        // Remove current model
        if (this.currentModel) {
            console.log(`🗑️ Removing previous model: ${this.currentImageType}`);
            this.scene.remove(this.currentModel);
            if (this.currentModel.dispose) {
                this.currentModel.dispose();
            }
            this.currentModel = null;
        }

        // Create new model
        console.log(`✨ Spawning model for: ${target.name}`);
        this.currentModel = this.createModel(imageId);
        if (this.currentModel) {
            this.scene.add(this.currentModel);
            this.showModelInfo(target);
            this.showControls();
            this.hideModelSelector();
            
            this.currentImageType = imageId;
            this.lastDetectionTime = now;
            
            this.showTemporaryMessage(`${target.name} detected! 🎉`);
        }
    }

    createModel(type) {
        let model;
        
        switch (type) {
            case 'atom':
                const atom = new AtomModel();
                model = atom.getGroup();
                model.scale.setScalar(0.3);
                model.position.set(0, 0, -1);
                break;
                
            case 'molecule':
                model = this.createWaterMolecule();
                model.scale.setScalar(0.5);
                model.position.set(0, 0, -1);
                break;
                
            default:
                console.warn('Unknown model type:', type);
                return null;
        }
        
        model.userData.type = type;
        model.userData.originalScale = model.scale.x;
        model.userData.originalPosition = model.position.clone();
        
        return model;
    }

    createWaterMolecule() {
        const molecule = new THREE.Group();
        
        // Oxygen atom
        const oxygenGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const oxygenMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xff4444,
            metalness: 0.1,
            roughness: 0.3
        });
        const oxygen = new THREE.Mesh(oxygenGeometry, oxygenMaterial);
        molecule.add(oxygen);
        
        // Hydrogen atoms
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
        
        // Bonds
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

    // Touch and mouse event handlers (same as before)
    onTouchStart(event) {
        event.preventDefault();
        if (!this.currentModel) return;

        if (event.touches.length === 1) {
            this.isDragging = true;
            this.previousTouch.x = event.touches[0].clientX;
            this.previousTouch.y = event.touches[0].clientY;
        } else if (event.touches.length === 2) {
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
    showModelInfo(target) {
        const modelInfo = document.getElementById('modelInfo');
        const modelTitle = document.getElementById('modelTitle');
        const modelDescription = document.getElementById('modelDescription');
        
        if (modelInfo && modelTitle && modelDescription) {
            modelTitle.textContent = target.name;
            modelDescription.textContent = target.description;
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
        
        if (this.currentModel && this.currentModel.animate) {
            this.currentModel.animate(0.016);
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
        `;
        
        messageDiv.textContent = message;
        document.body.appendChild(messageDiv);
        
        setTimeout(() => messageDiv.remove(), duration);
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
        
        // Clean up OpenCV resources
        if (this.detector) this.detector.delete();
        if (this.matcher) this.matcher.delete();
        
        for (const target of this.imageTargets) {
            if (target.keypoints) target.keypoints.delete();
            if (target.descriptors) target.descriptors.delete();
        }
        
        if (this.currentModel && this.currentModel.dispose) {
            this.currentModel.dispose();
        }
        
        console.log('🧹 Real Image AR App disposed');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Starting Real Image AR App...');
    window.realImageARApp = new RealImageARApp();
});

window.addEventListener('beforeunload', () => {
    if (window.realImageARApp) {
        window.realImageARApp.dispose();
    }
});

export { RealImageARApp };