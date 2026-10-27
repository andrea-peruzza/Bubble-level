# Bubble-level 📱🎯

A high-precision, mobile-first web application designed to measure surface inclination simply by placing your smartphone on it.

## ✨ Key Features

- **Hardware Sensor Access:** Reads real-time accelerometer and gyroscope data using the standard `DeviceOrientationEvent` API.
- **Exponential Moving Average (EMA) Low-Pass Filter:** Eliminates sensor jitter and hardware noise while maintaining smooth 60 FPS responsiveness.
- **Tare / Zero Calibration:** Allows zeroing the level on any reference surface to compensate for camera bumps or to measure relative inclinations.
- **Face-Down Auto-Freeze Mode:** Place the phone screen down on its perfectly flat front glass (eliminating camera bump unevenness). The sensors detect face-down placement, wait ~1s for stability, emit a dual-vibration/chime confirmation, and freeze the measurement on screen. Turn the phone over, read the locked angle, and tap "Unlock / Resume" when done!
- **Instant Visual & Haptic Feedback:**
  - **Visual:** Background and display smoothly glow vibrant green as soon as the surface is level ($\le 0.2^\circ$).
  - **Haptic:** Vibration pulse (`navigator.vibrate`) when reaching the level state.
  - **Screen Wake Lock:** Keeps the screen on during measurements (`navigator.wakeLock`).
- **iOS Safari Support:** Built-in permission request flow for iOS 13+.
- **Built-in Desktop Simulator:** Allows full testing on PC browsers by dragging the mouse across the target or using tilt sliders.

## 🚀 Running Locally

Because the application uses native ES modules (`import/export`), it should be served via a local web server:

```bash
# Quick start with Python:
python -m http.server 8000

# Or with Node:
npx serve
```

Open `http://localhost:8000` in your browser.

> [!IMPORTANT]
> **Smartphone Testing:** Modern mobile browsers (Chrome and Safari) require secure **HTTPS** connections to access motion sensors when not on `localhost`. To test on your phone:
> 1. Enable **GitHub Pages** on your repository (recommended for immediate HTTPS access), or
> 2. Use a local HTTPS tunnel like Cloudflare Tunnel or Ngrok (`ngrok http 8000`).

## 🧪 Automated Tests

To verify the mathematical filter algorithms and calibration logic:

```bash
npm test
```

## 📄 License

This project is licensed under the PolyForm Noncommercial License 1.0.0. See the `LICENSE` file for details.
