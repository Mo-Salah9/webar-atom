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
        this.initialTouchAngle = 0;
        this.initialRotationY = 0;

        // Smooth dragging
        this.touchTargetPosition = new THREE.Vector3();
        this.hasTouchTarget = false;
        this.dragLerpFactor = 0.2; // 0..1 per frame

        // One-finger swipe rotation
        this.isTouchRotating = false;
        this.initialTouchX = 0;
        this.rotationSensitivity = 0.01; // radians per pixel

        // Particle highlighting
        this.lastClickTime = 0;
        this.clickDelay = 300; // ms
        this.currentHighlight = null;

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
        
        console.log('WebXR controllers setup - handles touch automatically');
    }

    setupTouchEvents() {
        // Prefer binding to DOM Overlay on mobile (Android Chrome routes input to overlay during AR)
        const overlay = document.querySelector('.ui-overlay');
        const canvas = this.renderer.domElement;
        this._touchTarget = overlay || canvas;
        if (this._touchTarget && this._touchTarget.style) {
            this._touchTarget.style.touchAction = 'none';
            this._touchTarget.style.webkitUserSelect = 'none';
            this._touchTarget.style.userSelect = 'none';
            // Ensure overlay receives events on Android DOM Overlay
            this._touchTarget.style.pointerEvents = 'all';
        }

        // Pointer events work for both mouse and touch. We only act during AR sessions effectively on mobile.
        this._onPointerDown = (event) => this.onPointerDown(event);
        this._onPointerMove = (event) => this.onPointerMove(event);
        this._onPointerUp = (event) => this.onPointerUp(event);
        this._onPointerCancel = (event) => this.onPointerUp(event);

        this._touchTarget.addEventListener('pointerdown', this._onPointerDown, { passive: false });
        this._touchTarget.addEventListener('pointermove', this._onPointerMove, { passive: false });
        this._touchTarget.addEventListener('pointerup', this._onPointerUp, { passive: false });
        this._touchTarget.addEventListener('pointercancel', this._onPointerCancel, { passive: false });
        this._touchTarget.addEventListener('pointerout', this._onPointerUp, { passive: false });
        this._touchTarget.addEventListener('pointerleave', this._onPointerUp, { passive: false });
    }

    onPointerDown(event) {
        if (!this.atom) return;
        // Record pointer
        event.preventDefault();
        this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (this.activePointers.size === 1) {
            // Check if clicking on a specific particle
            const { x, y } = this.activePointers.get(event.pointerId);
            const intersection = this.raycastFromScreen(x, y);
            
            if (intersection.length > 0) {
                const clickedObject = intersection[0].object;
                const particleType = this.atom.getParticleTypeFromObject(clickedObject);
                
                if (particleType) {
                    // Handle particle highlighting
                    const currentTime = Date.now();
                    if (currentTime - this.lastClickTime < this.clickDelay && this.currentHighlight === particleType) {
                        // Double click - reset highlighting
                        this.atom.resetOpacities();
                        this.currentHighlight = null;
                        console.log('Reset particle highlighting');
                    } else {
                        // Single click - highlight particle type
                        this.atom.highlightParticleType(particleType);
                        this.currentHighlight = particleType;
                        console.log(`Highlighted: ${particleType}`);
                    }
                    this.lastClickTime = currentTime;
                    return; // Don't start rotation if we clicked a particle
                }
            }
            
            // Begin rotation if touching the atom but not a specific particle
            if (this.isTouchOnAtom(x, y)) {
                this.isTouchRotating = true;
                this.initialTouchX = x;
                this.initialRotationY = this.atom.getRotationY ? this.atom.getRotationY() : this.atom.getGroup().rotation.y;
                this.isTouchGrabbing = false; // disable move
            }
        } else if (this.activePointers.size === 2) {
            // Start pinch scaling
            const points = Array.from(this.activePointers.values());
            this.initialTouchDistance = this.distance2(points[0], points[1]);
            this.initialTouchAngle = this.angle2(points[0], points[1]);
            this.initialScale = this.atom.getScale();
            this.initialRotationY = this.atom.getRotationY ? this.atom.getRotationY() : this.atom.getGroup().rotation.y;
            this.isTouchGrabbing = false; // disable drag while pinching
            this.isTouchRotating = false; // rotation handled by twist while pinching
        }
    }

    onPointerMove(event) {
        if (!this.atom) return;
        if (!this.activePointers.has(event.pointerId)) return;

        // Update pointer position
        this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (this.activePointers.size === 1 && this.isTouchRotating) {
            event.preventDefault();
            const { x } = this.activePointers.values().next().value;
            const deltaX = x - this.initialTouchX;
            const newY = this.initialRotationY + deltaX * this.rotationSensitivity;
            if (this.atom.setRotationY) {
                this.atom.setRotationY(newY);
            } else {
                this.atom.getGroup().rotation.y = newY;
            }
        } else if (this.activePointers.size === 2) {
            event.preventDefault();
            // Pinch to scale
            const points = Array.from(this.activePointers.values());
            const currentDistance = this.distance2(points[0], points[1]);
            const currentAngle = this.angle2(points[0], points[1]);
            if (this.initialTouchDistance > 0) {
                const ratio = currentDistance / this.initialTouchDistance;
                const newScale = Math.max(0.1, Math.min(5, this.initialScale * ratio));
                this.atom.setScale(newScale);
            }
            // Two-finger twist to rotate around Y
            const deltaAngle = currentAngle - this.initialTouchAngle;
            const newY = this.initialRotationY + deltaAngle;
            if (this.atom.setRotationY) {
                this.atom.setRotationY(newY);
            } else {
                this.atom.getGroup().rotation.y = newY;
            }
        }
    }

    onPointerUp(event) {
        if (this.activePointers.has(event.pointerId)) {
            event.preventDefault();
            this.activePointers.delete(event.pointerId);
        }

        if (this.activePointers.size < 2) {
            this.initialTouchDistance = 0;
        }
        if (this.activePointers.size === 0) {
            this.isTouchGrabbing = false;
            this.hasTouchTarget = false;
            this.isTouchRotating = false;
        }
    }

    // Enhanced raycasting for particle detection
    raycastFromScreen(x, y) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.ndc.x = ((x - rect.left) / rect.width) * 2 - 1;
        this.ndc.y = -((y - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.ndc, this.camera);
        
        // Raycast against all atom components
        const intersections = this.raycaster.intersectObject(this.atom.getGroup(), true);
        return intersections;
    }

    // Helpers for touch interactions
    isTouchOnAtom(x, y) {
        const intersect = this.raycastFromScreen(x, y);
        return intersect.length > 0;
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

    angle2(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.atan2(dy, dx);
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
            const clickedObject = intersections[0].object;
            const particleType = this.atom.getParticleTypeFromObject(clickedObject);
            
            if (particleType) {
                // Handle particle highlighting with controller
                if (this.currentHighlight === particleType) {
                    this.atom.resetOpacities();
                    this.currentHighlight = null;
                    console.log('Controller: Reset particle highlighting');
                } else {
                    this.atom.highlightParticleType(particleType);
                    this.currentHighlight = particleType;
                    console.log(`Controller: Highlighted ${particleType}`);
                }
                return;
            }
            
            // Start grabbing if not clicking on a specific particle
            this.isGrabbing = true;
            this.grabController = controller;
            this.initialControllerPosition.copy(controller.position);
            this.initialAtomPosition.copy(this.atom.getGroup().position);
            
            controller.userData.isSelecting = true;
            console.log('Atom grabbed via WebXR');
        }
    }

    onControllerSelectEnd(event) {
        const controller = event.target;
        controller.userData.isSelecting = false;
        
        if (this.grabController === controller) {
            this.isGrabbing = false;
            this.grabController = null;
            console.log('Atom released');
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
            console.log('Two-handed scaling started');
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
            console.log('Scaling ended');
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

        // Smoothly move towards touch target while dragging (disabled when rotating)
        if (this.isTouchGrabbing && !this.isTouchRotating && this.hasTouchTarget) {
            const current = this.atom.getGroup().position.clone();
            current.lerp(this.touchTargetPosition, this.dragLerpFactor);
            this.atom.setPosition(current.x, current.y, current.z);
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
        this.atom.resetOpacities();
        this.currentHighlight = null;
    }

    dispose() {
        // Remove touch listeners
        const target = this._touchTarget || this.renderer.domElement;
        if (target) {
            target.removeEventListener('pointerdown', this._onPointerDown);
            target.removeEventListener('pointermove', this._onPointerMove);
            target.removeEventListener('pointerup', this._onPointerUp);
            target.removeEventListener('pointercancel', this._onPointerCancel);
            target.removeEventListener('pointerout', this._onPointerUp);
            target.removeEventListener('pointerleave', this._onPointerUp);
        }
        console.log('InteractionManager disposed');
    }
}