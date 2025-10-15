import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';

export class UI3D {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        
        // UI containers
        this.uiGroup = new THREE.Group();
        this.eduPanel = null;
        this.sceneControls = null;
        this.currentSceneIndex = 0;
        
        // Materials
        this.panelMaterial = new THREE.MeshBasicMaterial({
            color: 0x1a1a2e,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        
        this.buttonMaterial = new THREE.MeshBasicMaterial({
            color: 0x4ECDC4,
            transparent: true,
            opacity: 0.8
        });
        
        this.textMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1.0
        });
        
        // Add UI group to scene
        this.scene.add(this.uiGroup);
        
        this.createEducationalPanel();
        this.createSceneControls();
        
        console.log('3D UI system initialized');
    }
    
    createEducationalPanel() {
        // Create panel background
        const panelGeometry = new THREE.PlaneGeometry(3, 2);
        this.eduPanel = new THREE.Mesh(panelGeometry, this.panelMaterial.clone());
        
        // Position panel to the right of the atom
        this.eduPanel.position.set(2.5, 1, -2);
        this.eduPanel.rotation.y = -Math.PI / 6; // Angle towards user
        
        // Add border
        const borderGeometry = new THREE.PlaneGeometry(3.1, 2.1);
        const borderMaterial = new THREE.MeshBasicMaterial({
            color: 0x4ECDC4,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        const border = new THREE.Mesh(borderGeometry, borderMaterial);
        border.position.z = -0.001; // Slightly behind panel
        this.eduPanel.add(border);
        
        this.uiGroup.add(this.eduPanel);
        
        // Create text content
        this.updateEducationalContent("مرحباً بك في عالم الذرة!", "اضغط على أجزاء الذرة لتتعلم عنها");
    }
    
    createSceneControls() {
        const controlsGroup = new THREE.Group();
        
        // Previous button
        const prevButton = this.createButton("السابق", 0x4ECDC4);
        prevButton.position.set(-1, 0, 0);
        prevButton.userData = { action: 'previous' };
        controlsGroup.add(prevButton);
        
        // Scene indicator
        const indicatorPanel = this.createTextPanel("المشهد ١ / ٦", 1.5, 0.3);
        indicatorPanel.position.set(0, 0, 0);
        controlsGroup.add(indicatorPanel);
        
        // Next button
        const nextButton = this.createButton("التالي", 0x4ECDC4);
        nextButton.position.set(1, 0, 0);
        nextButton.userData = { action: 'next' };
        controlsGroup.add(nextButton);
        
        // Position controls at bottom
        controlsGroup.position.set(0, -2.5, -2);
        controlsGroup.rotation.x = Math.PI / 12; // Slight upward angle
        
        this.sceneControls = controlsGroup;
        this.uiGroup.add(controlsGroup);
    }
    
    createButton(text, color) {
        const buttonGroup = new THREE.Group();
        
        // Button background
        const buttonGeometry = new THREE.PlaneGeometry(0.8, 0.3);
        const buttonMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.8
        });
        const button = new THREE.Mesh(buttonGeometry, buttonMaterial);
        buttonGroup.add(button);
        
        // Button border
        const borderGeometry = new THREE.PlaneGeometry(0.82, 0.32);
        const borderMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.6
        });
        const border = new THREE.Mesh(borderGeometry, borderMaterial);
        border.position.z = -0.001;
        buttonGroup.add(border);
        
        // Add text using canvas texture
        const textTexture = this.createTextTexture(text, 64, '#000000', '#4ECDC4');
        const textMaterial = new THREE.MeshBasicMaterial({
            map: textTexture,
            transparent: true
        });
        const textGeometry = new THREE.PlaneGeometry(0.7, 0.25);
        const textMesh = new THREE.Mesh(textGeometry, textMaterial);
        textMesh.position.z = 0.001;
        buttonGroup.add(textMesh);
        
        return buttonGroup;
    }
    
    createTextPanel(text, width = 2, height = 1) {
        const panelGroup = new THREE.Group();
        
        // Panel background
        const panelGeometry = new THREE.PlaneGeometry(width, height);
        const panelMaterial = new THREE.MeshBasicMaterial({
            color: 0x2a2a3e,
            transparent: true,
            opacity: 0.9
        });
        const panel = new THREE.Mesh(panelGeometry, panelMaterial);
        panelGroup.add(panel);
        
        // Text
        const textTexture = this.createTextTexture(text, 32, '#ffffff', 'transparent');
        const textMaterial = new THREE.MeshBasicMaterial({
            map: textTexture,
            transparent: true
        });
        const textGeometry = new THREE.PlaneGeometry(width * 0.9, height * 0.8);
        const textMesh = new THREE.Mesh(textGeometry, textMaterial);
        textMesh.position.z = 0.001;
        panelGroup.add(textMesh);
        
        return panelGroup;
    }
    
    createTextTexture(text, fontSize = 48, textColor = '#ffffff', backgroundColor = 'transparent') {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        // Set canvas size
        canvas.width = 512;
        canvas.height = 256;
        
        // Fill background
        if (backgroundColor !== 'transparent') {
            context.fillStyle = backgroundColor;
            context.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        // Set text properties
        context.font = `${fontSize}px Arial, sans-serif`;
        context.fillStyle = textColor;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Handle Arabic text direction
        context.direction = 'rtl';
        
        // Draw text with word wrapping
        this.wrapText(context, text, canvas.width / 2, canvas.height / 2, canvas.width * 0.9, fontSize * 1.2);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }
    
    wrapText(context, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        const lines = [];
        
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = context.measureText(testLine);
            const testWidth = metrics.width;
            
            if (testWidth > maxWidth && n > 0) {
                lines.push(line);
                line = words[n] + ' ';
            } else {
                line = testLine;
            }
        }
        lines.push(line);
        
        // Draw lines
        const totalHeight = lines.length * lineHeight;
        const startY = y - (totalHeight / 2) + (lineHeight / 2);
        
        for (let i = 0; i < lines.length; i++) {
            context.fillText(lines[i], x, startY + (i * lineHeight));
        }
    }
    
    updateEducationalContent(title, content) {
        if (!this.eduPanel) return;
        
        // Remove existing text
        const existingText = this.eduPanel.children.find(child => child.userData.isText);
        if (existingText) {
            this.eduPanel.remove(existingText);
        }
        
        // Create new text
        const fullText = `${title}\n\n${content}`;
        const textTexture = this.createTextTexture(fullText, 36, '#ffffff', 'transparent');
        const textMaterial = new THREE.MeshBasicMaterial({
            map: textTexture,
            transparent: true
        });
        const textGeometry = new THREE.PlaneGeometry(2.8, 1.8);
        const textMesh = new THREE.Mesh(textGeometry, textMaterial);
        textMesh.position.z = 0.001;
        textMesh.userData.isText = true;
        
        this.eduPanel.add(textMesh);
    }
    
    updateSceneIndicator(sceneIndex, totalScenes) {
        this.currentSceneIndex = sceneIndex;
        const indicatorText = `المشهد ${sceneIndex + 1} / ${totalScenes}`;
        
        // Find and update the indicator panel
        if (this.sceneControls) {
            const indicator = this.sceneControls.children.find(child => 
                child.children && child.children.some(grandchild => grandchild.userData.isText)
            );
            
            if (indicator) {
                // Remove old text
                const oldText = indicator.children.find(child => child.userData.isText);
                if (oldText) {
                    indicator.remove(oldText);
                }
                
                // Add new text
                const textTexture = this.createTextTexture(indicatorText, 32, '#ffffff', 'transparent');
                const textMaterial = new THREE.MeshBasicMaterial({
                    map: textTexture,
                    transparent: true
                });
                const textGeometry = new THREE.PlaneGeometry(1.4, 0.25);
                const textMesh = new THREE.Mesh(textGeometry, textMaterial);
                textMesh.position.z = 0.001;
                textMesh.userData.isText = true;
                
                indicator.add(textMesh);
            }
        }
    }
    
    handleControllerInteraction(intersectedObject) {
        if (!intersectedObject.userData) return false;
        
        const action = intersectedObject.userData.action;
        if (action === 'previous') {
            this.onPreviousScene();
            return true;
        } else if (action === 'next') {
            this.onNextScene();
            return true;
        }
        
        return false;
    }
    
    onPreviousScene() {
        if (this.onSceneChange) {
            this.onSceneChange(Math.max(0, this.currentSceneIndex - 1));
        }
    }
    
    onNextScene() {
        if (this.onSceneChange) {
            this.onSceneChange(Math.min(5, this.currentSceneIndex + 1));
        }
    }
    
    setSceneChangeCallback(callback) {
        this.onSceneChange = callback;
    }
    
    show() {
        this.uiGroup.visible = true;
    }
    
    hide() {
        this.uiGroup.visible = false;
    }
    
    dispose() {
        // Clean up geometries and materials
        this.uiGroup.traverse((child) => {
            if (child.geometry) {
                child.geometry.dispose();
            }
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => {
                        if (material.map) material.map.dispose();
                        material.dispose();
                    });
                } else {
                    if (child.material.map) child.material.map.dispose();
                    child.material.dispose();
                }
            }
        });
        
        this.scene.remove(this.uiGroup);
    }
}
