import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';

export class InteractionManager {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.atom = null;
        
        // Controllers
        this.controllers = [];
        this.controllerGrips = [];
        
        // Interaction state
        this.isGrabbing = false;
        this.grabController = null;
        this.initialControllerPosition = new THREE.Vector3();
        this.initialAtomPosition = new THREE.Vector3();
        this.initialScale = 1;
        
        // Multi-controller scaling
        this.isScaling = false;
        this.scalingControllers = [];
        this.initialDistance = 0;
        
        // Touch state for fallback
        this.touchState = {
            touches: [],
            initialDistance: 0,
            initialScale: 1,
            isScaling: false
        };

        this.setupControllers();
        this.setupFallbackControls();
    }

    setupControllers() {
        // Setup XR controllers
        for (let i = 0; i < 2; i++) {
            const controller = this.renderer.xr.getController(i);
            const controllerGrip = this.renderer.xr.getControllerGrip(i);

            // Controller events
            controller.addEventListener('selectstart', (event) => this.onControllerSelectStart(event));
            controller.addEventListener('selectend', (event) => this.onControllerSelectEnd(event));
            controller.addEventListener('squeezestart', (event) => this.onControllerSqueezeStart(event));
            controller.addEventListener('squeezeend', (event) => this.onControllerSqueezeEnd(event));

            // Add controller models
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, -1)
            ]);
            const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffffff }));
            controller.add(line);

            // Add controller pointer
            const pointer = new THREE.Mesh(
                new THREE.SphereGeometry(0.01, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0xff0000 })
            );
            pointer.position.z = -1;
            controller.add(pointer);

            this.scene.add(controller);
            this.scene.add(controllerGrip);
            
            this.controllers.push(controller);
            this.controllerGrips.push(controllerGrip);
        }
    }

    setupFallbackControls() {
        const canvas = this.renderer.domElement;

        // Touch events for mobile fallback
        canvas.addEventListener('touchstart', (event) => this.onTouchStart(event), { passive: false });
        canvas.addEventListener('touchmove', (event) => this.onTouchMove(event), { passive: false });
        canvas.addEventListener('touchend', (event) => this.onTouchEnd(event), { passive: false });

        // Mouse events for desktop testing
        canvas.addEventListener('mousedown', (event) => this.onMouseDown(event));
        canvas.addEventListener('mousemove', (event) => this.onMouseMove(event));
        canvas.addEventListener('mouseup', (event) => this.onMouseUp(event));
        canvas.addEventListener('wheel', (event) => this.onWheel(event), { passive: false });

        // UI button controls
        document.getElementById('scaleUp')?.addEventListener('click', () => this.scaleAtom(1.1));
        document.getElementById('scaleDown')?.addEventListener('click', () => this.scaleAtom(0.9));
        document.getElementById('reset')?.addEventListener('click', () => this.resetAtom());
    }

    setAtom(atom) {
        this.atom = atom;
    }

    // WebXR Controller Events
    onControllerSelectStart(event) {
        if (!this.atom) return;

        const controller = event.target;
        const intersections = this.getIntersections(controller);

        if (intersections.length > 0) {
            this.isGrabbing = true;
            this.grabController = controller;
            this.initialControllerPosition.copy(controller.position);
            this.initialAtomPosition.copy(this.atom.getGroup().position);
            
            controller.userData.isSelecting = true;
        }
    }

    onControllerSelectEnd(event) {
        const controller = event.target;
        controller.userData.isSelecting = false;
        
        if (this.grabController === controller) {
            this.isGrabbing = false;
            this.grabController = null;
        }
    }

    onControllerSqueezeStart(event) {
        if (!this.atom) return;
        
        const controller = event.target;
        this.scalingControllers.push(controller);
        controller.userData.isSqueezing = true;

        if (this.scalingControllers.length === 2) {
            this.isScaling = true;
            this.initialDistance = this.scalingControllers[0].position.distanceTo(
                this.scalingControllers[1].position
            );
            this.initialScale = this.atom.getScale();
        }
    }

    onControllerSqueezeEnd(event) {
        const controller = event.target;
        controller.userData.isSqueezing = false;
        
        const index = this.scalingControllers.indexOf(controller);
        if (index > -1) {
            this.scalingControllers.splice(index, 1);
        }

        if (this.scalingControllers.length < 2) {
            this.isScaling = false;
        }
    }

    // Touch Events (Fallback)
    onTouchStart(event) {
        if (!this.atom) return;
        
        event.preventDefault();
        this.touchState.touches = Array.from(event.touches);

        if (event.touches.length === 2) {
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            
            this.touchState.initialDistance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            this.touchState.initialScale = this.atom.getScale();
            this.touchState.isScaling = true;
        }
    }

    onTouchMove(event) {
        if (!this.atom) return;
        
        event.preventDefault();

        if (this.touchState.isScaling && event.touches.length === 2) {
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            
            const currentDistance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            
            const scaleRatio = currentDistance / this.touchState.initialDistance;
            const newScale = Math.max(0.1, Math.min(5, this.touchState.initialScale * scaleRatio));
            this.atom.setScale(newScale);
        } else if (event.touches.length === 1) {
            // Single touch - move atom (simplified for AR)
            const touch = event.touches[0];
            const previousTouch = this.touchState.touches[0];
            
            if (previousTouch) {
                const deltaX = (touch.clientX - previousTouch.clientX) * 0.001;
                const deltaY = (touch.clientY - previousTouch.clientY) * 0.001;
                
                const currentPos = this.atom.getGroup().position;
                this.atom.setPosition(
                    currentPos.x + deltaX,
                    currentPos.y - deltaY,
                    currentPos.z
                );
            }
        }
        
        this.touchState.touches = Array.from(event.touches);
    }

    onTouchEnd(event) {
        event.preventDefault();
        this.touchState.isScaling = false;
        this.touchState.touches = Array.from(event.touches);
    }

    // Mouse Events (Desktop Testing)
    onMouseDown(event) {
        // Similar to touch start but for mouse
    }

    onMouseMove(event) {
        // Mouse move handling
    }

    onMouseUp(event) {
        // Mouse up handling
    }

    onWheel(event) {
        if (!this.atom) return;
        
        event.preventDefault();
        const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1;
        this.scaleAtom(scaleFactor);
    }

    // Update method called in animation loop
    update() {
        if (!this.atom) return;

        // Handle controller-based movement
        if (this.isGrabbing && this.grabController) {
            const deltaPosition = new THREE.Vector3()
                .copy(this.grabController.position)
                .sub(this.initialControllerPosition);
            
            const newPosition = new THREE.Vector3()
                .copy(this.initialAtomPosition)
                .add(deltaPosition);
            
            this.atom.setPosition(newPosition.x, newPosition.y, newPosition.z);
        }

        // Handle controller-based scaling
        if (this.isScaling && this.scalingControllers.length === 2) {
            const currentDistance = this.scalingControllers[0].position.distanceTo(
                this.scalingControllers[1].position
            );
            
            const scaleRatio = currentDistance / this.initialDistance;
            const newScale = Math.max(0.1, Math.min(5, this.initialScale * scaleRatio));
            this.atom.setScale(newScale);
        }
    }

    // Utility methods
    getIntersections(controller) {
        if (!this.atom) return [];

        const raycaster = new THREE.Raycaster();
        const tempMatrix = new THREE.Matrix4();
        
        tempMatrix.identity().extractRotation(controller.matrixWorld);
        raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

        return raycaster.intersectObject(this.atom.getGroup(), true);
    }

    scaleAtom(factor) {
        if (!this.atom) return;
        
        const currentScale = this.atom.getScale();
        const newScale = Math.max(0.1, Math.min(5, currentScale * factor));
        this.atom.setScale(newScale);
    }

    resetAtom() {
        if (!this.atom) return;
        
        this.atom.setScale(1);
        this.atom.setPosition(0, 0, -1);
    }

    dispose() {
        // Clean up event listeners and resources
        const canvas = this.renderer.domElement;
        
        // Remove all touch event listeners
        canvas.removeEventListener('touchstart', this.onTouchStart);
        canvas.removeEventListener('touchmove', this.onTouchMove);
        canvas.removeEventListener('touchend', this.onTouchEnd);
        canvas.removeEventListener('touchcancel', this.onTouchEnd);
        canvas.removeEventListener('contextmenu', this.onContextMenu);
        
        // Remove mouse event listeners
        canvas.removeEventListener('mousedown', this.onMouseDown);
        canvas.removeEventListener('mousemove', this.onMouseMove);
        canvas.removeEventListener('mouseup', this.onMouseUp);
        canvas.removeEventListener('wheel', this.onWheel);
    }
}