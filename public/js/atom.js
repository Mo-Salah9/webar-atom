import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';

export class AtomModel {
    constructor() {
        this.group = new THREE.Group();
        this.electrons = [];
        this.nucleus = [];
        this.orbits = [];
        this.electronTrails = [];
        
        this.animationSpeed = 0.02;
        this.baseScale = 1;
        this.time = 0;
        this._isFaded = false;
        this._selectionKeepSet = null;
        
        this.createAtom();
    }

    createAtom() {
        this.createNucleus();
        this.createElectronOrbits();
        this.createElectrons();
        this.addNucleusGlow();
    }

    createNucleus() {
        const nucleusGroup = new THREE.Group();
        
        // Create protons (bright red)
        const protonGeometry = new THREE.SphereGeometry(0.04, 16, 16);
        const protonMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff3333,
            transparent: true,
            opacity: 1.0
        });

        // Create neutrons (blue-white)
        const neutronGeometry = new THREE.SphereGeometry(0.04, 16, 16);
        const neutronMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x6699ff,
            transparent: true,
            opacity: 1.0
        });

        // Arrange nucleus particles in a more realistic cluster
        const positions = [
            // Inner core
            [0, 0, 0],
            [0.06, 0, 0],
            [0, 0.06, 0],
            [0, 0, 0.06],
            [-0.06, 0, 0],
            [0, -0.06, 0],
            [0, 0, -0.06],
            // Outer ring
            [0.08, 0.08, 0],
            [-0.08, 0.08, 0],
            [0.08, -0.08, 0],
            [-0.08, -0.08, 0],
            [0, 0.08, 0.08],
            [0, -0.08, -0.08]
        ];

        for (let i = 0; i < 13; i++) {
            const isProton = i < 6;
            const particle = new THREE.Mesh(
                isProton ? protonGeometry : neutronGeometry,
                isProton ? protonMaterial : neutronMaterial
            );
            
            if (positions[i]) {
                particle.position.set(...positions[i]);
            } else {
                // Random positioning for any extra particles
                const phi = Math.acos(-1 + (2 * i) / 13);
                const theta = Math.sqrt(13 * Math.PI) * phi;
                particle.position.set(
                    0.05 * Math.cos(theta) * Math.sin(phi),
                    0.05 * Math.sin(theta) * Math.sin(phi),
                    0.05 * Math.cos(phi)
                );
            }
            
            particle.userData.originalPosition = particle.position.clone();
            particle.userData.vibrationPhase = Math.random() * Math.PI * 2;
            particle.userData.kind = isProton ? 'proton' : 'neutron';
            
            // Tag as nucleus part
            particle.userData.part = 'nucleus';
            nucleusGroup.add(particle);
            this.nucleus.push(particle);
        }

        // Tag the whole nucleus group
        nucleusGroup.userData.part = 'nucleus';
        this.group.add(nucleusGroup);
        this.nucleusGroup = nucleusGroup;
    }

    addNucleusGlow() {
        // Inner glow
        const innerGlowGeometry = new THREE.SphereGeometry(0.12, 32, 32);
        const innerGlowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0.3,
            side: THREE.BackSide
        });
        const innerGlow = new THREE.Mesh(innerGlowGeometry, innerGlowMaterial);
        this.nucleusGroup.add(innerGlow);

        // Outer glow
        const outerGlowGeometry = new THREE.SphereGeometry(0.18, 32, 32);
        const outerGlowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffdd44,
            transparent: true,
            opacity: 0.15,
            side: THREE.BackSide
        });
        const outerGlow = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial);
        this.nucleusGroup.add(outerGlow);
    }

    createElectronOrbits() {
        const orbitalConfigs = [
            { 
                radius: 0.25, 
                inclination: 0, 
                color: 0x44ff88,
                opacity: 0.4,
                width: 0.008
            },
            { 
                radius: 0.45, 
                inclination: Math.PI / 3, 
                color: 0x4488ff,
                opacity: 0.35,
                width: 0.008
            },
            { 
                radius: 0.45, 
                inclination: -Math.PI / 3, 
                color: 0xff4488,
                opacity: 0.35,
                width: 0.008
            },
            { 
                radius: 0.45, 
                inclination: Math.PI / 2, 
                color: 0xffaa44,
                opacity: 0.35,
                width: 0.008
            }
        ];
        
        orbitalConfigs.forEach((config, index) => {
            // Create orbital ring
            const orbitGeometry = new THREE.RingGeometry(
                config.radius - config.width/2, 
                config.radius + config.width/2, 
                64
            );
            const orbitMaterial = new THREE.MeshBasicMaterial({
                color: config.color,
                transparent: true,
                opacity: config.opacity,
                side: THREE.DoubleSide
            });
            
            const orbit = new THREE.Mesh(orbitGeometry, orbitMaterial);
            orbit.userData.part = 'orbit';
            
            // Apply orbital inclination
            orbit.rotation.x = config.inclination;
            orbit.rotation.z = index * Math.PI / 6; // Vary the orbital orientations
            
            this.group.add(orbit);
            this.orbits.push({
                mesh: orbit,
                config: config,
                rotationSpeed: 0.001 * (index + 1)
            });
        });
    }

    createElectrons() {
        const electronGeometry = new THREE.SphereGeometry(0.025, 12, 12);
        const electronMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ff66,
            transparent: true,
            opacity: 1.0
        });

        // Electron configurations matching orbitals
        const electronConfigs = [
            // First shell (2 electrons)
            { 
                orbital: 0, 
                angle: 0, 
                speed: 0.03,
                phaseOffset: 0 
            },
            { 
                orbital: 0, 
                angle: Math.PI, 
                speed: 0.03,
                phaseOffset: Math.PI 
            },
            
            // Second shell (4 electrons across 3 orbitals)
            { 
                orbital: 1, 
                angle: 0, 
                speed: 0.02,
                phaseOffset: 0 
            },
            { 
                orbital: 1, 
                angle: Math.PI, 
                speed: 0.02,
                phaseOffset: Math.PI 
            },
            { 
                orbital: 2, 
                angle: Math.PI/2, 
                speed: 0.02,
                phaseOffset: Math.PI/2 
            },
            { 
                orbital: 3, 
                angle: 3*Math.PI/2, 
                speed: 0.02,
                phaseOffset: 3*Math.PI/2 
            }
        ];

        electronConfigs.forEach((config, index) => {
            const electron = new THREE.Mesh(electronGeometry, electronMaterial);
            
            electron.userData = {
                orbitalIndex: config.orbital,
                angle: config.angle,
                speed: config.speed,
                phaseOffset: config.phaseOffset,
                trailPoints: []
            };
            
            // Tag as electron part
            electron.userData.part = 'electron';
            this.group.add(electron);
            this.electrons.push(electron);

            // Create electron trail
            this.createElectronTrail(electron, index);
        });
    }

    createElectronTrail(electron, index) {
        const trailGeometry = new THREE.BufferGeometry();
        const trailMaterial = new THREE.LineBasicMaterial({
            color: 0x00ff66,
            transparent: true,
            opacity: 0.3,
            linewidth: 2
        });

        const trailPositions = new Float32Array(60 * 3); // 20 trail points
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));

        const trail = new THREE.Line(trailGeometry, trailMaterial);
        this.group.add(trail);
        
        electron.userData.trail = trail;
        electron.userData.trailPositions = trailPositions;
        electron.userData.trailIndex = 0;
    }

    // Glow target, dim everything else
    highlightKind(kind, intensity = 1.0) {
        // Build keep set for the target kind
        const keepSet = new Set();
        
        if (kind === 'proton' || kind === 'neutron') {
            // Keep only matching particles
            this.nucleus.forEach(p => { 
                if (p.userData.kind === kind) {
                    keepSet.add(p);
                }
            });
        } else if (kind === 'electron') {
            // Keep electrons and their trails
            this.electrons.forEach(e => {
                keepSet.add(e);
                if (e.userData && e.userData.trail) {
                    keepSet.add(e.userData.trail);
                }
            });
        }
        
        // Apply glow to target, dim everything else
        this._selectionKeepSet = keepSet;
        this.group.traverse((obj) => {
            const material = obj.material;
            if (!material) return;
            const materials = Array.isArray(material) ? material : [material];
            const shouldKeep = keepSet.has(obj);
            
            materials.forEach((mat) => {
                // Store originals once
                if (mat.userData._origTransparent === undefined) {
                    mat.userData._origTransparent = mat.transparent === true;
                }
                if (mat.userData._origOpacity === undefined) {
                    mat.userData._origOpacity = mat.opacity !== undefined ? mat.opacity : 1.0;
                }
                if (mat.userData._origColor === undefined) {
                    mat.userData._origColor = mat.color ? mat.color.clone() : new THREE.Color(0xffffff);
                }
                
                mat.transparent = true;
                
                if (shouldKeep) {
                    // GLOW: Keep original color, full opacity
                    mat.opacity = 1.0;
                    // Keep original color unchanged
                } else {
                    // TRANSPARENT: Make others transparent but visible
                    mat.opacity = 0.4;
                    // Keep original color unchanged
                }
            });
        });
        
        this._isFaded = true;
    }

    clearHighlights() {
        this.restoreOpacity();
    }

    animate(deltaTime) {
        this.time += deltaTime;
        
        // Animate nucleus particles with subtle vibration
        this.nucleus.forEach((particle, index) => {
            const userData = particle.userData;
            userData.vibrationPhase += deltaTime * 2;
            
            const vibrationScale = 0.003;
            const vibration = new THREE.Vector3(
                Math.sin(userData.vibrationPhase) * vibrationScale,
                Math.cos(userData.vibrationPhase * 1.3) * vibrationScale,
                Math.sin(userData.vibrationPhase * 0.8) * vibrationScale
            );
            
            particle.position.copy(userData.originalPosition).add(vibration);
            particle.rotation.x += 0.01;
            particle.rotation.y += 0.008;
        });

        // Animate electrons along orbitals
        this.electrons.forEach((electron, index) => {
            const userData = electron.userData;
            const orbital = this.orbits[userData.orbitalIndex];
            
            if (orbital) {
                userData.angle += userData.speed;
                
                const config = orbital.config;
                const radius = config.radius;
                
                // Calculate electron position with orbital inclination
                const x = Math.cos(userData.angle) * radius;
                const y = Math.sin(userData.angle) * radius * Math.sin(config.inclination);
                const z = Math.sin(userData.angle) * radius * Math.cos(config.inclination);
                
                electron.position.set(x, y, z);
                
                // Add slight wobble
                const wobble = 0.01;
                electron.position.x += Math.sin(this.time * 5 + index) * wobble;
                electron.position.y += Math.cos(this.time * 3 + index) * wobble;
                
                // Update electron trail
                this.updateElectronTrail(electron);
            }
        });

        // Rotate orbitals slowly
        this.orbits.forEach((orbital, index) => {
            orbital.mesh.rotation.y += orbital.rotationSpeed;
            orbital.mesh.rotation.z += orbital.rotationSpeed * 0.5;
        });

        // Rotate entire nucleus group slowly
        this.nucleusGroup.rotation.y += 0.005;
        this.nucleusGroup.rotation.x += 0.003;
    }

    updateElectronTrail(electron) {
        const userData = electron.userData;
        const trail = userData.trail;
        const positions = userData.trailPositions;
        
        // Add current position to trail
        const currentPos = electron.position;
        const index = userData.trailIndex * 3;
        
        positions[index] = currentPos.x;
        positions[index + 1] = currentPos.y;
        positions[index + 2] = currentPos.z;
        
        userData.trailIndex = (userData.trailIndex + 1) % 20;
        
        // Update trail geometry
        trail.geometry.attributes.position.needsUpdate = true;
    }

    setScale(scale) {
        this.group.scale.setScalar(scale);
        this.baseScale = scale;
    }

    getScale() {
        return this.baseScale;
    }

    setPosition(x, y, z) {
        this.group.position.set(x, y, z);
    }

    getGroup() {
        return this.group;
    }

    setRotationY(angleRadians) {
        this.group.rotation.y = angleRadians;
    }

    getRotationY() {
        return this.group.rotation.y;
    }

    dispose() {
        // Clean up geometries and materials
        this.group.traverse((child) => {
            if (child.geometry) {
                child.geometry.dispose();
            }
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => material.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }

    // Selection / fading helpers
    fadeExcept(targetObject, fadeOpacity = 0.1) {
        if (!targetObject) return;

        // Build a set containing target and all of its descendants to keep at full opacity
        const keepSet = new Set();
        targetObject.traverse((obj) => keepSet.add(obj));
        this._selectionKeepSet = keepSet;

        // Traverse all renderable objects in the atom and adjust opacity
        this.group.traverse((obj) => {
            const material = obj.material;
            if (!material) return;

            const materials = Array.isArray(material) ? material : [material];
            const shouldKeep = keepSet.has(obj);

            materials.forEach((mat) => {
                // Store originals once
                if (mat.userData._origTransparent === undefined) {
                    mat.userData._origTransparent = mat.transparent === true;
                }
                if (mat.userData._origOpacity === undefined) {
                    mat.userData._origOpacity = mat.opacity !== undefined ? mat.opacity : 1.0;
                }

                // Ensure transparency enabled to allow fading
                mat.transparent = true;
                // Keep selected subtree fully visible; fade everything else
                mat.opacity = shouldKeep ? 1.0 : fadeOpacity;
                // For line materials that ignore depth, leave as-is; opacity still applies
            });
        });

        this._isFaded = true;
    }

    restoreOpacity() {
        if (!this._isFaded) return;
        this.group.traverse((obj) => {
            const material = obj.material;
            if (!material) return;
            const materials = Array.isArray(material) ? material : [material];
            materials.forEach((mat) => {
                if (mat.userData && mat.userData._origOpacity !== undefined) {
                    mat.opacity = mat.userData._origOpacity;
                } else {
                    mat.opacity = 1.0;
                }
                if (mat.userData && mat.userData._origTransparent !== undefined) {
                    mat.transparent = mat.userData._origTransparent;
                }
                if (mat.userData && mat.userData._origColor) {
                    if (mat.color) {
                        mat.color.copy(mat.userData._origColor);
                    }
                }
            });
        });
        this._selectionKeepSet = null;
        this._isFaded = false;
    }
}