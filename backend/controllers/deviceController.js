
const Device = require("../models/Device");

// POST /api/devices/register
const registerDevice = async (req, res) => {
  try {
    const { deviceId, deviceName } = req.body;

    // Check whether this device is already registered
    let device = await Device.findOne({ deviceId });

    if (device) {
      // Do not reactivate a revoked device through registration
      if (device.status === "revoked") {
        return res.status(403).json({
          success: false,
          message: "This device has been revoked"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Device is already registered",
        data: {
          deviceId: device.deviceId,
          deviceName: device.deviceName,
          status: device.status,
          registeredAt: device.registeredAt
        }
      });
    }

    // Register a new device
    try {
      device = await Device.create({
        deviceId,
        deviceName: deviceName || "Android Monitor"
      });
    } catch (error) {
      // Handle two requests registering the same ID simultaneously
      if (error.code === 11000) {
        device = await Device.findOne({ deviceId });

        if (!device) {
          throw error;
        }

        if (device.status === "revoked") {
          return res.status(403).json({
            success: false,
            message: "This device has been revoked"
          });
        }

        return res.status(200).json({
          success: true,
          message: "Device is already registered",
          data: {
            deviceId: device.deviceId,
            deviceName: device.deviceName,
            status: device.status,
            registeredAt: device.registeredAt
          }
        });
      }

      throw error;
    }

    return res.status(201).json({
      success: true,
      message: "Device registered successfully",
      data: {
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        status: device.status,
        registeredAt: device.registeredAt
      }
    });
  } catch (error) {
    console.error("Device registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error while registering device"
    });
  }
};

module.exports = { registerDevice };

