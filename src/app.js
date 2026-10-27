/**
 * app.js
 * Main coordinator for the Bubble Level application.
 */

import { SensorFilter } from './filter.js';
import { SensorManager } from './sensors.js';

// Configuration constants
const LEVEL_THRESHOLD_DEG = 0.2; // Tolerance to be considered "Level"
const MAX_SCALE_DEGREES = 6.0;   // Maximum tilt angle mapped to the edge of the circular target

class BubbleLevelApp {
  constructor() {
    this.filter = new SensorFilter(0.22); // Balanced smoothing factor
    this.hapticsEnabled = true;
    this.wasLevel = false;
    this.lastVibrateTime = 0;
    this.wakeLock = null;
    this.audioCtx = null;

    // Face-down auto-freeze state
    this.isFrozen = false;
    this.frozenData = null;
    this.faceDownStartTime = 0;
    this.faceDownHistory = [];

    // DOM References
    this.dom = {
      appContainer: document.querySelector('.app-container'),
      levelTarget: document.getElementById('levelTarget'),
      bubble: document.getElementById('bubble'),
      totalTiltDisplay: document.getElementById('totalTiltDisplay'),
      gammaDisplay: document.getElementById('gammaDisplay'),
      betaDisplay: document.getElementById('betaDisplay'),
      levelStatusText: document.getElementById('levelStatusText'),
      hardwareStatus: document.getElementById('hardwareStatus'),
      calibrationBadge: document.getElementById('calibrationBadge'),
      iosPermissionBanner: document.getElementById('iosPermissionBanner'),
      requestPermissionBtn: document.getElementById('requestPermissionBtn'),
      frozenBanner: document.getElementById('frozenBanner'),
      unfreezeBtn: document.getElementById('unfreezeBtn'),
      tareBtn: document.getElementById('tareBtn'),
      resetTareBtn: document.getElementById('resetTareBtn'),
      toggleHapticsBtn: document.getElementById('toggleHapticsBtn'),
      simulationControls: document.getElementById('simulationControls'),
      simGamma: document.getElementById('simGamma'),
      simBeta: document.getElementById('simBeta'),
      simFaceDown: document.getElementById('simFaceDown')
    };

    // Latest calculated state for the render loop
    this.currentData = {
      beta: 0,
      gamma: 0,
      alpha: 0,
      totalTilt: 0,
      isSimulated: false,
      hasHardware: false
    };

    this.init();
  }

  init() {
    this.sensorManager = new SensorManager(this.onSensorUpdate.bind(this));

    this.setupEventListeners();
    this.updateCalibrationBadge();
    this.initWakeLock();

    // iOS permissions check
    if (this.sensorManager.requiresExplicitPermission()) {
      this.dom.iosPermissionBanner.classList.remove('hidden');
      this.dom.hardwareStatus.textContent = 'Awaiting permission';
    } else {
      this.sensorManager.start();
    }

    // Start 60 FPS rendering loop
    requestAnimationFrame(this.renderLoop.bind(this));
  }

  setupEventListeners() {
    // Unlock AudioContext on first user interaction
    const unlockAudio = () => {
      this.initAudio();
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('click', unlockAudio);
    };
    window.addEventListener('touchstart', unlockAudio, { passive: true });
    window.addEventListener('click', unlockAudio, { passive: true });

    // Request iOS permissions on user click
    this.dom.requestPermissionBtn.addEventListener('click', async () => {
      const res = await this.sensorManager.requestPermission();
      if (res.success) {
        this.dom.iosPermissionBanner.classList.add('hidden');
      } else {
        alert('Unable to access sensors: ' + (res.error || 'Denied'));
      }
    });

    // Tare / Zero calibration
    this.dom.tareBtn.addEventListener('click', () => {
      this.filter.calibrate();
      this.updateCalibrationBadge();
      this.triggerHaptic(60);
    });

    // Reset calibration
    this.dom.resetTareBtn.addEventListener('click', () => {
      this.filter.resetCalibration();
      this.updateCalibrationBadge();
      this.triggerHaptic(30);
    });

    // Toggle Vibration / Haptics
    this.dom.toggleHapticsBtn.addEventListener('click', () => {
      this.hapticsEnabled = !this.hapticsEnabled;
      this.dom.toggleHapticsBtn.classList.toggle('active', this.hapticsEnabled);
      if (this.hapticsEnabled) {
        this.triggerHaptic(40);
      }
    });

    // Interactive pointer drag on PC target
    let isDragging = false;

    const handlePointerMove = (e) => {
      if (!isDragging) return;
      const rect = this.dom.levelTarget.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const clientX = e.clientX ?? (e.touches && e.touches[0].clientX);
      const clientY = e.clientY ?? (e.touches && e.touches[0].clientY);

      const deltaX = clientX - centerX;
      const deltaY = clientY - centerY;
      const radius = rect.width / 2;

      // Map pixels to degrees
      const gammaDeg = (deltaX / radius) * MAX_SCALE_DEGREES;
      const betaDeg = -(deltaY / radius) * MAX_SCALE_DEGREES;

      this.sensorManager.setSimulatedAngles(betaDeg, gammaDeg);

      // Update slider positions
      if (this.dom.simGamma) this.dom.simGamma.value = gammaDeg.toFixed(1);
      if (this.dom.simBeta) this.dom.simBeta.value = betaDeg.toFixed(1);
    };

    this.dom.levelTarget.addEventListener('mousedown', (e) => {
      isDragging = true;
      handlePointerMove(e);
    });

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', () => { isDragging = false; });

    // Unfreeze button
    if (this.dom.unfreezeBtn) {
      this.dom.unfreezeBtn.addEventListener('click', () => {
        this.unfreeze();
      });
    }

    // Desktop simulation sliders
    const onSliderChange = () => {
      const g = parseFloat(this.dom.simGamma.value);
      const b = parseFloat(this.dom.simBeta.value);
      const isDown = this.dom.simFaceDown ? this.dom.simFaceDown.checked : false;
      this.sensorManager.setSimulatedAngles(b, g, 0, isDown);
    };

    this.dom.simGamma.addEventListener('input', onSliderChange);
    this.dom.simBeta.addEventListener('input', onSliderChange);
    if (this.dom.simFaceDown) {
      this.dom.simFaceDown.addEventListener('change', onSliderChange);
    }
  }

  onSensorUpdate({ rawBeta, rawGamma, rawAlpha, isFaceDown, isSimulated, hasHardware }) {
    if (this.isFrozen) {
      return;
    }

    // Apply low-pass filter and calibration offset (with face-down handling)
    const filtered = this.filter.update(rawBeta, rawGamma, rawAlpha, isFaceDown);

    this.currentData = {
      beta: filtered.beta,
      gamma: filtered.gamma,
      alpha: filtered.alpha,
      totalTilt: filtered.totalTilt,
      isFaceDown: filtered.isFaceDown,
      isSimulated,
      hasHardware
    };

    // Auto-freeze check when face down
    this.checkFaceDownAutoFreeze(filtered.isFaceDown, filtered.totalTilt);
  }

  checkFaceDownAutoFreeze(isFaceDown, totalTilt) {
    if (!isFaceDown) {
      this.faceDownStartTime = 0;
      this.faceDownHistory = [];
      return;
    }

    const now = Date.now();
    if (this.faceDownStartTime === 0) {
      this.faceDownStartTime = now;
      this.faceDownHistory = [];
    }

    this.faceDownHistory.push({ tilt: totalTilt, time: now });
    this.faceDownHistory = this.faceDownHistory.filter(h => now - h.time <= 1000);

    // If face down for at least 800ms and sufficiently stable
    if (now - this.faceDownStartTime >= 800 && this.faceDownHistory.length >= 5) {
      const tilts = this.faceDownHistory.map(h => h.tilt);
      const maxT = Math.max(...tilts);
      const minT = Math.min(...tilts);
      const variance = maxT - minT;

      // Phone is steady on the surface (variance <= 0.4°)
      if (variance <= 0.4) {
        this.freezeMeasurement();
      }
    }
  }

  freezeMeasurement() {
    if (this.isFrozen) return;
    this.isFrozen = true;
    this.frozenData = { ...this.currentData };
    this.faceDownStartTime = 0;
    this.faceDownHistory = [];

    // Distinctive confirmation signal: double haptic pulse + chime
    this.triggerHaptic([200, 100, 200]);
    this.playLevelBeep();

    // Show unlock banner
    if (this.dom.frozenBanner) {
      this.dom.frozenBanner.classList.remove('hidden');
    }
    this.dom.appContainer.classList.add('is-frozen');
  }

  unfreeze() {
    this.isFrozen = false;
    this.frozenData = null;
    this.faceDownStartTime = 0;
    this.faceDownHistory = [];
    if (this.dom.frozenBanner) {
      this.dom.frozenBanner.classList.add('hidden');
    }
    this.dom.appContainer.classList.remove('is-frozen');
    this.triggerHaptic(50);
  }

  renderLoop() {
    this.updateUI();
    requestAnimationFrame(this.renderLoop.bind(this));
  }

  updateUI() {
    const data = this.isFrozen && this.frozenData ? this.frozenData : this.currentData;
    const { beta, gamma, totalTilt, isSimulated, hasHardware } = data;

    // Update hardware status badge
    if (isSimulated) {
      this.dom.hardwareStatus.textContent = 'PC Simulator';
      this.dom.hardwareStatus.className = 'badge badge-sim';
      this.dom.simulationControls.classList.remove('hidden');
    } else if (hasHardware) {
      this.dom.hardwareStatus.textContent = 'Sensor Active';
      this.dom.hardwareStatus.className = 'badge badge-active';
      this.dom.simulationControls.classList.add('hidden');
    }

    // Update digital numeric display
    this.dom.totalTiltDisplay.textContent = totalTilt.toFixed(1);
    this.dom.gammaDisplay.textContent = (gamma >= 0 ? '+' : '') + gamma.toFixed(1) + '°';
    this.dom.betaDisplay.textContent = (beta >= 0 ? '+' : '') + beta.toFixed(1) + '°';

    // Calculate bubble position within the circular target
    const targetRect = this.dom.levelTarget.getBoundingClientRect();
    const targetRadius = targetRect.width / 2;
    const bubbleRadius = this.dom.bubble.offsetWidth / 2 || 20;
    const maxDisplacement = Math.max(0, targetRadius - bubbleRadius - 4);

    // Physical air bubble mapping:
    // Air bubble moves towards the highest elevated point:
    // If gamma > 0 (tilted right), right side is higher -> bubble moves right (X > 0)
    // If beta > 0 (tilted up), top side is higher -> bubble moves up (screen Y < 0)
    const scale = maxDisplacement / MAX_SCALE_DEGREES;
    let dx = gamma * scale;
    let dy = -beta * scale;

    // Circular constraint (clamp to maximum target radius)
    const distance = Math.hypot(dx, dy);
    if (distance > maxDisplacement && distance > 0) {
      dx = (dx / distance) * maxDisplacement;
      dy = (dy / distance) * maxDisplacement;
    }

    // Apply translation to bubble
    this.dom.bubble.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`;

    // Check if level condition is met
    const isLevel = totalTilt <= LEVEL_THRESHOLD_DEG;

    if (isLevel) {
      this.dom.appContainer.classList.add('is-level');
      this.dom.levelStatusText.textContent = this.isFrozen ? 'PERFECTLY LEVEL (LOCKED)' : 'PERFECTLY LEVEL';

      // Haptic feedback (vibration upon entering level state)
      if (!this.wasLevel && !this.isFrozen) {
        this.triggerHaptic([150, 60, 150]);
        this.wasLevel = true;
      }
    } else {
      this.dom.appContainer.classList.remove('is-level');
      if (this.isFrozen) {
        this.dom.levelStatusText.textContent = 'MEASUREMENT LOCKED';
      } else if (totalTilt <= 1.0) {
        this.dom.levelStatusText.textContent = 'NEARLY LEVEL';
      } else {
        this.dom.levelStatusText.textContent = 'INCLINED';
      }
      this.wasLevel = false;
    }
  }

  updateCalibrationBadge() {
    const isCalibrated = this.filter.isCalibrated();
    this.dom.calibrationBadge.classList.toggle('hidden', !isCalibrated);
    this.dom.resetTareBtn.classList.toggle('hidden', !isCalibrated);
  }

  initAudio() {
    if (!this.audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioClass();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playLevelBeep() {
    try {
      this.initAudio();
      if (!this.audioCtx || this.audioCtx.state !== 'running') return;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.audioCtx.currentTime); // 880 Hz (A5 soft chime)
      gain.gain.setValueAtTime(0.12, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.12);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.12);
    } catch (e) {
      // Audio not permitted or unavailable
    }
  }

  triggerHaptic(pattern = 150) {
    if (!this.hapticsEnabled) return;
    const now = Date.now();
    if (now - this.lastVibrateTime < 350) return; // Debounce to prevent constant buzzing
    this.lastVibrateTime = now;

    let didVibrate = false;
    if ('vibrate' in navigator) {
      try {
        didVibrate = navigator.vibrate(pattern);
      } catch (e) {
        didVibrate = false;
      }
    }

    // If vibration is not supported or was blocked by browser policy, fallback to audio chime
    if (!didVibrate) {
      this.playLevelBeep();
    }
  }

  async initWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
        document.addEventListener('visibilitychange', async () => {
          if (this.wakeLock !== null && document.visibilityState === 'visible') {
            this.wakeLock = await navigator.wakeLock.request('screen');
          }
        });
      } catch (err) {
        console.warn('Wake Lock unavailable:', err);
      }
    }
  }
}

// Initialize application on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new BubbleLevelApp();
});
