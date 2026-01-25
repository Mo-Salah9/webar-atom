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
            this.setupARButton();
            this.setupInteractions();
            this.setupEventListeners();
            this.setupEducationUI();
            this.setupSceneControls();
            
            this.animate();
            
            console.log('✅ WebAR Atom App initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize WebAR Atom App:', error);
            this.showError('Failed to initialize AR. Please check browser compatibility.');
        }
    }

    createScene() {
        this.scene = new THREE.Scene();
        // AR uses transparent background to show real world
        this.scene.background = null;
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
        // Enhanced lighting for AR environment
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight1.position.set(2, 2, 2);
        directionalLight1.castShadow = true;
        directionalLight1.shadow.mapSize.width = 1024;
        directionalLight1.shadow.mapSize.height = 1024;
        this.scene.add(directionalLight1);

        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight2.position.set(-2, -1, 1);
        this.scene.add(directionalLight2);

        const pointLight1 = new THREE.PointLight(0x4a9eff, 0.6, 8);
        pointLight1.position.set(2, 2, 2);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0xff6b4a, 0.5, 8);
        pointLight2.position.set(-2, -2, -2);
        this.scene.add(pointLight2);

        this.lights = {
            point1: pointLight1,
            point2: pointLight2
        };
    }

    setupARButton() {
        // Remove existing button
        const existingButton = document.getElementById('vrButton') || document.getElementById('arButton');
        if (existingButton) {
            existingButton.remove();
        }

        // Create new AR button with Three.js ARButton
        const arButton = ARButton.createButton(this.renderer, {
            optionalFeatures: ['dom-overlay', 'hit-test'],
            domOverlay: { root: document.querySelector('.ui-overlay') }
        });

        // Style the button
        arButton.id = 'arButton';
        arButton.className = 'vr-button';
        arButton.textContent = 'Enter AR Experience';
        
        // Add to overlay
        document.querySelector('.ui-overlay').appendChild(arButton);

        // AR session events
        this.renderer.xr.addEventListener('sessionstart', () => {
            console.log('🚀 AR session started');
            this.isARActive = true;
            this.hideInstructions();
            this.placeAtom();
        });

        this.renderer.xr.addEventListener('sessionend', () => {
            console.log('🛑 AR session ended');
            this.isARActive = false;
            this.showInstructions();
            // Remove atom when AR session ends
            if (this.atom) {
                this.scene.remove(this.atom.getGroup());
                this.atom = null;
                this.atomPlaced = false;
            }
        });
    }

    setupInteractions() {
        this.interactionManager = new InteractionManager(
            this.renderer, 
            this.scene, 
            this.camera
        );

        // Setup controller select events for AR interactions
        const controllers = this.renderer.xr.getController(0);
        controllers.addEventListener('select', () => this.onARSelect());
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

    onARSelect() {
        // AR interactions handled by InteractionManager
        console.log('AR controller select event');
    }

    placeAtom() {
        if (this.atomPlaced) return;
        
        console.log('🎯 Placing atom in AR');
        
        // Create atom model
        this.atom = new AtomModel();
        
        // Position atom in front of camera in AR space
        const atomGroup = this.atom.getGroup();
        atomGroup.position.set(0, 0, -1.5); // In front of user
        atomGroup.scale.setScalar(0.8); // Slightly smaller for AR
        
        this.scene.add(atomGroup);
        
        // Setup interactions
        this.interactionManager.setAtom(this.atom);
        
        // Update state
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
        
        console.log('✅ Atom placed successfully in AR');

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

        // Animate AR effects
        this.animateAREffects(deltaTime);
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
        
        // Performance monitoring
        this.frameCount++;
        if (this.frameCount % 60 === 0) {
            this.updatePerformanceStats();
        }
    }

    animateAREffects(deltaTime) {
        // Animate lights for dynamic effects
        if (this.lights) {
            this.lights.point1.position.x = Math.sin(this.clock.getElapsedTime() * 0.5) * 3;
            this.lights.point1.position.z = Math.cos(this.clock.getElapsedTime() * 0.3) * 3;
            
            this.lights.point2.position.x = Math.cos(this.clock.getElapsedTime() * 0.4) * 2;
            this.lights.point2.position.y = Math.sin(this.clock.getElapsedTime() * 0.6) * 2;
        }
    }

    updatePerformanceStats() {
        const info = this.renderer.info;
        console.log(`📊 Performance - Triangles: ${info.render.triangles}, Calls: ${info.render.calls}`);
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
            if (this.atom && this.atom.highlightKind) {
                this.atom.highlightKind('proton');
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
            if (this.atom && this.atom.highlightKind) {
                this.atom.highlightKind('electron');
            }
        } else {
            panel.innerHTML = `
                <h3>معلومات تعليمية</h3>
                <p>هذه هي الذرّة. هي أصغر جزء في المادة، وكل شيء حولك مكوّن منها. وتتكون من أجزاء عدة:</p>
                <p>لنتعرف عليها!</p>
            `;
        }
    }

    updateEducationText(part) {
        const panel = document.getElementById('eduPanel');
        if (!panel) return;
        
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
        
        if (this.interactionManager && this.interactionManager.setCurrentScene) {
            this.interactionManager.setCurrentScene(clamped);
        }
        const panel = document.getElementById('eduPanel');
        const challenge = document.getElementById('challengeOverlay');
        if (challenge) challenge.classList.add('hidden');
        if (!panel) return;

        if (this.atom && this.atom.clearHighlights) this.atom.clearHighlights();
        if (this.atom && this.atom.restoreOpacity) this.atom.restoreOpacity();
        if (this.atom && this.atom.stopProtonAnimation) this.atom.stopProtonAnimation();
        if (this.atom && this.atom.stopNeutronAnimation) this.atom.stopNeutronAnimation();

        switch (clamped) {
            case 0:
                panel.classList.remove('hidden');
                panel.innerHTML = `
                    <h3>معلومات تعليمية</h3>
                    <p>هذه هي الذرّة. هي أصغر جزء في المادة، وكل شيء حولك مكوّن منها. وتتكون من أجزاء عدة:</p>
                    <p>لنتعرف عليها!</p>
                    <p><em>اضغط على أي جزء من الذرّة لمعرفة المزيد عنه</em></p>
                `;
                break;
            case 1:
                panel.classList.remove('hidden');
                panel.innerHTML = `
                    <h3>البروتونات</h3>
                    <p>توجد البروتونات داخل نواة الذرة، وتحمل الشحنة الموجبة، وتحدد نوع العنصر (العدد الذري).</p>
                `;
                if (this.atom && this.atom.highlightKind) {
                    this.atom.highlightKind('proton', 1);
                    this.atom.animateProtons(false);
                }
                break;
            case 2:
                panel.classList.remove('hidden');
                panel.innerHTML = `
                    <h3>النيوترونات</h3>
                    <p>توجد داخل النواة وهي متعادلة، أي لا تحمل شحنة، وتساهم في استقرار النواة.</p>
                `;
                if (this.atom && this.atom.highlightKind) {
                    this.atom.highlightKind('neutron', 1);
                    this.atom.animateNeutrons(false);
                }
                break;
            case 3:
                panel.classList.remove('hidden');
                panel.innerHTML = `
                    <h3>الإلكترونات</h3>
                    <p>الإلكترونات تدور حول النواة في مستويات طاقة مختلفة وتشكل سحابة إلكترونية وشحنتها سالبة.</p>
                `;
                if (this.atom && this.atom.highlightKind) this.atom.highlightKind('electron', 1);
                break;
            case 4:
                panel.classList.add('hidden');
                if (challenge) challenge.classList.remove('hidden');
                this.setupChallengeDnD();
                break;
            case 5:
                panel.classList.remove('hidden');
                panel.innerHTML = `
                    <h3>ملخص</h3>
                    <p>الذرّة تتكون من: بروتونات موجبة ونيوترونات متعادلة (يشكلان النواة)، وإلكترونات سالبة تدور حول النواة في مستويات الطاقة مكوّنة السحابة الإلكترونية.</p>
                `;
                break;
        }
    }

    setupChallengeDnD() {
        this.setupQuizClickSelect();
    }

    setupQuizClickSelect() {
        const answerCards = document.querySelectorAll('#challengeOverlay .answer-card');
        const dropSlots = document.querySelectorAll('#challengeOverlay .drop-slot');
        
        this.selectedAnswer = null;
        this.selectedCard = null;
        
        answerCards.forEach(card => {
            card.removeAttribute('draggable');
            
            card.addEventListener('click', (e) => {
                answerCards.forEach(c => c.classList.remove('selected'));
                
                card.classList.add('selected');
                this.selectedAnswer = card.getAttribute('data-answer');
                this.selectedCard = card;
                
                const statusElement = document.getElementById('quizStatus');
                if (statusElement) {
                    const particleName = this.getParticleName(this.selectedAnswer);
                    statusElement.textContent = `تم اختيار ${particleName} - الآن اضغط على المكان المناسب`;
                    statusElement.style.color = '#0066cc';
                }
            });
        });
        
        dropSlots.forEach(slot => {
            slot.addEventListener('click', (e) => {
                if (!this.selectedAnswer || !this.selectedCard) {
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
        
        card.classList.remove('selected');
        this.selectedAnswer = null;
        this.selectedCard = null;
        
        if (isCorrect) {
            this.animateCardToSlot(card, slot, () => {
                slot.classList.add('correct');
                slot.classList.remove('incorrect');
                slot.querySelector('.slot-content').textContent = this.getParticleName(answerType);
                
                card.style.display = 'none';
                
                this.updateQuizStatus(true, answerType);
                this.checkQuizCompletion();
            });
        } else {
            slot.classList.add('incorrect');
            slot.classList.remove('correct');
            this.updateQuizStatus(false, answerType);
            
            setTimeout(() => {
                slot.classList.remove('incorrect');
                slot.querySelector('.slot-content').textContent = '';
            }, 2000);
        }
    }

    animateCardToSlot(card, slot, callback) {
        const cardRect = card.getBoundingClientRect();
        const slotRect = slot.getBoundingClientRect();
        
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
        
        setTimeout(() => {
            clone.style.top = slotRect.top + 'px';
            clone.style.left = slotRect.left + 'px';
            clone.style.transform = 'scale(0.8)';
            clone.style.opacity = '0.8';
        }, 10);
        
        setTimeout(() => {
            document.body.removeChild(clone);
            if (callback) callback();
        }, 500);
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
            <h3>❌ Error</h3>
            <p>${message}</p>
            <button onclick="this.parentElement.remove()" 
                    style="background: white; color: red; border: none; padding: 10px 20px; border-radius: 5px; margin-top: 10px; cursor: pointer;">
                Close
            </button>
        `;
        document.body.appendChild(errorDiv);
    }

    dispose() {
        if (this.interactionManager) {
            this.interactionManager.dispose();
        }
        
        if (this.atom) {
            this.atom.dispose();
        }
        
        window.removeEventListener('resize', this.onWindowResize);
        
        console.log('🧹 WebAR Atom App disposed');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Starting WebAR Atom App...');
    
    if (navigator.xr) {
        navigator.xr.isSessionSupported('immersive-ar').then((supported) => {
            if (supported) {
                console.log('✅ WebXR AR supported');
                window.webARApp = new WebARAtomApp();
            } else {
                console.warn('⚠️ WebXR AR not supported');
                window.webARApp = new WebARAtomApp();
            }
        });
    } else {
        console.warn('⚠️ WebXR not available');
        window.webARApp = new WebARAtomApp();
    }
});

window.addEventListener('beforeunload', () => {
    if (window.webARApp) {
        window.webARApp.dispose();
    }
});

export { WebARAtomApp };
