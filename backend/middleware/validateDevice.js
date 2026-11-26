
const validateDevice = (req, res, next) => {
  const { deviceId, deviceName } = req.body || {};

  const errors = [];

  // Validate deviceId
  if (typeof deviceId !== "string" || !deviceId.trim()) {
    errors.push("deviceId is required and must be a non-empty string");
  } else if (deviceId.trim().length > 100) {
    errors.push("deviceId cannot exceed 100 characters");
  }

  // Validate deviceName if supplied
  if (
    deviceName !== undefined &&
    typeof deviceName !== "string"
  ) {
    errors.push("deviceName must be a string");
  } else if (
    typeof deviceName === "string" &&
    deviceName.trim().length > 100
  ) {
    errors.push("deviceName cannot exceed 100 characters");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors
    });
  }

  // Store trimmed values for the controller
  req.body.deviceId = deviceId.trim();

  if (typeof deviceName === "string") {
    req.body.deviceName = deviceName.trim();
  }

  next();
};

module.exports = validateDevice;
