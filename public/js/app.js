import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';
import { VRButton } from 'https://cdn.jsdelivr.net/npm/three@0.158.0/examples/jsm/webxr/VRButton.js';
import { AtomModel } from './atom.js';
import { InteractionManager } from './interactions.js';
import { UI3D } from './ui3d.js';

class WebVRAtomApp {
    constructor() {
        // Core Three.js components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        
        // VR components
        this.vrCube = null;
        this.ui3d = null;
        
        // App components
        this.atom = null;
        this.interactionManager = null;
        this.sceneIndex = 0; // 0..5 (6 scenes)
        
        // State
        this.isVRActive = false;
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
            this.createVRCube();
            this.createLighting();
            this.create3DUI();
            this.setupVRButton();
            this.setupInteractions();
            this.setupEventListeners();
            this.placeAtom(); // Place atom immediately in VR
            
            this.animate();
            
            console.log('âœ… WebAR Atom App initialized successfully');
        } catch (error) {
            console.error('âŒ Failed to initialize WebAR Atom App:', error);
            this.showError('Failed to initialize VR. Please check browser compatibility.');
        }
    }

    createScene() {
        this.scene = new THREE.Scene();
        // Set a dark space background for VR
        this.scene.background = new THREE.Color(0x0a0a0a);
    }
    
    createVRCube() {
        // Create a large cube that serves as the VR environment
        const cubeSize = 10;
        const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
        
        // Create materials for each face with different colors/textures
        const materials = [
            new THREE.MeshLambertMaterial({ color: 0x1a1a2e, side: THREE.BackSide }), // Right
            new THREE.MeshLambertMaterial({ color: 0x16213e, side: THREE.BackSide }), // Left  
            new THREE.MeshLambertMaterial({ color: 0x0f3460, side: THREE.BackSide }), // Top
            new THREE.MeshLambertMaterial({ color: 0x533483, side: THREE.BackSide }), // Bottom
            new THREE.MeshLambertMaterial({ color: 0x1a1a2e, side: THREE.BackSide }), // Front
            new THREE.MeshLambertMaterial({ color: 0x16213e, side: THREE.BackSide })  // Back
        ];
        
        this.vrCube = new THREE.Mesh(cubeGeometry, materials);
        this.vrCube.position.set(0, 0, 0);
        this.scene.add(this.vrCube);
        
        // Add some ambient lighting effects to the cube walls
        this.addCubeEffects();
        
        console.log('🧊 VR Cube environment created');
    }
    
    addCubeEffects() {
        // Add some glowing particles or effects to make the cube more interesting
        const particleCount = 200;
        const particles = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount * 3; i += 3) {
            // Distribute particles throughout the cube space
            positions[i] = (Math.random() - 0.5) * 8;     // x
            positions[i + 1] = (Math.random() - 0.5) * 8; // y  
            positions[i + 2] = (Math.random() - 0.5) * 8; // z
        }
        
        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const particleMaterial = new THREE.PointsMaterial({
            color: 0x4a9eff,
            size: 0.02,
            transparent: true,
            opacity: 0.6
        });
        
        const particleSystem = new THREE.Points(particles, particleMaterial);
        this.scene.add(particleSystem);
        this.particleSystem = particleSystem;
    }
    
    create3DUI() {
        // Create 3D UI system
        this.ui3d = new UI3D(this.scene, this.camera, this.renderer);
        
        // Set up scene change callback
        this.ui3d.setSceneChangeCallback((sceneIndex) => {
            this.gotoScene(sceneIndex);
        });
        
        console.log('3D UI system created');
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
        // Enhanced lighting for enclosed VR environment
        // Ambient light for overall illumination - brighter for VR
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);

        // Multiple directional lights for better atom visibility in VR cube
        const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight1.position.set(2, 2, 2);
        directionalLight1.castShadow = true;
        directionalLight1.shadow.mapSize.width = 1024;
        directionalLight1.shadow.mapSize.height = 1024;
        this.scene.add(directionalLight1);

        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
        directionalLight2.position.set(-2, -1, 1);
        this.scene.add(directionalLight2);

        // Point lights for dynamic lighting effects
        const pointLight1 = new THREE.PointLight(0x4a9eff, 0.8, 8);
        pointLight1.position.set(2, 2, 2);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0xff6b4a, 0.6, 8);
        pointLight2.position.set(-2, -2, -2);
        this.scene.add(pointLight2);

        // Store lights for animation
        this.lights = {
            point1: pointLight1,
            point2: pointLight2
        };
    }

    // VR doesn't need reticle - removed

    setupVRButton() {
        // Remove existing button
        const existingButton = document.getElementById('vrButton') || document.getElementById('arButton');
        if (existingButton) {
            existingButton.remove();
        }

        // Create new VR button with Three.js VRButton (no DOM overlay needed)
        const vrButton = VRButton.createButton(this.renderer);

        // Style the button
        vrButton.id = 'vrButton';
        vrButton.className = 'vr-button';
        vrButton.textContent = 'Enter VR Experience';
        
        // Add to overlay
        document.querySelector('.ui-overlay').appendChild(vrButton);

        // VR session events
        this.renderer.xr.addEventListener('sessionstart', () => {
            console.log('🚀 VR session started');
            this.isVRActive = true;
            this.hideInstructions();
            // Hide VR button in VR
            vrButton.style.display = 'none';
            // Show 3D UI elements in VR
            if (this.ui3d) {
                this.ui3d.show();
            }
        });

        this.renderer.xr.addEventListener('sessionend', () => {
            console.log('🛑 VR session ended');
            this.isVRActive = false;
            this.showInstructions();
            // Show VR button again
            vrButton.style.display = '';
            // Hide 3D UI elements
            if (this.ui3d) {
                this.ui3d.hide();
            }
        });
    }

    setupInteractions() {
        this.interactionManager = new InteractionManager(
            this.renderer, 
            this.scene, 
            this.camera
        );

        // Setup controller select events for VR interactions
        const controller0 = this.renderer.xr.getController(0);
        const controller1 = this.renderer.xr.getController(1);
        
        controller0.addEventListener('select', (event) => this.onVRSelect(event));
        controller1.addEventListener('select', (event) => this.onVRSelect(event));
        
        this.scene.add(controller0);
        this.scene.add(controller1);
        
        // Store controllers for raycasting
        this.controllers = [controller0, controller1];

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

    onVRSelect(event) {
        const controller = event.target;
        
        // Check for 3D UI interactions
        if (this.ui3d && this.isVRActive) {
            const intersections = this.getControllerIntersections(controller);
            
            for (const intersection of intersections) {
                // Check if it's a UI element
                if (this.ui3d.handleControllerInteraction(intersection.object)) {
                    console.log('3D UI interaction detected');
                    return; // UI interaction handled
                }
            }
        }
        
        console.log('VR controller select event');
    }
    
    getControllerIntersections(controller) {
        const raycaster = new THREE.Raycaster();
        const tempMatrix = new THREE.Matrix4();
        
        tempMatrix.identity().extractRotation(controller.matrixWorld);
        raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
        
        return raycaster.intersectObjects(this.scene.children, true);
    }

    placeAtom() {
        console.log('🎯 Placing atom in VR');
        
        // Create atom model
        this.atom = new AtomModel();
        
        // Position atom at center of VR cube
        const atomGroup = this.atom.getGroup();
        atomGroup.position.set(0, 0, -2); // Center in front of user
        atomGroup.scale.setScalar(1.0); // Good size for VR
        
        this.scene.add(atomGroup);
        
        // Setup interactions
        this.interactionManager.setAtom(this.atom);
        
        // Update state
        this.atomPlaced = true;
        
        // Update 3D UI with intro content
        if (this.ui3d) {
            this.ui3d.updateEducationalContent(
                "مرحباً بك في عالم الذرة!", 
                "هذه هي الذرّة. هي أصغر جزء في المادة، وكل شيء حولك مكوّن منها. وتتكون من أجزاء عدة: لنتعرف عليها!"
            );
        }
        
        console.log('✅ Atom placed successfully in VR');
        
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

        // Animate VR environment effects
        this.animateVREffects(deltaTime);
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
        
        // Performance monitoring
        this.frameCount++;
        if (this.frameCount % 60 === 0) {
            this.updatePerformanceStats();
        }
    }

    animateVREffects(deltaTime) {
        // Animate particle system
        if (this.particleSystem) {
            this.particleSystem.rotation.y += deltaTime * 0.1;
            this.particleSystem.rotation.x += deltaTime * 0.05;
        }
        
        // Animate lights for dynamic effects
        if (this.lights) {
            this.lights.point1.position.x = Math.sin(this.time * 0.5) * 3;
            this.lights.point1.position.z = Math.cos(this.time * 0.3) * 3;
            
            this.lights.point2.position.x = Math.cos(this.time * 0.4) * 2;
            this.lights.point2.position.y = Math.sin(this.time * 0.6) * 2;
        }
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

    // Old DOM UI methods removed - now using 3D UI system

    // Old DOM education UI setup removed - now using 3D UI system

    handlePartSelection(part) {
        // Only handle part selection in Scene 1
        if (this.sceneIndex === 0) {
            this.showPartInfo(part);
        }
        // In other scenes, ignore part selection to prevent unwanted transparency
    }

    showPartInfo(part) {
        if (!this.ui3d) return;

        // Clear any existing highlights first
        if (this.atom && this.atom.clearHighlights) {
            this.atom.clearHighlights();
        }

        if (part === 'nucleus') {
            this.ui3d.updateEducationalContent(
                "النواة",
                "هنا تقع البروتونات والنيوترونات في مركز الذرّة. البروتونات موجبة الشحنة والنيوترونات متعادلة، وتشكلان معًا معظم كتلة الذرّة."
            );
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
            this.ui3d.updateEducationalContent(
                "الإلكترونات",
                "الإلكترونات تدور حول النواة في مستويات طاقة مختلفة. تتحرك بسرعة كبيرة وتشكل السحابة الإلكترونية حول النواة."
            );
            // Highlight electrons
            if (this.atom && this.atom.highlightKind) {
                this.atom.highlightKind('electron');
            }
        } else {
            // Default intro text
            this.ui3d.updateEducationalContent(
                "معلومات تعليمية",
                "هذه هي الذرّة. هي أصغر جزء في المادة، وكل شيء حولك مكوّن منها. وتتكون من أجزاء عدة: لنتعرف عليها!"
            );
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
        // Update 3D UI scene indicator
        if (this.ui3d) {
            this.ui3d.updateSceneIndicator(this.sceneIndex, 6);
        }
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

        // Reset any highlights and animations
        if (this.atom && this.atom.clearHighlights) this.atom.clearHighlights();
        if (this.atom && this.atom.restoreOpacity) this.atom.restoreOpacity();
        if (this.atom && this.atom.stopProtonAnimation) this.atom.stopProtonAnimation();
        if (this.atom && this.atom.stopNeutronAnimation) this.atom.stopNeutronAnimation();

        // Update 3D UI content based on scene
        if (this.ui3d) {
            switch (clamped) {
                case 0: // Scene 1: ظهور الذرة
                    this.ui3d.updateEducationalContent(
                        "معلومات تعليمية",
                        "هذه هي الذرّة. هي أصغر جزء في المادة، وكل شيء حولك مكوّن منها. وتتكون من أجزاء عدة: لنتعرف عليها!\n\nاضغط على أي جزء من الذرّة لمعرفة المزيد عنه"
                    );
                    break;
                case 1: // Scene 2: البروتون
                    this.ui3d.updateEducationalContent(
                        "البروتونات",
                        "توجد البروتونات داخل نواة الذرة، وتحمل الشحنة الموجبة، وتحدد نوع العنصر (العدد الذري)."
                    );
                    if (this.atom && this.atom.highlightKind) {
                        this.atom.highlightKind('proton', 1);
                        this.atom.animateProtons(false); // Disable animation
                    }
                    break;
                case 2: // Scene 3: النيوترون
                    this.ui3d.updateEducationalContent(
                        "النيوترونات",
                        "توجد داخل النواة وهي متعادلة، أي لا تحمل شحنة، وتساهم في استقرار النواة."
                    );
                    if (this.atom && this.atom.highlightKind) {
                        this.atom.highlightKind('neutron', 1);
                        this.atom.animateNeutrons(false); // Disable animation
                    }
                    break;
                case 3: // Scene 4: الإلكترون
                    this.ui3d.updateEducationalContent(
                        "الإلكترونات",
                        "الإلكترونات تدور حول النواة في مستويات طاقة مختلفة وتشكل سحابة إلكترونية وشحنتها سالبة."
                    );
                    if (this.atom && this.atom.highlightKind) this.atom.highlightKind('electron', 1);
                    break;
                case 4: // Scene 5: التحدي
                    this.ui3d.updateEducationalContent(
                        "التحدي التفاعلي",
                        "اختبر معرفتك! حدد أجزاء الذرة المختلفة باستخدام وحدة التحكم في الـ VR"
                    );
                    this.setupChallengeDnD();
                    break;
                case 5: // Scene 6: الملخص
                    this.ui3d.updateEducationalContent(
                        "ملخص",
                        "الذرّة تتكون من: بروتونات موجبة ونيوترونات متعادلة (يشكلان النواة)، وإلكترونات سالبة تدور حول النواة في مستويات الطاقة مكوّنة السحابة الإلكترونية."
                    );
                    break;
            }
        }
    }

    setupChallengeDnD() {
        // Setup pure UI quiz click selection
        this.setupQuizClickSelect();
    }

    setupQuizClickSelect() {
        const answerCards = document.querySelectorAll('#challengeOverlay .answer-card');
        const dropSlots = document.querySelectorAll('#challengeOverlay .drop-slot');
        
        this.selectedAnswer = null;
        this.selectedCard = null;
        
        // Setup answer cards - click to select
        answerCards.forEach(card => {
            // Remove draggable attribute
            card.removeAttribute('draggable');
            
            card.addEventListener('click', (e) => {
                // Clear previous selection
                answerCards.forEach(c => c.classList.remove('selected'));
                
                // Select this card
                card.classList.add('selected');
                this.selectedAnswer = card.getAttribute('data-answer');
                this.selectedCard = card;
                
                // Update status
                const statusElement = document.getElementById('quizStatus');
                if (statusElement) {
                    const particleName = this.getParticleName(this.selectedAnswer);
                    statusElement.textContent = `تم اختيار ${particleName} - الآن اضغط على المكان المناسب`;
                    statusElement.style.color = '#0066cc';
                }
            });
        });
        
        // Setup drop slots - click to place selected answer
        dropSlots.forEach(slot => {
            slot.addEventListener('click', (e) => {
                if (!this.selectedAnswer || !this.selectedCard) {
                    // No answer selected
                    const statusElement = document.getElementById('quizStatus');
                    if (statusElement) {
                        statusElement.textContent = 'اختر إجابة أولاً ثم اضغط على المكان المناسب';
                        statusElement.style.color = '#aa0000';
                    }
                    return;
                }
                
                const targetType = slot.getAttribute('data-target');
                this.handleQuizClick(this.selectedAnswer, targetType, slot, this.selectedCard);
            });
            
            // Add hover effect for slots
            slot.addEventListener('mouseenter', (e) => {
                if (this.selectedAnswer) {
                    slot.classList.add('hover-highlight');
                }
            });
            
            slot.addEventListener('mouseleave', (e) => {
                slot.classList.remove('hover-highlight');
            });
        });
    }

    handleQuizClick(answerType, targetType, slot, card) {
        if (this.sceneIndex !== 4) return;
        
        const isCorrect = answerType === targetType;
        
        // Clear selection
        card.classList.remove('selected');
        this.selectedAnswer = null;
        this.selectedCard = null;
        
        if (isCorrect) {
            // Correct answer - animate card to slot and make slot green
            this.animateCardToSlot(card, slot, () => {
                slot.classList.add('correct');
                slot.classList.remove('incorrect');
                slot.querySelector('.slot-content').textContent = this.getParticleName(answerType);
                
                // Hide the answer card
                card.style.display = 'none';
                
                this.updateQuizStatus(true, answerType);
                this.checkQuizCompletion();
            });
        } else {
            // Wrong answer - show feedback and return card
            slot.classList.add('incorrect');
            slot.classList.remove('correct');
            this.updateQuizStatus(false, answerType);
            
            // Reset the slot after a short delay
            setTimeout(() => {
                slot.classList.remove('incorrect');
                slot.querySelector('.slot-content').textContent = '';
            }, 2000);
        }
    }

    animateCardToSlot(card, slot, callback) {
        // Get positions
        const cardRect = card.getBoundingClientRect();
        const slotRect = slot.getBoundingClientRect();
        
        // Create a clone for animation
        const clone = card.cloneNode(true);
        clone.style.position = 'fixed';
        clone.style.top = cardRect.top + 'px';
        clone.style.left = cardRect.left + 'px';
        clone.style.width = cardRect.width + 'px';
        clone.style.height = cardRect.height + 'px';
        clone.style.zIndex = '1000';
        clone.style.transition = 'all 0.5s ease';
        clone.style.pointerEvents = 'none';
        
        document.body.appendChild(clone);
        
        // Animate to slot position
        setTimeout(() => {
            clone.style.top = slotRect.top + 'px';
            clone.style.left = slotRect.left + 'px';
            clone.style.transform = 'scale(0.8)';
            clone.style.opacity = '0.8';
        }, 10);
        
        // Clean up and callback
        setTimeout(() => {
            document.body.removeChild(clone);
            if (callback) callback();
        }, 500);
    }

    handleQuizDrop(answerType, targetType, slot) {
        // Keep old method for compatibility
        this.handleQuizClick(answerType, targetType, slot, document.querySelector(`[data-answer="${answerType}"]`));
    }

    getParticleName(type) {
        const names = {
            'proton': 'بروتونات',
            'neutron': 'نيوترونات',
            'electron': 'إلكترونات'
        };
        return names[type] || type;
    }

    updateQuizStatus(success, particleType) {
        const statusElement = document.getElementById('quizStatus');
        if (!statusElement) return;
        
        const particleName = this.getParticleName(particleType);
        
        if (success) {
            statusElement.textContent = `ممتاز! تم وضع ${particleName} في المكان الصحيح`;
            statusElement.style.color = '#00aa00';
        } else {
            statusElement.textContent = `فكر جيدًا... ${particleName} في المكان الخطأ. المحاولة مرة أخرى`;
            statusElement.style.color = '#aa0000';
        }
    }

    checkQuizCompletion() {
        const correctSlots = document.querySelectorAll('#challengeOverlay .drop-slot.correct');
        const totalSlots = document.querySelectorAll('#challengeOverlay .drop-slot').length;
        
        if (correctSlots.length === totalSlots) {
            const statusElement = document.getElementById('quizStatus');
            if (statusElement) {
                statusElement.textContent = '🎉 تهانينا! لقد أكملت التحدي بنجاح!';
                statusElement.style.color = '#0066cc';
            }
        }
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
        
        if (this.ui3d) {
            this.ui3d.dispose();
        }
        
        // Remove event listeners
        window.removeEventListener('resize', this.onWindowResize);
        
        console.log('🧹 WebVR Atom App disposed');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Starting WebVR Atom App...');
    
    // Check WebXR support
    if (navigator.xr) {
        navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
            if (supported) {
                console.log('✅ WebXR VR supported');
                window.webVRApp = new WebVRAtomApp();
            } else {
                console.warn('âš ï¸ WebXR AR not supported');
                // Still create the app for desktop preview
                console.log('Creating app for desktop preview');
                window.webVRApp = new WebVRAtomApp();
            }
        });
    } else {
        console.warn('âš ï¸ WebXR not available');
        window.webVRApp = new WebVRAtomApp();
    }
});

// Handle app lifecycle
window.addEventListener('beforeunload', () => {
    if (window.webVRApp) {
        window.webVRApp.dispose();
    }
});

export { WebVRAtomApp };