import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';
import { ARButton } from 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/webxr/ARButton.js';
import { AtomModel } from './atom.js';
import { InteractionManager } from './interactions.js';

class WebARAtomApp {
    constructor() {
        // Core Three.js components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        
        // AR components
        this.reticle = null;
        this.hitTestSource = null;
        this.hitTestSourceRequested = false;
        this.localSpace = null;
        
        // App components
        this.atom = null;
        this.interactionManager = null;
        this.sceneIndex = 0; // 0..5 (6 scenes)
        
        // State
        this.isARActive = false;
        this.atomPlaced = false;
        
        // Performance
        this.clock = new THREE.Clock();
        this.frameCount = 0;
        
        this.init();
    }

    async init() {
        try {
            this.createScene();
            this.createCamera();
            this.createRenderer();
            this.createLighting();
            this.createReticle();
            this.setupARButton();
            this.setupInteractions();
            this.setupEventListeners();
            this.setupEducationUI();
            this.setupSceneControls();
            
            this.animate();
            
            console.log('âœ… WebAR Atom App initialized successfully');
        } catch (error) {
            console.error('âŒ Failed to initialize WebAR Atom App:', error);
            this.showError('Failed to initialize AR. Please check browser compatibility.');
        }
    }

    createScene() {
        this.scene = new THREE.Scene();
    }

    createCamera() {
        this.camera = new THREE.PerspectiveCamera(
            70, 
            window.innerWidth / window.innerHeight, 
            0.01, 
            20
        );
    }

    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true,
            powerPreference: "high-performance"
        });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.xr.enabled = true;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Add to DOM
        const container = document.getElementById('container');
        container.appendChild(this.renderer.domElement);
    }

    createLighting() {
        // Ambient light for overall illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Directional light for shadows and definition
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        this.scene.add(directionalLight);

        // Hemisphere light for better color balance
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
        this.scene.add(hemisphereLight);
    }

    createReticle() {
        // Create placement reticle (group gets the AR plane pose; ring is rotated flat)
        this.reticle = new THREE.Group();
        this.reticle.matrixAutoUpdate = false;
        this.reticle.visible = false;

        const reticleGeometry = new THREE.RingGeometry(0.15, 0.2, 32);
        const reticleMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });

        const ring = new THREE.Mesh(reticleGeometry, reticleMaterial);
        // Rotate ring to lie on XZ plane (so its normal points up +Y)
        ring.rotation.x = -Math.PI / 2;
        this.reticle.add(ring);
        this.scene.add(this.reticle);

        // Add pulsing animation to reticle
        this.reticle.userData.pulsePhase = 0;
    }

    setupARButton() {
        // Remove existing AR button
        const existingButton = document.getElementById('arButton');
        if (existingButton) {
            existingButton.remove();
        }

        // Create new AR button with Three.js ARButton
        const arButton = ARButton.createButton(this.renderer, {
            requiredFeatures: ['hit-test'],
            optionalFeatures: ['dom-overlay', 'light-estimation'],
            domOverlay: { root: document.querySelector('.ui-overlay') }
        });

        // Style the button
        arButton.id = 'arButton';
        arButton.className = 'ar-button';
        arButton.textContent = 'Start AR Experience';
        
        // Add to overlay
        document.querySelector('.ui-overlay').appendChild(arButton);

        // AR session events
        this.renderer.xr.addEventListener('sessionstart', () => {
            console.log('ðŸš€ AR session started');
            this.isARActive = true;
            this.hideInstructions();
        });

        this.renderer.xr.addEventListener('sessionend', () => {
            console.log('ðŸ›‘ AR session ended');
            this.isARActive = false;
            this.atomPlaced = false;
            this.showInstructions();
            
            if (this.atom) {
                this.scene.remove(this.atom.getGroup());
                this.atom.dispose();
                this.atom = null;
            }
        });
    }

    setupInteractions() {
        this.interactionManager = new InteractionManager(
            this.renderer, 
            this.scene, 
            this.camera
        );

        // Setup controller select events for atom placement
        const controllers = this.renderer.xr.getController(0);
        controllers.addEventListener('select', () => this.onSelect());
        this.scene.add(controllers);

        // Listen for part selection to update UI text
        this.interactionManager.on('selectPart', (part) => {
            this.handlePartSelection(part);
        });
    }

    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    setupSceneControls() {
        const nextBtn = document.getElementById('nextScene');
        const prevBtn = document.getElementById('prevScene');
        if (nextBtn) nextBtn.addEventListener('click', () => this.gotoScene(this.sceneIndex + 1));
        if (prevBtn) prevBtn.addEventListener('click', () => this.gotoScene(this.sceneIndex - 1));
    }

    onSelect() {
        if (this.reticle.visible && !this.atomPlaced) {
            this.placeAtom();
        }
    }

    placeAtom() {
        console.log('ðŸŽ¯ Placing atom');
        
        // Create atom model
        this.atom = new AtomModel();
        
        // Position atom at reticle location
        const atomGroup = this.atom.getGroup();
        atomGroup.position.setFromMatrixPosition(this.reticle.matrix);
        atomGroup.scale.setScalar(0.5); // Start smaller for mobile screens
        
        this.scene.add(atomGroup);
        
        // Setup interactions
        this.interactionManager.setAtom(this.atom);
        
        // Hide reticle and update state
        this.reticle.visible = false;
        this.atomPlaced = true;
        // Show intro panel now that the atom exists
        const panel = document.getElementById('eduPanel');
        if (panel) {
            panel.classList.remove('hidden');
            panel.innerHTML = `
                <h3>معلومات تعليمية</h3>
                <p>هذه هي الذرّة. هي أصغر جزء في المادة، وكل شيء حولك مكوّن منها. وتتكون من أجزاء عدة:</p>
                <p>لنتعرف عليها!</p>
            `;
        }
        
        // Stop hit testing
        this.hitTestSource = null;
        this.hitTestSourceRequested = false;
        
        console.log('âœ… Atom placed successfully');

        // Show scene footer controls now
        const footer = document.getElementById('sceneFooter');
        if (footer) footer.classList.remove('hidden');
        this.gotoScene(0);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        this.renderer.setAnimationLoop((timestamp, frame) => {
            this.render(timestamp, frame);
        });
    }

    render(timestamp, frame) {
        const deltaTime = this.clock.getDelta();
        
        // Update atom animation
        if (this.atom) {
            this.atom.animate(deltaTime);
        }

        // Update interactions
        if (this.interactionManager) {
            this.interactionManager.update();
        }

        // Handle AR hit testing
        this.handleHitTesting(frame);
        
        // Animate reticle
        this.animateReticle(deltaTime);
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
        
        // Performance monitoring
        this.frameCount++;
        if (this.frameCount % 60 === 0) {
            this.updatePerformanceStats();
        }
    }

    handleHitTesting(frame) {
        if (!frame || this.atomPlaced) return;

        const referenceSpace = this.renderer.xr.getReferenceSpace();
        const session = this.renderer.xr.getSession();

        if (!this.hitTestSourceRequested) {
            session.requestReferenceSpace('viewer').then((referenceSpace) => {
                session.requestHitTestSource({ space: referenceSpace }).then((source) => {
                    this.hitTestSource = source;
                }).catch((error) => {
                    console.warn('Hit test not supported:', error);
                });
            });

            session.addEventListener('end', () => {
                this.hitTestSourceRequested = false;
                this.hitTestSource = null;
            });

            this.hitTestSourceRequested = true;
        }

        if (this.hitTestSource) {
            const hitTestResults = frame.getHitTestResults(this.hitTestSource);
            
            if (hitTestResults.length > 0) {
                const hit = hitTestResults[0];
                const pose = hit.getPose(referenceSpace);
                
                if (pose) {
                    this.reticle.visible = true;
                    this.reticle.matrix.fromArray(pose.transform.matrix);
                }
            } else {
                this.reticle.visible = false;
            }
        }
    }

    animateReticle(deltaTime) {
        if (!this.reticle.visible) return;
        
        // Pulse animation
        this.reticle.userData.pulsePhase += deltaTime * 3;
        const pulseScale = 1 + Math.sin(this.reticle.userData.pulsePhase) * 0.1;
        
        const currentScale = new THREE.Vector3();
        currentScale.setFromMatrixScale(this.reticle.matrix);
        
        const newMatrix = new THREE.Matrix4();
        newMatrix.copy(this.reticle.matrix);
        newMatrix.scale(new THREE.Vector3(pulseScale, pulseScale, pulseScale));
        
        this.reticle.matrix.copy(newMatrix);
    }

    updatePerformanceStats() {
        const info = this.renderer.info;
        console.log(`ðŸ“Š Performance - Triangles: ${info.render.triangles}, Calls: ${info.render.calls}, FPS: ~${Math.round(1000/this.clock.getDelta())}`);
    }

    showInstructions() {
        const instructions = document.getElementById('instructions');
        if (instructions) {
            instructions.classList.remove('hidden');
        }
    }

    hideInstructions() {
        const instructions = document.getElementById('instructions');
        if (instructions) {
            instructions.classList.add('hidden');
        }
    }

    setupEducationUI() {
        const panel = document.getElementById('eduPanel');
        if (!panel) return;
        panel.classList.add('hidden');
        panel.innerHTML = `
            <h3>معلومات تعليمية</h3>
            <p>هذه هي الذرّة. هي أصغر جزء في المادة، وكل شيء حولك مكوّن منها. وتتكون من أجزاء عدة:</p>
            <p>لنتعرف عليها!</p>
        `;
    }

    handlePartSelection(part) {
        // Only handle part selection in Scene 1
        if (this.sceneIndex === 0) {
            this.showPartInfo(part);
        }
        // In other scenes, ignore part selection to prevent unwanted transparency
    }

    showPartInfo(part) {
        const panel = document.getElementById('eduPanel');
        if (!panel) return;

        // Clear any existing highlights first
        if (this.atom && this.atom.clearHighlights) {
            this.atom.clearHighlights();
        }

        if (part === 'nucleus') {
            panel.innerHTML = `
                <h3>النواة</h3>
                <p>هنا تقع البروتونات والنيوترونات في مركز الذرّة.</p>
                <p>البروتونات موجبة الشحنة والنيوترونات متعادلة، وتشكلان معًا معظم كتلة الذرّة.</p>
            `;
            // Highlight nucleus (both protons and neutrons)
            if (this.atom && this.atom.highlightKind) {
                this.atom.highlightKind('proton');
                // Also highlight neutrons
                setTimeout(() => {
                    if (this.atom && this.atom.highlightKind) {
                        this.atom.highlightKind('neutron');
                    }
                }, 100);
            }
        } else if (part === 'electron' || part === 'orbit') {
            panel.innerHTML = `
                <h3>الإلكترونات</h3>
                <p>الإلكترونات تدور حول النواة في مستويات طاقة مختلفة.</p>
                <p>تتحرك بسرعة كبيرة وتشكل السحابة الإلكترونية حول النواة.</p>
            `;
            // Highlight electrons
            if (this.atom && this.atom.highlightKind) {
                this.atom.highlightKind('electron');
            }
        } else {
            // Default intro text
            panel.innerHTML = `
                <h3>معلومات تعليمية</h3>
                <p>هذه هي الذرّة. هي أصغر جزء في المادة، وكل شيء حولك مكوّن منها. وتتكون من أجزاء عدة:</p>
                <p>لنتعرف عليها!</p>
            `;
        }
    }

    updateEducationText(part) {
        // This method is now only used for scene transitions
        const panel = document.getElementById('eduPanel');
        if (!panel) return;
        
        // Only update text for scene transitions, not part selections
        if (this.sceneIndex !== 0) {
            this.showPartInfo(part);
        }
    }

    updateSceneIndicator() {
        const ind = document.getElementById('sceneIndicator');
        if (!ind) return;
        const human = this.sceneIndex + 1;
        ind.textContent = `المشهد ${human} / ٦`;
    }

    gotoScene(index) {
        if (!this.atomPlaced) return;
        const clamped = Math.max(0, Math.min(5, index));
        this.sceneIndex = clamped;
        this.updateSceneIndicator();
        
        // Tell interaction manager about current scene
        if (this.interactionManager && this.interactionManager.setCurrentScene) {
            this.interactionManager.setCurrentScene(clamped);
        }
        const panel = document.getElementById('eduPanel');
        const challenge = document.getElementById('challengeOverlay');
        if (challenge) challenge.classList.add('hidden');
        if (!panel) return;

        // Reset any highlights and animations
        if (this.atom && this.atom.clearHighlights) this.atom.clearHighlights();
        if (this.atom && this.atom.restoreOpacity) this.atom.restoreOpacity();
        if (this.atom && this.atom.stopProtonAnimation) this.atom.stopProtonAnimation();
        if (this.atom && this.atom.stopNeutronAnimation) this.atom.stopNeutronAnimation();

        switch (clamped) {
            case 0: // Scene 1: ظهور الذرة
                panel.classList.remove('hidden');
                panel.innerHTML = `
                    <h3>معلومات تعليمية</h3>
                    <p>هذه هي الذرّة. هي أصغر جزء في المادة، وكل شيء حولك مكوّن منها. وتتكون من أجزاء عدة:</p>
                    <p>لنتعرف عليها!</p>
                    <p><em>اضغط على أي جزء من الذرّة لمعرفة المزيد عنه</em></p>
                `;
                break;
            case 1: // Scene 2: البروتون
                panel.classList.remove('hidden');
                panel.innerHTML = `
                    <h3>البروتونات</h3>
                    <p>توجد البروتونات داخل نواة الذرة، وتحمل الشحنة الموجبة، وتحدد نوع العنصر (العدد الذري).</p>
                `;
                if (this.atom && this.atom.highlightKind) {
                    this.atom.highlightKind('proton', 1);
                    this.atom.animateProtons(false); // Disable animation
                }
                break;
            case 2: // Scene 3: النيوترون
                panel.classList.remove('hidden');
                panel.innerHTML = `
                    <h3>النيوترونات</h3>
                    <p>توجد داخل النواة وهي متعادلة، أي لا تحمل شحنة، وتساهم في استقرار النواة.</p>
                `;
                if (this.atom && this.atom.highlightKind) {
                    this.atom.highlightKind('neutron', 1);
                    this.atom.animateNeutrons(false); // Disable animation
                }
                break;
            case 3: // Scene 4: الإلكترون
                panel.classList.remove('hidden');
                panel.innerHTML = `
                    <h3>الإلكترونات</h3>
                    <p>الإلكترونات تدور حول النواة في مستويات طاقة مختلفة وتشكل سحابة إلكترونية وشحنتها سالبة.</p>
                `;
                if (this.atom && this.atom.highlightKind) this.atom.highlightKind('electron', 1);
                break;
            case 4: // Scene 5: التحدي
                panel.classList.add('hidden');
                if (challenge) challenge.classList.remove('hidden');
                this.setupChallengeDnD();
                break;
            case 5: // Scene 6: الملخص
                panel.classList.remove('hidden');
                panel.innerHTML = `
                    <h3>ملخص</h3>
                    <p>الذرّة تتكون من: بروتونات موجبة ونيوترونات متعادلة (يشكلان النواة)، وإلكترونات سالبة تدور حول النواة في مستويات الطاقة مكوّنة السحابة الإلكترونية.</p>
                `;
                break;
        }
    }

    setupChallengeDnD() {
        const cards = document.querySelectorAll('#challengeOverlay .card');
        const zones = document.querySelectorAll('#challengeOverlay .dropzone');
        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', card.getAttribute('data-key'));
            });
        });
        zones.forEach(zone => {
            zone.addEventListener('dragover', (e) => { e.preventDefault(); });
            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                const key = e.dataTransfer.getData('text/plain');
                const target = zone.getAttribute('data-target');
                if (key === target) {
                    zone.textContent = `✔ تم وضع ${key === 'proton' ? 'البروتون' : key === 'neutron' ? 'النيترون' : 'الإلكترون'} بنجاح`;
                    zone.style.background = '#e7ffef';
                } else {
                    zone.textContent = '✖ فكر جيدًا… المحاولة مرة أخرى';
                    zone.style.background = '#ffe7e7';
                }
            });
        });
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
            <h3>âš ï¸ Error</h3>
            <p>${message}</p>
            <button onclick="this.parentElement.remove()" 
                    style="background: white; color: red; border: none; padding: 10px 20px; border-radius: 5px; margin-top: 10px; cursor: pointer;">
                Close
            </button>
        `;
        document.body.appendChild(errorDiv);
    }

    dispose() {
        // Clean up resources
        if (this.interactionManager) {
            this.interactionManager.dispose();
        }
        
        if (this.atom) {
            this.atom.dispose();
        }
        
        // Remove event listeners
        window.removeEventListener('resize', this.onWindowResize);
        
        console.log('ðŸ§¹ WebAR Atom App disposed');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('ðŸš€ Starting WebAR Atom App...');
    
    // Check WebXR support
    if (navigator.xr) {
        navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
            if (supported) {
                console.log('âœ… WebXR AR supported');
                new WebARAtomApp();
            } else {
                console.warn('âš ï¸ WebXR AR not supported');
                document.getElementById('arButton').textContent = 'AR Not Supported';
                document.getElementById('arButton').disabled = true;
            }
        });
    } else {
        console.warn('âš ï¸ WebXR not available');
        document.getElementById('arButton').textContent = 'WebXR Not Available';
        document.getElementById('arButton').disabled = true;
    }
});

// Handle app lifecycle
window.addEventListener('beforeunload', () => {
    if (window.webARApp) {
        window.webARApp.dispose();
    }
});

export { WebARAtomApp };