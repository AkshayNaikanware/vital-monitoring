
const validateReadings = (req, res, next) => {
  const { sessionId, deviceId, patientId, readings } = req.body || {};

  const errors = [];

  // Validate common session fields
  const requiredFields = {
    sessionId,
    deviceId,
    patientId
  };

  for (const [field, value] of Object.entries(requiredFields)) {
    if (typeof value !== "string" || !value.trim()) {
      errors.push(`${field} is required and must be a non-empty string`);
    } else if (value.trim().length > 100) {
      errors.push(`${field} cannot exceed 100 characters`);
    }
  }

  // Validate readings array
  if (!Array.isArray(readings)) {
    errors.push("readings must be an array");
  } else if (readings.length === 0) {
    errors.push("At least one reading is required");
  } else if (readings.length > 500) {
    errors.push("A maximum of 500 readings is allowed per request");
  } else {
    const seenIds = new Set();

    readings.forEach((reading, index) => {
      if (!reading || typeof reading !== "object" || Array.isArray(reading)) {
        errors.push(`Reading at index ${index} must be an object`);
        return;
      }

      // Validate readingId
      if (
        typeof reading.readingId !== "string" ||
        !reading.readingId.trim()
      ) {
        errors.push(
          `readings[${index}].readingId is required`
        );
      } else if (reading.readingId.trim().length > 100) {
        errors.push(
          `readings[${index}].readingId cannot exceed 100 characters`
        );
      } else {
        const normalizedId = reading.readingId.trim();

        if (seenIds.has(normalizedId)) {
          errors.push(
            `Duplicate readingId in request: ${normalizedId}`
          );
        }

        seenIds.add(normalizedId);
      }

      // Validate heart rate
      if (
        !Number.isInteger(reading.heartRate) ||
        reading.heartRate < 60 ||
        reading.heartRate > 100
      ) {
        errors.push(
          `readings[${index}].heartRate must be an integer between 60 and 100`
        );
      }

      // Validate capture timestamp
      if (
        typeof reading.recordedAt !== "string" ||
        !reading.recordedAt.trim() ||
        Number.isNaN(Date.parse(reading.recordedAt))
      ) {
        errors.push(
          `readings[${index}].recordedAt must be a valid date`
        );
      }
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors
    });
  }

  // Normalize common fields
  req.body.sessionId = sessionId.trim();
  req.body.deviceId = deviceId.trim();
  req.body.patientId = patientId.trim();

  // Normalize each reading
  req.body.readings = readings.map((reading) => ({
    readingId: reading.readingId.trim(),
    heartRate: reading.heartRate,
    recordedAt: new Date(reading.recordedAt)
  }));

  next();
};

module.exports = validateReadings;
