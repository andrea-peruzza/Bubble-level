/**
 * filter.js
 * Sensor noise filtering module and calibration (offset) management.
 */

export class SensorFilter {
  /**
   * @param {number} smoothingFactor - Value between 0 (maximum smoothing/slower response) and 1 (no filter/raw). Default 0.25
   */
  constructor(smoothingFactor = 0.25) {
    this.smoothingFactor = smoothingFactor;
    this.filteredBeta = null;
    this.filteredGamma = null;
    this.filteredAlpha = null;

    // Calibration offset (Tare)
    this.offsetBeta = 0;
    this.offsetGamma = 0;

    this.loadCalibration();
  }

  /**
   * Applies the Exponential Moving Average (EMA) low-pass filter and subtracts calibration offset.
   * @param {number} rawBeta 
   * @param {number} rawGamma 
   * @param {number} rawAlpha 
   * @returns {{ beta: number, gamma: number, alpha: number, totalTilt: number }}
   */
  update(rawBeta, rawGamma, rawAlpha) {
    if (rawBeta === null || rawGamma === null) {
      return { beta: 0, gamma: 0, alpha: 0, totalTilt: 0 };
    }

    // Initialize with first raw readings
    if (this.filteredBeta === null) {
      this.filteredBeta = rawBeta;
      this.filteredGamma = rawGamma;
      this.filteredAlpha = rawAlpha || 0;
    } else {
      // Exponential Moving Average (EMA) filter
      this.filteredBeta += this.smoothingFactor * (rawBeta - this.filteredBeta);
      this.filteredGamma += this.smoothingFactor * (rawGamma - this.filteredGamma);
      if (rawAlpha !== null && rawAlpha !== undefined) {
        this.filteredAlpha += this.smoothingFactor * (rawAlpha - this.filteredAlpha);
      }
    }

    // Apply calibration offset (Tare)
    const calibratedBeta = this.filteredBeta - this.offsetBeta;
    const calibratedGamma = this.filteredGamma - this.offsetGamma;

    // Calculate total absolute tilt relative to the horizontal plane
    // Using spherical trigonometry for small/medium angles:
    // cos(theta) = cos(beta) * cos(gamma)
    const betaRad = (calibratedBeta * Math.PI) / 180;
    const gammaRad = (calibratedGamma * Math.PI) / 180;
    const cosTotal = Math.cos(betaRad) * Math.cos(gammaRad);
    // Clamp between -1 and 1 for numerical stability
    const clampedCos = Math.max(-1, Math.min(1, cosTotal));
    const totalTilt = (Math.acos(clampedCos) * 180) / Math.PI;

    return {
      beta: calibratedBeta,
      gamma: calibratedGamma,
      alpha: this.filteredAlpha || 0,
      totalTilt: totalTilt
    };
  }

  /**
   * Saves current position as the "zero point" (Tare to compensate for camera bumps or reference surfaces)
   */
  calibrate() {
    if (this.filteredBeta !== null && this.filteredGamma !== null) {
      this.offsetBeta = this.filteredBeta;
      this.offsetGamma = this.filteredGamma;
      this.saveCalibration();
    }
  }

  /**
   * Resets calibration back to sensor defaults
   */
  resetCalibration() {
    this.offsetBeta = 0;
    this.offsetGamma = 0;
    localStorage.removeItem('bubble_level_calibration');
  }

  saveCalibration() {
    try {
      const data = {
        offsetBeta: this.offsetBeta,
        offsetGamma: this.offsetGamma,
        timestamp: Date.now()
      };
      localStorage.setItem('bubble_level_calibration', JSON.stringify(data));
    } catch (e) {
      console.warn('Unable to save calibration to localStorage:', e);
    }
  }

  loadCalibration() {
    try {
      const saved = localStorage.getItem('bubble_level_calibration');
      if (saved) {
        const data = JSON.parse(saved);
        if (typeof data.offsetBeta === 'number' && typeof data.offsetGamma === 'number') {
          this.offsetBeta = data.offsetBeta;
          this.offsetGamma = data.offsetGamma;
        }
      }
    } catch (e) {
      console.warn('Unable to load calibration from localStorage:', e);
    }
  }

  isCalibrated() {
    return Math.abs(this.offsetBeta) > 0.001 || Math.abs(this.offsetGamma) > 0.001;
  }
}
