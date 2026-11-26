
const validateSession = (req, res, next) => {
  const { sessionId, deviceId, patientId } = req.body || {};

  const errors = [];

  const validateRequiredString = (value, fieldName) => {
    if (typeof value !== "string" || !value.trim()) {
      errors.push(
        `${fieldName} is required and must be a non-empty string`
      );
    } else if (value.trim().length > 100) {
      errors.push(`${fieldName} cannot exceed 100 characters`);
    }
  };

  validateRequiredString(sessionId, "sessionId");
  validateRequiredString(deviceId, "deviceId");
  validateRequiredString(patientId, "patientId");

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors
    });
  }

  req.body.sessionId = sessionId.trim();
  req.body.deviceId = deviceId.trim();
  req.body.patientId = patientId.trim();

  next();
};

module.exports = validateSession;
