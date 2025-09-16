// Model-viewer based WebAR Atom App with iOS Safari support

class WebARAtomApp {
    constructor() {
        // App components
        this.modelViewer = null;
        this.sceneIndex = 0; // 0..5 (6 scenes)
        
        // State
        this.isARActive = false;
        this.modelLoaded = false;
        
        this.init();
    }

    async init() {
        try {
            this.setupModelViewer();
            this.setupEventListeners();
            this.setupEducationUI();
            this.setupSceneControls();
            
            console.log('✅ WebAR Atom App with model-viewer initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize WebAR Atom App:', error);
            this.showError('Failed to initialize AR. Please check browser compatibility.');
        }
    }

    setupModelViewer() {
        this.modelViewer = document.getElementById('atomViewer');
        
        // Model viewer events
        this.modelViewer.addEventListener('load', () => {
            console.log('🎯 Atom model loaded successfully');
            this.modelLoaded = true;
            this.showInstructions();
            this.setupSceneFooter();
        });

        this.modelViewer.addEventListener('ar-status', (event) => {
            if (event.detail.status === 'session-started') {
                console.log('🚀 AR session started');
                this.isARActive = true;
                this.hideInstructions();
                this.showSceneControls();
            } else if (event.detail.status === 'not-presenting') {
                console.log('🛑 AR session ended');
                this.isARActive = false;
                this.showInstructions();
            }
        });

        this.modelViewer.addEventListener('error', (error) => {
            console.error('❌ Model loading error:', error);
            this.showError('Failed to load 3D model. Please try again.');
        });

        // Handle hotspot clicks for educational content
        this.modelViewer.addEventListener('click', (event) => {
            const hotspot = event.target.closest('.hotspot');
            if (hotspot) {
                this.handleHotspotClick(hotspot);
            }
        });

        // iOS Safari specific event handling
        this.modelViewer.addEventListener('touchstart', (event) => {
            // Prevent default touch behavior that might interfere with AR
            if (this.isARActive) {
                event.preventDefault();
            }
        });

        // Setup AR button click handler
        const arButton = document.getElementById('arButton');
        if (arButton) {
            arButton.addEventListener('click', () => {
                if (this.modelViewer.canActivateAR) {
                    this.modelViewer.activateAR();
                } else {
                    this.showError('AR is not supported on this device/browser. Please use a compatible device.');
                }
            });
        }
    }

    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
        
        // Model interaction events
        if (this.modelViewer) {
            this.modelViewer.addEventListener('camera-change', () => {
                // Handle camera changes if needed
            });
        }

        // iOS Safari specific optimizations
        if (this.isIOSSafari()) {
            this.setupIOSOptimizations();
        }
    }

    isIOSSafari() {
        const ua = navigator.userAgent;
        const iOS = /iPad|iPhone|iPod/.test(ua);
        const webkit = /WebKit/.test(ua);
        return iOS && webkit && !/(CriOS|FxiOS|OPiOS|mercury)/.test(ua);
    }

    setupIOSOptimizations() {
        // Prevent zoom on double tap
        document.addEventListener('touchstart', (event) => {
            if (event.touches.length > 1) {
                event.preventDefault();
            }
        });

        // Prevent context menu on long press
        document.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });

        // Optimize viewport for iOS
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport) {
            viewport.setAttribute('content', 
                'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
            );
        }
    }

    handleHotspotClick(hotspot) {
        const slotName = hotspot.getAttribute('slot');
        console.log('Hotspot clicked:', slotName);
        
        // Show educational content based on hotspot
        if (slotName === 'hotspot-nucleus') {
            this.showEducationalContent('nucleus');
        } else if (slotName === 'hotspot-electron') {
            this.showEducationalContent('electron');
        }
    }

    showEducationalContent(part) {
        const panel = document.getElementById('eduPanel');
        if (!panel) return;

        panel.classList.remove('hidden');
        
        switch (part) {
            case 'nucleus':
                panel.innerHTML = `
                    <h3>النواة</h3>
                    <p>النواة هي مركز الذرة وتحتوي على البروتونات والنيوترونات.</p>
                    <p>البروتونات تحمل شحنة موجبة والنيوترونات متعادلة الشحنة.</p>
                `;
                break;
            case 'electron':
                panel.innerHTML = `
                    <h3>الإلكترونات</h3>
                    <p>الإلكترونات تدور حول النواة في مدارات مختلفة.</p>
                    <p>تحمل شحنة سالبة وتحدد الخصائص الكيميائية للعنصر.</p>
                `;
                break;
        }
    }

    setupSceneControls() {
        const nextBtn = document.getElementById('nextScene');
        const prevBtn = document.getElementById('prevScene');
        if (nextBtn) nextBtn.addEventListener('click', () => this.gotoScene(this.sceneIndex + 1));
        if (prevBtn) prevBtn.addEventListener('click', () => this.gotoScene(this.sceneIndex - 1));
    }

    setupSceneFooter() {
        const footer = document.getElementById('sceneFooter');
        if (footer && this.modelLoaded) {
            footer.classList.remove('hidden');
            this.gotoScene(0);
        }
    }

    showSceneControls() {
        const footer = document.getElementById('sceneFooter');
        if (footer) {
            footer.classList.remove('hidden');
        }
    }

    onWindowResize() {
        // Model-viewer handles its own resizing
        console.log('Window resized');
    }

    showInstructions() {
        const instructions = document.getElementById('instructions');
        if (instructions) {
            instructions.classList.remove('hidden');
            // Update instructions for model-viewer
            instructions.innerHTML = `
                <h3>🚀 WebAR Atom Visualizer</h3>
                <ul>
                    <li>📱 Tap "View in AR" to start AR experience</li>
                    <li>🎯 Point camera at flat surface</li>
                    <li>📏 Pinch to scale the atom</li>
                    <li>🔄 Drag to rotate</li>
                    <li>👆 Explore different scenes below</li>
                </ul>
            `;
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

    updateSceneIndicator() {
        const ind = document.getElementById('sceneIndicator');
        if (!ind) return;
        const human = this.sceneIndex + 1;
        ind.textContent = `المشهد ${human} / ٦`;
    }

    gotoScene(index) {
        if (!this.modelLoaded) return;
        const clamped = Math.max(0, Math.min(5, index));
        this.sceneIndex = clamped;
        this.updateSceneIndicator();
        
        const panel = document.getElementById('eduPanel');
        const challenge = document.getElementById('challengeOverlay');
        if (challenge) challenge.classList.add('hidden');
        if (!panel) return;

        // Update model viewer annotations or materials based on scene
        this.updateModelForScene(clamped);

        switch (clamped) {
            case 0: // Scene 1: ظهور الذرة
                panel.classList.remove('hidden');
                panel.innerHTML = `
                    <h3>معلومات تعليمية</h3>
                    <p>هذه هي الذرّة. هي أصغر جزء في المادة، وكل شيء حولك مكوّن منها. وتتكون من أجزاء عدة:</p>
                    <p>لنتعرف عليها!</p>
                    <p><em>استخدم عناصر التحكم لاستكشاف النموذج ثلاثي الأبعاد</em></p>
                `;
                break;
            case 1: // Scene 2: البروتون
                panel.classList.remove('hidden');
                panel.innerHTML = `
                    <h3>البروتونات</h3>
                    <p>توجد البروتونات داخل نواة الذرة، وتحمل الشحنة الموجبة، وتحدد نوع العنصر (العدد الذري).</p>
                    <p>لونها أحمر في هذا النموذج للتمييز.</p>
                `;
                break;
            case 2: // Scene 3: النيوترون
                panel.classList.remove('hidden');
                panel.innerHTML = `
                    <h3>النيوترونات</h3>
                    <p>توجد داخل النواة وهي متعادلة، أي لا تحمل شحنة، وتساهم في استقرار النواة.</p>
                    <p>لونها أزرق في هذا النموذج للتمييز.</p>
                `;
                break;
            case 3: // Scene 4: الإلكترون
                panel.classList.remove('hidden');
                panel.innerHTML = `
                    <h3>الإلكترونات</h3>
                    <p>الإلكترونات تدور حول النواة في مستويات طاقة مختلفة وتشكل سحابة إلكترونية وشحنتها سالبة.</p>
                    <p>لونها أخضر في هذا النموذج للتمييز.</p>
                `;
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
                    <p>🎉 تهانينا! لقد أكملت رحلة استكشاف الذرة!</p>
                `;
                break;
        }
    }

    updateModelForScene(sceneIndex) {
        // Update model-viewer camera position or annotations based on scene
        if (!this.modelViewer) return;

        switch (sceneIndex) {
            case 1: // Focus on nucleus for protons
                this.modelViewer.cameraOrbit = "45deg 75deg 1.5m";
                break;
            case 2: // Focus on nucleus for neutrons
                this.modelViewer.cameraOrbit = "-45deg 75deg 1.5m";
                break;
            case 3: // Focus on electron orbits
                this.modelViewer.cameraOrbit = "0deg 45deg 2.5m";
                break;
            default:
                this.modelViewer.cameraOrbit = "0deg 75deg 2m";
                break;
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
        
        // Setup drop slots - click to place selected answer
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
        console.log('🧹 WebAR Atom App disposed');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Starting WebAR Atom App with model-viewer...');
    
    // Check if model-viewer is available
    if (customElements.get('model-viewer')) {
        new WebARAtomApp();
    } else {
        // Wait for model-viewer to be defined
        customElements.whenDefined('model-viewer').then(() => {
            new WebARAtomApp();
        });
    }
});

// Handle app lifecycle
window.addEventListener('beforeunload', () => {
    if (window.webARApp) {
        window.webARApp.dispose();
    }
});

export { WebARAtomApp };
