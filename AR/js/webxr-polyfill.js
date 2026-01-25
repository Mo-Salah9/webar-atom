// WebXR Polyfill for better cross-platform support
(function() {
    'use strict';

    // Check if WebXR is supported
    if (!navigator.xr) {
        console.warn('WebXR not supported, adding polyfill support');
        
        // Add basic polyfill structure
        navigator.xr = {
            isSessionSupported: function(mode) {
                return new Promise((resolve) => {
                    // Check for ARCore/ARKit support indicators
                    const hasAR = (
                        /Android/i.test(navigator.userAgent) ||
                        /iPhone|iPad|iPod/i.test(navigator.userAgent)
                    ) && (
                        'DeviceOrientationEvent' in window ||
                        'DeviceMotionEvent' in window
                    );
                    resolve(hasAR && mode === 'immersive-ar');
                });
            },
            
            requestSession: function(mode, options) {
                return new Promise((resolve, reject) => {
                    if (mode !== 'immersive-ar') {
                        reject(new Error('Only immersive-ar mode supported'));
                        return;
                    }
                    
                    // Create mock session
                    const session = new MockXRSession();
                    resolve(session);
                });
            }
        };
    }

    // Mock XR Session for fallback
    class MockXRSession extends EventTarget {
        constructor() {
            super();
            this.mode = 'immersive-ar';
            this.ended = false;
        }

        requestReferenceSpace(type) {
            return Promise.resolve(new MockXRReferenceSpace());
        }

        requestHitTestSource(options) {
            return Promise.resolve(new MockXRHitTestSource());
        }

        end() {
            if (!this.ended) {
                this.ended = true;
                this.dispatchEvent(new Event('end'));
            }
            return Promise.resolve();
        }
    }

    class MockXRReferenceSpace {
        constructor() {
            // Mock reference space
        }
    }

    class MockXRHitTestSource {
        constructor() {
            // Mock hit test source
        }
    }

    // Add global polyfills
    window.XRSession = window.XRSession || MockXRSession;
    window.XRReferenceSpace = window.XRReferenceSpace || MockXRReferenceSpace;

    console.log('WebXR polyfill loaded');
})();