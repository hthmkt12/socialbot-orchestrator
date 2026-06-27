# Connecting Devices

You can connect both Android and iOS devices to the platform. We rely on the open-source `mobilerun` backend to interact natively with accessibility trees.

## Android (ADB)

1. Enable **Developer Options** and **USB Debugging** on your phone.
2. Connect your phone via USB.
3. On your host machine, ensure you have Android Platform Tools installed.
4. Run `adb devices`. If authorized, the device will automatically appear in your **Fleet Health** dashboard within 30 seconds.

*Note: The platform will automatically install the Portal APK required for UI interactions upon the first connection.*

## iOS (Portal App)

Apple's restrictive ecosystem requires manual setup:
1. Install the `mobilerun` Portal app onto your iPhone via Xcode or AltStore.
2. Enable Developer Mode in iOS settings.
3. Open the Portal app on the iPhone.
4. Forward the port using `iproxy 6643:6643`.
5. The device will be discovered automatically by the worker.
