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

        // Touch/Pointer interaction state (for Android/iOS screens)
        this.activePointers = new Map(); // pointerId -> { x, y }
        this.isTouchGrabbing = false;
        this.dragPlane = new THREE.Plane();
        this.raycaster = new THREE.Raycaster();
        this.ndc = new THREE.Vector2();
        this.initialTouchDistance = 0;

        this.setupControllers();
        this.setupTouchEvents();
    }

    setupControllers() {
        // Setup XR controllers - this handles ALL input automatically
        for (let i = 0; i < 2; i++) {
            const controller = this.renderer.xr.getController(i);
            const controllerGrip = this.renderer.xr.getControllerGrip(i);

            // Controller events - WebXR handles touch/tap automatically
            controller.addEventListener('selectstart', (event) => this.onControllerSelectStart(event));
            controller.addEventListener('selectend', (event) => this.onControllerSelectEnd(event));
            controller.addEventListener('squeezestart', (event) => this.onControllerSqueezeStart(event));
            controller.addEventListener('squeezeend', (event) => this.onControllerSqueezeEnd(event));

            // Add visual ray for debugging
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
        
        console.log('✅ WebXR controllers setup - handles touch automatically');
    }

    setupTouchEvents() {
        // Ensure the canvas allows touch gestures
        const canvas = this.renderer.domElement;
        if (canvas && canvas.style) {
            canvas.style.touchAction = 'none';
            canvas.style.webkitUserSelect = 'none';
            canvas.style.userSelect = 'none';
        }

        // Pointer events work for both mouse and touch. We only act during AR sessions effectively on mobile.
        this._onPointerDown = (event) => this.onPointerDown(event);
        this._onPointerMove = (event) => this.onPointerMove(event);
        this._onPointerUp = (event) => this.onPointerUp(event);
        this._onPointerCancel = (event) => this.onPointerUp(event);

        canvas.addEventListener('pointerdown', this._onPointerDown, { passive: false });
        canvas.addEventListener('pointermove', this._onPointerMove, { passive: false });
        canvas.addEventListener('pointerup', this._onPointerUp, { passive: false });
        canvas.addEventListener('pointercancel', this._onPointerCancel, { passive: false });
        canvas.addEventListener('pointerout', this._onPointerUp, { passive: false });
        canvas.addEventListener('pointerleave', this._onPointerUp, { passive: false });
    }

    onPointerDown(event) {
        if (!this.atom) return;
        // Record pointer
        this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (this.activePointers.size === 1) {
            // Begin drag if touching the atom
            const { x, y } = this.activePointers.get(event.pointerId);
            if (this.isTouchOnAtom(x, y)) {
                this.isTouchGrabbing = true;
                // Define a drag plane that passes through the atom and faces the camera
                const atomPos = this.atom.getGroup().position.clone();
                const cameraDir = new THREE.Vector3();
                this.camera.getWorldDirection(cameraDir);
                this.dragPlane.setFromNormalAndCoplanarPoint(cameraDir, atomPos);
                this.initialAtomPosition.copy(atomPos);
            }
        } else if (this.activePointers.size === 2) {
            // Start pinch scaling
            const points = Array.from(this.activePointers.values());
            this.initialTouchDistance = this.distance2(points[0], points[1]);
            this.initialScale = this.atom.getScale();
            this.isTouchGrabbing = false; // disable drag while pinching
        }
    }

    onPointerMove(event) {
        if (!this.atom) return;
        if (!this.activePointers.has(event.pointerId)) return;

        // Update pointer position
        this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (this.activePointers.size === 1 && this.isTouchGrabbing) {
            event.preventDefault();
            const { x, y } = this.activePointers.values().next().value;
            const worldPoint = this.screenPointToPlaneIntersection(x, y, this.dragPlane);
            if (worldPoint) {
                this.atom.setPosition(worldPoint.x, worldPoint.y, worldPoint.z);
            }
        } else if (this.activePointers.size === 2) {
            event.preventDefault();
            // Pinch to scale
            const points = Array.from(this.activePointers.values());
            const currentDistance = this.distance2(points[0], points[1]);
            if (this.initialTouchDistance > 0) {
                const ratio = currentDistance / this.initialTouchDistance;
                const newScale = Math.max(0.1, Math.min(5, this.initialScale * ratio));
                this.atom.setScale(newScale);
            }
        }
    }

    onPointerUp(event) {
        if (this.activePointers.has(event.pointerId)) {
            this.activePointers.delete(event.pointerId);
        }

        if (this.activePointers.size < 2) {
            this.initialTouchDistance = 0;
        }
        if (this.activePointers.size === 0) {
            this.isTouchGrabbing = false;
        }
    }

    // Helpers for touch interactions
    isTouchOnAtom(x, y) {
        const intersect = this.raycastFromScreen(x, y);
        return intersect.length > 0;
    }

    raycastFromScreen(x, y) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.ndc.x = ((x - rect.left) / rect.width) * 2 - 1;
        this.ndc.y = -((y - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.ndc, this.camera);
        return this.raycaster.intersectObject(this.atom.getGroup(), true);
    }

    screenPointToPlaneIntersection(x, y, plane) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.ndc.x = ((x - rect.left) / rect.width) * 2 - 1;
        this.ndc.y = -((y - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.ndc, this.camera);
        const point = new THREE.Vector3();
        const hit = this.raycaster.ray.intersectPlane(plane, point);
        return hit ? point : null;
    }

    distance2(p1, p2) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        return Math.hypot(dx, dy);
    }

    setAtom(atom) {
        this.atom = atom;
    }

    // WebXR Controller Events - handles ALL input (touch, controllers, etc.)
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
            console.log('🎯 Atom grabbed via WebXR');
        }
    }

    onControllerSelectEnd(event) {
        const controller = event.target;
        controller.userData.isSelecting = false;
        
        if (this.grabController === controller) {
            this.isGrabbing = false;
            this.grabController = null;
            console.log('✋ Atom released');
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
            console.log('📏 Two-handed scaling started');
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
            console.log('📏 Scaling ended');
        }
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
        // Remove touch listeners
        const canvas = this.renderer.domElement;
        if (canvas) {
            canvas.removeEventListener('pointerdown', this._onPointerDown);
            canvas.removeEventListener('pointermove', this._onPointerMove);
            canvas.removeEventListener('pointerup', this._onPointerUp);
            canvas.removeEventListener('pointercancel', this._onPointerCancel);
            canvas.removeEventListener('pointerout', this._onPointerUp);
            canvas.removeEventListener('pointerleave', this._onPointerUp);
        }
        console.log('🧹 InteractionManager disposed');
    }
}