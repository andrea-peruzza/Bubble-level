# Bubble-level

A mobile-first web application designed to measure surface inclination simply by placing your smartphone on it.

## Key Features

- **Hardware Sensor Access:** Reads real-time accelerometer and gyroscope data using the standard `DeviceOrientationEvent` API.
- **Exponential Moving Average (EMA) Low-Pass Filter:** Eliminates sensor jitter and hardware noise while maintaining 60 FPS responsiveness.
- **Tare / Zero Calibration:** Allows zeroing the level on any reference surface to compensate for camera bumps or to measure relative inclinations.
- **Face-Down Auto-Freeze Mode:** Place the phone screen down on its perfectly flat front glass (eliminating camera bump unevenness). The sensors detect face-down placement, wait ~1s for stability, emit a dual-vibration/chime confirmation, and freeze the measurement on screen. Turn the phone over, read the locked angle, and tap "Unlock" when done.
- **2D Bull's Eye Level:** Visual target with graduated concentric rings (1°, 2°, 5°) and crosshairs.
- **Instant Visual & Haptic Feedback:**
  - **Visual:** Background and display smoothly glow vibrant green as soon as the surface is level ($\le 0.2^\circ$).
  - **Haptic:** Vibration pulse (`navigator.vibrate`) when reaching the level state.
  - **Screen Wake Lock:** Keeps the screen on during measurements (`navigator.wakeLock`).
- **iOS Safari Support:** Built-in permission request flow for iOS 13+.
- **Progressive Web App (PWA):** Fully installable on Android and iOS home screens. Works 100% offline via Service Worker caching, runs fullscreen like a native app and includes an in-app "Install" button.
- **Built-in Desktop Simulator:** Allows full testing on PC browsers by dragging the mouse across the target or using tilt sliders.

To get round the potential problem of the phone’s camera protruding from the phone’s body and preventing it from lying flat on a surface, as well as the customisable calibration, there is also a feature that allows you to place the phone face down on the surface, given the smooth surface of the screen. The system will detect the phone’s position and, after about 1 second of it remaining still on the surface, it will vibrate to indicate that the measurement has been taken. The screen will then lock, allowing the user to view the measurement and subsequently unlock the screen to take further measurements.

## Running Locally

Because the application uses native ES modules (`import/export`), it should be served via a local web server. On this cloned directory open CMD and do these actions:

```bash
# Quick start with Python:
python -m http.server 8000

# Or with Node:
npx serve
```

Open `http://localhost:8000` in your browser.


## Automated Tests

To verify the mathematical filter algorithms and calibration logic:

```bash
npm test
```

## License

This project is licensed under the PolyForm Noncommercial License 1.0.0. See the `LICENSE` file for details.
