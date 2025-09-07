import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.module.js';

export class AtomModel {
    constructor() {
        this.group = new THREE.Group();
        this.electrons = [];
        this.nucleus = [];
        this.orbits = [];
        this.protons = [];
        this.neutrons = [];
        
        this.animationSpeed = 0.02;
        this.baseScale = 1;
        
        this.createAtom();
    }

    createAtom() {
        this.createNucleus();
        this.createElectrons();
        this.createOrbits();
    }

    createNucleus() {
        const nucleusGroup = new THREE.Group();
        
        // Create protons (red)
        const protonGeometry = new THREE.SphereGeometry(0.03, 12, 12);
        const protonMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xff4444,
            metalness: 0.3,
            roughness: 0.4
        });

        // Create neutrons (blue)
        const neutronGeometry = new THREE.SphereGeometry(0.03, 12, 12);
        const neutronMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x4444ff,
            metalness: 0.3,
            roughness: 0.4
        });

        // Add 8 protons and 8 neutrons (oxygen-like per requirements)
        for (let i = 0; i < 16; i++) {
            const isProton = i < 8;
            const particle = new THREE.Mesh(
                isProton ? protonGeometry : neutronGeometry,
                isProton ? protonMaterial : neutronMaterial
            );
            
            // Arrange in a rough sphere
            const phi = Math.acos(-1 + (2 * i) / 16);
            const theta = Math.sqrt(16 * Math.PI) * phi;
            
            particle.position.set(
                0.04 * Math.cos(theta) * Math.sin(phi),
                0.04 * Math.sin(theta) * Math.sin(phi),
                0.04 * Math.cos(phi)
            );
            particle.userData.partType = isProton ? 'proton' : 'neutron';
            
            nucleusGroup.add(particle);
            this.nucleus.push(particle);
            if (isProton) this.protons.push(particle); else this.neutrons.push(particle);
        }

        // Add nucleus glow effect
        const glowGeometry = new THREE.SphereGeometry(0.08, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff44,
            transparent: true,
            opacity: 0.2
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        nucleusGroup.add(glow);

        this.group.add(nucleusGroup);
    }

    createElectrons() {
        const electronGeometry = new THREE.SphereGeometry(0.02, 12, 12);
        const electronMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x44ff44,
            metalness: 0.5,
            roughness: 0.3,
            emissive: 0x002200
        });

        // Create electron shells (2 in first, 6 in second)
        const shells = [
            { radius: 0.2, electrons: 2 },
            { radius: 0.35, electrons: 6 }
        ];

        shells.forEach((shell, shellIndex) => {
            for (let i = 0; i < shell.electrons; i++) {
                const electron = new THREE.Mesh(electronGeometry, electronMaterial);
                
                electron.userData = {
                    shell: shellIndex,
                    angle: (i / shell.electrons) * Math.PI * 2,
                    radius: shell.radius,
                    speed: 0.02 / (shellIndex + 1), // Inner shells move faster
                    inclination: shellIndex * Math.PI / 4, // Different orbital planes
                    partType: 'electron'
                };
                
                this.group.add(electron);
                this.electrons.push(electron);
            }
        });
    }

    createOrbits() {
        const orbitalRadii = [0.2, 0.35];
        
        orbitalRadii.forEach((radius, index) => {
            const orbitGeometry = new THREE.RingGeometry(radius - 0.005, radius + 0.005, 64);
            const orbitMaterial = new THREE.MeshBasicMaterial({
                color: 0x888888,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide
            });
            
            const orbit = new THREE.Mesh(orbitGeometry, orbitMaterial);
            orbit.rotation.x = index * Math.PI / 4; // Different orbital planes
            this.group.add(orbit);
            this.orbits.push(orbit);
        });
    }

    animate(deltaTime) {
        // Animate electrons
        this.electrons.forEach((electron) => {
            const userData = electron.userData;
            userData.angle += userData.speed;
            
            // Calculate position with inclination
            const x = Math.cos(userData.angle) * userData.radius;
            const y = Math.sin(userData.angle) * userData.radius * Math.sin(userData.inclination);
            const z = Math.sin(userData.angle) * userData.radius * Math.cos(userData.inclination);
            
            electron.position.set(x, y, z);
        });

        // Gentle nucleus rotation
        this.nucleus.forEach((particle, index) => {
            particle.rotation.y += 0.005;
            particle.rotation.x += 0.003;
        });

        // Rotate orbits slightly
        this.orbits.forEach((orbit, index) => {
            orbit.rotation.z += 0.001 * (index + 1);
        });
    }

    // Highlighting helpers
    highlightObject(object3D) {
        if (!object3D || !object3D.material) return;
        const mat = object3D.material;
        if (!object3D.userData._orig) {
            object3D.userData._orig = {
                emissive: mat.emissive ? mat.emissive.clone() : null,
                scale: object3D.scale.clone()
            };
        }
        if (mat.emissive) {
            mat.emissive.setHex(0xffff44);
        }
        object3D.scale.multiplyScalar(1.25);
        clearTimeout(object3D.userData._hlTimeout);
        object3D.userData._hlTimeout = setTimeout(() => this.clearHighlight(object3D), 800);
    }

    clearHighlight(object3D) {
        if (!object3D || !object3D.userData || !object3D.userData._orig) return;
        const mat = object3D.material;
        const orig = object3D.userData._orig;
        if (mat && mat.emissive && orig.emissive) {
            mat.emissive.copy(orig.emissive);
        }
        if (orig.scale) {
            object3D.scale.copy(orig.scale);
        }
    }

    // Fade helpers
    getAllParts() {
        const parts = [];
        this.group.traverse((child) => {
            if (child.isMesh) parts.push(child);
        });
        return parts;
    }

    fadeOthersExcept(target) {
        const parts = this.getAllParts();
        parts.forEach((mesh) => {
            const material = mesh.material;
            if (!material) return;
            if (!mesh.userData._origFade) {
                mesh.userData._origFade = {
                    transparent: material.transparent,
                    opacity: material.opacity
                };
            }
            if (mesh === target) {
                material.transparent = mesh.userData._origFade.transparent;
                material.opacity = 1.0;
            } else {
                material.transparent = true;
                material.opacity = 0.3;
            }
        });
    }

    clearFades() {
        const parts = this.getAllParts();
        parts.forEach((mesh) => {
            const material = mesh.material;
            const orig = mesh.userData._origFade;
            if (material && orig) {
                material.transparent = orig.transparent;
                material.opacity = orig.opacity;
            }
        });
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
}