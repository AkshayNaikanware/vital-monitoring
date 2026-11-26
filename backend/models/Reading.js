
const mongoose = require("mongoose");

const readingSchema = new mongoose.Schema(
  {
    // Unique ID generated on the mobile device
    readingId: {
      type: String,
      required: [true, "Reading ID is required"],
      unique: true,
      trim: true
    },

    // Session to which this reading belongs
    sessionId: {
      type: String,
      required: [true, "Session ID is required"],
      trim: true,
      index: true
    },

    // Device that generated the reading
    deviceId: {
      type: String,
      required: [true, "Device ID is required"],
      trim: true,
      index: true
    },

    // Patient being monitored
    patientId: {
      type: String,
      required: [true, "Patient ID is required"],
      trim: true,
      index: true
    },

    // Simulated heart rate
    heartRate: {
      type: Number,
      required: [true, "Heart rate is required"],
      min: [60, "Heart rate cannot be below 60"],
      max: [100, "Heart rate cannot exceed 100"],
      validate: {
        validator: Number.isInteger,
        message: "Heart rate must be an integer"
      }
    },

    // Actual reading time on the mobile device
    recordedAt: {
      type: Date,
      required: [true, "Reading timestamp is required"]
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Enforce unique reading IDs at database level
readingSchema.index(
  { readingId: 1 },
  { unique: true }
);

// Optimize session history queries
readingSchema.index({
  sessionId: 1,
  recordedAt: -1
});

// Optimize latest reading queries by device
readingSchema.index({
  deviceId: 1,
  recordedAt: -1
});

const Reading = mongoose.model("Reading", readingSchema);

module.exports = Reading;
