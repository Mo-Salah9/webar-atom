// Simple, reliable AR app with manual start button
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';
import { AtomModel } from './atom.js';

class SimpleARApp {
    constructor() {
        // Core components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.video = null;
        this.canvas = null;
        
        // AR state
        this.currentModel = null;
        this.isDetecting = false;
        this.isStarted = false;
        
        // Detection state
        this.lastDetectionTime = 0;
        this.detectionCooldown = 2000;
        this.currentImageType = null;
        
        // Interaction
        this.isDragging = false;
        this.isScaling = false;
        this.previousTouch = { x: 0, y: 0 };
        this.initialPinchDistance = 0;
        this.rotationSpeed = 0.01;
        
        this.init();
    }

    init() {
        console.log('🚀 Starting Simple AR App...');
        this.setupStartButton();
        this.setupUI();
    }

    setupStartButton() {
        // Create start button
        const startButton = document.createElement('button');
        startButton.id = 'startARButton';
        startButton.className = 'ar-button';
        startButton.textContent = '📸 Start AR Camera';
        startButton.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(45deg, #f31e1e, #4ECDC4);
            color: white;
            border: none;
            border-radius: 25px;
            padding: 15px 30px;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            z-index: 1000;
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
        `;
        
        startButton.addEventListener('click', () => this.startAR());
        document.body.appendChild(startButton);
        
        console.log('✅ Start button created');
    }

    setupUI() {
        // Hide model selector initially
        const modelSelector = document.getElementById('modelSelector');
        if (modelSelector) {
            modelSelector.style.display = 'block';
        }
    }

    async startAR() {
        const startButton = document.getElementById('startARButton');
        if (startButton) {
            startButton.textContent = '⏳ Starting Camera...';
            startButton.disabled = true;
        }

        try {
            await this.setupCamera();
            this.setupThreeJS();
            this.setupEventListeners();
            this.setupControls();
            this.startDetection();
            this.animate();
            
            // Hide start button and model selector
            if (startButton) startButton.style.display = 'none';
            const modelSelector = document.getElementById('modelSelector');
            if (modelSelector) modelSelector.style.display = 'none';
            
            this.isStarted = true;
            this.showTemporaryMessage('📸 Camera started! Point at test images to spawn 3D models');
            this.createStatusDisplay();
            
            console.log('✅ AR started successfully');
            
        } catch (error) {
            console.error('❌ Failed to start AR:', error);
            this.showError('Failed to access camera. Please allow camera permissions and try again.');
            
            if (startButton) {
                startButton.textContent = '📸 Try Again';
                startButton.disabled = false;
            }
        }
    }

    async setupCamera() {
        this.video = document.getElementById('arVideo');
        
        const constraints = {
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = stream;
            
            return new Promise((resolve, reject) => {
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    console.log('📹 Camera initialized');
                    resolve();
                };
                
                this.video.onerror = () => {
                    reject(new Error('Video failed to load'));
                };
                
                // Timeout after 10 seconds
                setTimeout(() => {
                    reject(new Error('Camera initialization timeout'));
                }, 10000);
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
        
        // Keyboard shortcuts for testing
        document.addEventListener('keydown', (e) => {
            if (e.key === '1') {
                console.log('⌨️ Keyboard shortcut: Spawning Atom');
                this.onImageDetected('atom');
            } else if (e.key === '2') {
                console.log('⌨️ Keyboard shortcut: Spawning Water Molecule');
                this.onImageDetected('molecule');
            } else if (e.key === 'd' || e.key === 'D') {
                this.toggleDebugMode();
            }
        });
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
        
        // Add debug buttons
        this.addDebugButtons();
    }
    
    addDebugButtons() {
        const debugContainer = document.createElement('div');
        debugContainer.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            z-index: 1001;
        `;
        
        // Test Atom Button
        const testAtomBtn = document.createElement('button');
        testAtomBtn.textContent = '🔬 Test Atom';
        testAtomBtn.style.cssText = `
            background: #ff3333;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 5px;
            font-size: 12px;
            cursor: pointer;
        `;
        testAtomBtn.addEventListener('click', () => {
            console.log('🧪 Manual atom test');
            this.onImageDetected('atom');
        });
        
        // Test Molecule Button
        const testMoleculeBtn = document.createElement('button');
        testMoleculeBtn.textContent = '💧 Test H2O';
        testMoleculeBtn.style.cssText = `
            background: #3333ff;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 5px;
            font-size: 12px;
            cursor: pointer;
        `;
        testMoleculeBtn.addEventListener('click', () => {
            console.log('🧪 Manual molecule test');
            this.onImageDetected('molecule');
        });
        
        // Debug Info Button
        const debugBtn = document.createElement('button');
        debugBtn.textContent = '🐛 Debug';
        debugBtn.style.cssText = `
            background: #666;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 5px;
            font-size: 12px;
            cursor: pointer;
        `;
        debugBtn.addEventListener('click', () => this.toggleDebugMode());
        
        debugContainer.appendChild(testAtomBtn);
        debugContainer.appendChild(testMoleculeBtn);
        debugContainer.appendChild(debugBtn);
        document.body.appendChild(debugContainer);
    }
    
    toggleDebugMode() {
        this.debugMode = !this.debugMode;
        console.log(`🐛 Debug mode: ${this.debugMode ? 'ON' : 'OFF'}`);
        
        if (this.debugMode) {
            this.showDebugCanvas();
        } else {
            this.hideDebugCanvas();
        }
    }
    
    showDebugCanvas() {
        if (!this.debugCanvas) {
            this.debugCanvas = document.createElement('canvas');
            this.debugCanvas.style.cssText = `
                position: fixed;
                top: 10px;
                left: 10px;
                width: 200px;
                height: 150px;
                border: 2px solid #fff;
                z-index: 1000;
                background: black;
            `;
            document.body.appendChild(this.debugCanvas);
        }
        this.debugCanvas.style.display = 'block';
    }
    
    hideDebugCanvas() {
        if (this.debugCanvas) {
            this.debugCanvas.style.display = 'none';
        }
    }

    startDetection() {
        this.isDetecting = true;
        this.detectImages();
        console.log('🔍 Image detection started');
    }

    detectImages() {
        if (!this.isDetecting || !this.video || !this.isStarted) return;

        try {
            this.performColorDetection();
        } catch (error) {
            console.error('Detection error:', error);
        }

        // Continue detection
        requestAnimationFrame(() => this.detectImages());
    }

    performColorDetection() {
        if (!this.detectionCanvas) {
            this.detectionCanvas = document.createElement('canvas');
            this.detectionContext = this.detectionCanvas.getContext('2d');
        }

        // Set canvas size
        this.detectionCanvas.width = this.video.videoWidth || 640;
        this.detectionCanvas.height = this.video.videoHeight || 480;

        // Draw current frame
        this.detectionContext.drawImage(this.video, 0, 0, this.detectionCanvas.width, this.detectionCanvas.height);

        // Show debug canvas if enabled
        if (this.debugMode && this.debugCanvas) {
            const debugCtx = this.debugCanvas.getContext('2d');
            debugCtx.drawImage(this.video, 0, 0, 200, 150);
        }

        // Get image data
        const imageData = this.detectionContext.getImageData(0, 0, this.detectionCanvas.width, this.detectionCanvas.height);
        const detected = this.analyzeImageColors(imageData);
        
        if (detected.target) {
            this.onImageDetected(detected.target);
        }
    }

    analyzeImageColors(imageData) {
        const data = imageData.data;
        let redPixels = 0, greenPixels = 0, whitePixels = 0, blackPixels = 0, bluePixels = 0;
        let totalPixels = 0;
        
        // Sample every 16th pixel for performance
        for (let i = 0; i < data.length; i += 64) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            totalPixels++;
            
            // More flexible color detection
            if (r > 150 && g < 120 && b < 120) redPixels++; // Red (more flexible)
            if (r < 120 && g > 150 && b < 120) greenPixels++; // Green (more flexible)
            if (r > 180 && g > 180 && b > 180) whitePixels++; // White
            if (r < 100 && g < 100 && b < 100) blackPixels++; // Black
            if (r < 120 && g < 120 && b > 150) bluePixels++; // Blue
        }
        
        const threshold = 10; // Even lower threshold
        const percentage = (pixels) => (pixels / totalPixels) * 100;
        
        console.log(`Color analysis: Red=${redPixels}(${percentage(redPixels).toFixed(1)}%), Green=${greenPixels}(${percentage(greenPixels).toFixed(1)}%), White=${whitePixels}(${percentage(whitePixels).toFixed(1)}%), Black=${blackPixels}(${percentage(blackPixels).toFixed(1)}%), Blue=${bluePixels}(${percentage(bluePixels).toFixed(1)}%)`);
        
        // More flexible detection logic
        if (redPixels > threshold && blackPixels > threshold) {
            if (greenPixels > threshold/2) {
                console.log('🎯 ATOM detected - Red + Green + Black pattern');
                return { target: 'atom', confidence: redPixels + greenPixels };
            } else if (whitePixels > threshold) {
                console.log('🎯 MOLECULE detected - Red + White + Black pattern');
                return { target: 'molecule', confidence: redPixels + whitePixels };
            }
        }
        
        // Fallback: Any significant color pattern
        if (redPixels > threshold/2 || greenPixels > threshold/2 || bluePixels > threshold/2) {
            console.log('🔍 Pattern detected but not classified');
        }
        
        return { target: null };
    }

    onImageDetected(imageId) {
        const now = Date.now();
        
        if (now - this.lastDetectionTime < this.detectionCooldown || this.currentImageType === imageId) {
            return;
        }
        
        console.log(`🎯 Image detected: ${imageId}`);
        this.updateStatus(`${imageId} detected at ${new Date().toLocaleTimeString()}`);

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
        console.log(`✨ Spawning model: ${imageId}`);
        this.currentModel = this.createModel(imageId);
        if (this.currentModel) {
            this.scene.add(this.currentModel);
            this.showControls();
            this.showModelInfo(imageId);
            
            this.currentImageType = imageId;
            this.lastDetectionTime = now;
            
            const modelName = imageId === 'atom' ? 'Atom Structure' : 'Water Molecule';
            this.showTemporaryMessage(`${modelName} detected! 🎉`);
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

    // Touch and mouse event handlers
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
    showModelInfo(imageId) {
        const modelInfo = document.getElementById('modelInfo');
        const modelTitle = document.getElementById('modelTitle');
        const modelDescription = document.getElementById('modelDescription');
        
        if (modelInfo && modelTitle && modelDescription) {
            if (imageId === 'atom') {
                modelTitle.textContent = 'Atom Structure';
                modelDescription.textContent = 'Interactive 3D atom with nucleus, protons, neutrons, and electrons.';
            } else {
                modelTitle.textContent = 'Water Molecule';
                modelDescription.textContent = 'H₂O molecule showing oxygen and hydrogen atoms with covalent bonds.';
            }
            modelInfo.classList.add('visible');
        }
    }

    showControls() {
        const controls = document.getElementById('manipulationControls');
        if (controls) {
            controls.classList.remove('hidden');
        }
    }

    onWindowResize() {
        if (!this.camera || !this.renderer) return;
        
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
        
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
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
    
    createStatusDisplay() {
        const statusDiv = document.createElement('div');
        statusDiv.id = 'statusDisplay';
        statusDiv.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-size: 12px;
            z-index: 1000;
            max-width: 300px;
        `;
        statusDiv.innerHTML = `
            <div>🔍 Detection: Active</div>
            <div>📹 Camera: ${this.video ? 'Ready' : 'Not Ready'}</div>
            <div>🎯 Last Detection: None</div>
            <div>⌨️ Press 1=Atom, 2=Water, D=Debug</div>
        `;
        document.body.appendChild(statusDiv);
        
        this.statusDiv = statusDiv;
    }
    
    updateStatus(message) {
        if (this.statusDiv) {
            const lines = this.statusDiv.innerHTML.split('<div>');
            lines[3] = `🎯 Last Detection: ${message}</div>`;
            this.statusDiv.innerHTML = lines.join('<div>');
        }
    }

    dispose() {
        this.isDetecting = false;
        this.isStarted = false;
        
        if (this.video && this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(track => track.stop());
        }
        
        if (this.currentModel && this.currentModel.dispose) {
            this.currentModel.dispose();
        }
        
        console.log('🧹 Simple AR App disposed');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Starting Simple AR App...');
    window.simpleARApp = new SimpleARApp();
});

window.addEventListener('beforeunload', () => {
    if (window.simpleARApp) {
        window.simpleARApp.dispose();
    }
});

export { SimpleARApp };