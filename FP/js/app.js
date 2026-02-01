import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { AtomModel } from './atom.js';

class WebFPAtomApp {
    constructor() {
        // Core Three.js components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        
        // App components
        this.atom = null;
        this.sceneIndex = 0; // 0..5 (6 scenes)
        
        // State
        this.atomPlaced = false;
        
        // Performance
        this.clock = new THREE.Clock();
        this.frameCount = 0;
        
        this.init();
    }

    async init() {
        try {
            console.log('Initializing WebFP Atom App...');
            this.createScene();
            console.log('Scene created');
            this.createCamera();
            console.log('Camera created');
            this.createRenderer();
            console.log('Renderer created');
            this.createControls();
            console.log('Controls created');
            this.createLighting();
            console.log('Lighting created');
            this.setupEventListeners();
            this.setupEducationUI();
            this.setupSceneControls();
            this.placeAtom();
            console.log('Atom placed');
            
            // Do an initial render
            this.renderer.render(this.scene, this.camera);
            console.log('Initial render completed');
            
            this.animate();
            
            console.log('✅ WebFP Atom App initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize WebFP Atom App:', error);
            console.error('Error stack:', error.stack);
            this.showError('Failed to initialize. Please check browser compatibility. Error: ' + error.message);
        }
    }

    createScene() {
        this.scene = new THREE.Scene();
        this.scene.background = this.createSceneBackground();
        this.createStarfield();
        console.log('Scene created with background');
    }

    createSceneBackground() {
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(size * 0.5, size * 0.3, 0, size * 0.5, size * 0.5, size * 0.8);
        gradient.addColorStop(0, '#2d1b4e');
        gradient.addColorStop(0.35, '#1a1a3e');
        gradient.addColorStop(0.6, '#0f2744');
        gradient.addColorStop(1, '#050814');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    createStarfield() {
        const starCount = 400;
        const stars = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount; i++) {
            const radius = 8 + Math.random() * 6;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            stars[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            stars[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            stars[i * 3 + 2] = radius * Math.cos(phi);
        }
        const starGeometry = new THREE.BufferGeometry();
        starGeometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
        const starMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.08,
            transparent: true,
            opacity: 0.85,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.starfield = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(this.starfield);
    }

    createCamera() {
        this.camera = new THREE.PerspectiveCamera(
            70, 
            window.innerWidth / window.innerHeight, 
            0.01, 
            20
        );
        this.camera.position.set(0, 0, 1.5); // Closer to atom for better view
        this.camera.lookAt(0, 0, 0);
        console.log('Camera position:', this.camera.position);
    }

    createRenderer() {
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: false,
            powerPreference: "high-performance"
        });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Add to DOM
        const container = document.getElementById('container');
        if (!container) {
            throw new Error('Container element not found!');
        }
        
        // Ensure canvas is visible
        this.renderer.domElement.style.display = 'block';
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        
        container.appendChild(this.renderer.domElement);
        console.log('Renderer canvas added to DOM', this.renderer.domElement);
    }

    createControls() {
        // Use OrbitControls for mouse/touch interaction
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enableZoom = true;
        this.controls.enablePan = false;
        this.controls.minDistance = 0.5;
        this.controls.maxDistance = 5;
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    createLighting() {
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

    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
        
        // Mouse click for part selection
        this.renderer.domElement.addEventListener('click', (e) => this.onCanvasClick(e), false);
    }

    setupSceneControls() {
        const nextBtn = document.getElementById('nextScene');
        const prevBtn = document.getElementById('prevScene');
        if (nextBtn) nextBtn.addEventListener('click', () => this.gotoScene(this.sceneIndex + 1));
        if (prevBtn) prevBtn.addEventListener('click', () => this.gotoScene(this.sceneIndex - 1));
    }

    onCanvasClick(event) {
        if (!this.atom || this.sceneIndex !== 0) return;
        
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);
        
        const intersects = raycaster.intersectObject(this.atom.getGroup(), true);
        
        if (intersects.length > 0) {
            const clickedObject = intersects[0].object;
            // Highlighting disabled - no fadeExcept call
            this.handlePartSelection(this.resolvePart(clickedObject));
        }
        // Highlighting disabled - no restoreOpacity call
    }

    resolvePart(object) {
        let current = object;
        while (current) {
            if (current.userData && current.userData.part) return current.userData.part;
            current = current.parent;
        }
        return 'atom';
    }

    placeAtom() {
        console.log('🎯 Placing atom');
        
        try {
            // Create atom model
            this.atom = new AtomModel();
            console.log('AtomModel created');
            
            // Position atom at center
            const atomGroup = this.atom.getGroup();
            atomGroup.position.set(0, 0, 0);
            atomGroup.scale.setScalar(0.7); // Smaller scale for better mobile viewing
            
            this.scene.add(atomGroup);
            console.log('Atom added to scene', atomGroup);
            console.log('Atom position:', atomGroup.position);
            console.log('Atom scale:', atomGroup.scale);
            
            // Update state
            this.atomPlaced = true;
            
            // Show intro panel
            const panel = document.getElementById('eduPanel');
            if (panel) {
                panel.classList.remove('hidden');
                panel.innerHTML = `
                    <h3>معلومات تعليمية</h3>
                    <p>هذه هي الذرّة. هي أصغر جزء في المادة، وكل شيء حولك مكوّن منها. وتتكون من أجزاء عدة:</p>
                    <p>لنتعرف عليها!</p>
                `;
            }
            
            console.log('✅ Atom placed successfully');

            // Show scene footer controls
            const footer = document.getElementById('sceneFooter');
            if (footer) footer.classList.remove('hidden');
            this.gotoScene(0);
        } catch (error) {
            console.error('Error placing atom:', error);
            throw error;
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        const animateLoop = () => {
            requestAnimationFrame(animateLoop);
            this.render();
        };
        animateLoop();
    }

    render() {
        if (!this.scene || !this.camera || !this.renderer) {
            console.error('Scene, camera, or renderer is missing!');
            return;
        }
        
        const deltaTime = this.clock.getDelta();
        
        // Update controls
        if (this.controls) {
            this.controls.update();
        }
        
        // Update atom animation
        if (this.atom) {
            this.atom.animate(deltaTime);
        }

        // Animate effects
        this.animateEffects(deltaTime);
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
        
        // Performance monitoring
        this.frameCount++;
        if (this.frameCount % 60 === 0) {
            this.updatePerformanceStats();
        }
    }

    animateEffects(deltaTime) {
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
        if (this.sceneIndex === 0) {
            this.showPartInfo(part);
        }
    }

    showPartInfo(part) {
        const panel = document.getElementById('eduPanel');
        if (!panel) return;

        // Highlighting disabled - no clearHighlights call

        if (part === 'nucleus') {
            panel.innerHTML = `
                <h3>النواة</h3>
                <p>هنا تقع البروتونات والنيوترونات في مركز الذرّة.</p>
                <p>البروتونات موجبة الشحنة والنيوترونات متعادلة، وتشكلان معًا معظم كتلة الذرّة.</p>
            `;
            // Highlighting disabled - no highlightKind call
        } else if (part === 'electron' || part === 'orbit') {
            panel.innerHTML = `
                <h3>الإلكترونات</h3>
                <p>الإلكترونات تدور حول النواة في مستويات طاقة مختلفة.</p>
                <p>تتحرك بسرعة كبيرة وتشكل السحابة الإلكترونية حول النواة.</p>
            `;
            // Highlighting disabled - no highlightKind call
        } else {
            panel.innerHTML = `
                <h3>معلومات تعليمية</h3>
                <p>هذه هي الذرّة. هي أصغر جزء في المادة، وكل شيء حولك مكوّن منها. وتتكون من أجزاء عدة:</p>
                <p>لنتعرف عليها!</p>
            `;
        }
    }

    updateSceneIndicator() {
        const ind = document.getElementById('sceneIndicator');
        if (!ind) return;
        const current = this.sceneIndex + 1;
        const total = 6;
        ind.textContent = `${current}/${total}`;
    }

    gotoScene(index) {
        if (!this.atomPlaced) return;
        const clamped = Math.max(0, Math.min(5, index));
        this.sceneIndex = clamped;
        this.updateSceneIndicator();
        
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
        if (this.atom) {
            this.atom.dispose();
        }
        
        window.removeEventListener('resize', this.onWindowResize);
        
        console.log('🧹 WebFP Atom App disposed');
    }
}

// Initialize app when DOM is loaded
function initApp() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('🚀 Starting WebFP Atom App...');
            try {
                window.webFPApp = new WebFPAtomApp();
            } catch (error) {
                console.error('Failed to create WebFPAtomApp:', error);
            }
        });
    } else {
        // DOM already loaded
        console.log('🚀 Starting WebFP Atom App (DOM already loaded)...');
        try {
            window.webFPApp = new WebFPAtomApp();
        } catch (error) {
            console.error('Failed to create WebFPAtomApp:', error);
        }
    }
}

initApp();

window.addEventListener('beforeunload', () => {
    if (window.webFPApp) {
        window.webFPApp.dispose();
    }
});

export { WebFPAtomApp };
