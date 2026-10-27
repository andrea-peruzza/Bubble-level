/**
 * sensors.js
 * Hardware sensor management: DeviceOrientationEvent, iOS permissions, and desktop fallback simulation.
 */

export class SensorManager {
  constructor(onUpdateCallback) {
    this.onUpdate = onUpdateCallback;
    this.isActive = false;
    this.hasHardware = false;
    this.isSimulating = false;
    this.permissionGranted = false;

    // Simulated coordinates (for desktop testing)
    this.simulatedBeta = 0;
    this.simulatedGamma = 0;
    this.simulatedAlpha = 0;
    this.simulatedFaceDown = false;
    this.gravityZ = null;

    this._handleOrientation = this._handleOrientation.bind(this);
    this._handleMotion = this._handleMotion.bind(this);
    this._handleSimulatedPointer = this._handleSimulatedPointer.bind(this);
  }

  /**
   * Checks whether explicit permission request is required (iOS 13+ Safari/WebKit)
   */
  requiresExplicitPermission() {
    const isIOS =
      typeof navigator !== 'undefined' &&
      (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

    return (
      isIOS &&
      typeof window.DeviceOrientationEvent !== 'undefined' &&
      typeof window.DeviceOrientationEvent.requestPermission === 'function'
    );
  }

  /**
   * Requests user permission for motion sensors (required on iOS from a user gesture)
   */
  async requestPermission() {
    if (this.requiresExplicitPermission()) {
      try {
        const response = await window.DeviceOrientationEvent.requestPermission();
        if (response === 'granted') {
          this.permissionGranted = true;
          this.start();
          return { success: true };
        } else {
          return { success: false, error: 'Permission denied by user.' };
        }
      } catch (err) {
        return { success: false, error: err.message };
      }
    } else {
      this.permissionGranted = true;
      this.start();
      return { success: true };
    }
  }

  /**
   * Starts listening to sensor events
   */
  start() {
    if (this.isActive) return;

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', this._handleOrientation, true);
      this.isActive = true;

      // Also listen to DeviceMotionEvent to accurately track gravity Z (face-down detection)
      if (window.DeviceMotionEvent) {
        window.addEventListener('devicemotion', this._handleMotion, true);
      }

      // Fallback timeout to detect if running on desktop without accelerometers
      setTimeout(() => {
        if (!this.hasHardware) {
          console.info('No hardware sensor signal detected. Activating PC simulator mode.');
          this.isSimulating = true;
          this._notifyUpdate();
        }
      }, 1000);
    } else {
      console.warn('DeviceOrientationEvent not supported by browser. Simulator mode active.');
      this.isSimulating = true;
      this._notifyUpdate();
    }
  }

  /**
   * Stops listening to sensor events
   */
  stop() {
    if (!this.isActive) return;
    window.removeEventListener('deviceorientation', this._handleOrientation, true);
    if (window.DeviceMotionEvent) {
      window.removeEventListener('devicemotion', this._handleMotion, true);
    }
    this.isActive = false;
  }

  _handleMotion(event) {
    const acc = event.accelerationIncludingGravity;
    if (acc && typeof acc.z === 'number') {
      this.gravityZ = acc.z;
    }
  }

  _handleOrientation(event) {
    // If we receive null values (typical behavior for desktop browsers without IMU)
    if (event.beta === null && event.gamma === null) {
      if (!this.isSimulating) {
        this.isSimulating = true;
        this._notifyUpdate();
      }
      return;
    }

    this.hasHardware = true;
    this.isSimulating = false;

    // Detect face-down: gravity Z pointing downwards (z < -4.0 m/s^2) or beta tilted past 125 degrees
    const isFaceDown = (this.gravityZ !== null && this.gravityZ < -4.0) || Math.abs(event.beta || 0) > 125;

    // Coordinate normalization:
    // beta: front/back tilt [-180, 180] (positive top edge up when facing screen)
    // gamma: left/right tilt [-90, 90] (positive right edge up)
    // alpha: compass direction [0, 360]
    if (this.onUpdate) {
      this.onUpdate({
        rawBeta: event.beta || 0,
        rawGamma: event.gamma || 0,
        rawAlpha: event.alpha || 0,
        isFaceDown: isFaceDown,
        isSimulated: false,
        hasHardware: true
      });
    }
  }

  /**
   * Allows simulating tilt via mouse/touch (for PC testing)
   */
  setSimulatedAngles(beta, gamma, alpha = 0, isFaceDown = false) {
    this.isSimulating = true;
    this.simulatedBeta = Math.max(-180, Math.min(180, beta));
    this.simulatedGamma = Math.max(-90, Math.min(90, gamma));
    this.simulatedAlpha = alpha;
    this.simulatedFaceDown = isFaceDown;
    this._notifyUpdate();
  }

  _notifyUpdate() {
    if (this.onUpdate) {
      this.onUpdate({
        rawBeta: this.simulatedBeta,
        rawGamma: this.simulatedGamma,
        rawAlpha: this.simulatedAlpha,
        isFaceDown: this.simulatedFaceDown,
        isSimulated: this.isSimulating,
        hasHardware: this.hasHardware
      });
    }
  }

  _handleSimulatedPointer(e) {
    // Desktop touch/drag handler
  }
}
