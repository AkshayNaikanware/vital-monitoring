
const Device = require("../models/Device");
const Session = require("../models/Session");
const Reading = require("../models/Reading");

// POST /api/readings/sync
const syncReadings = async (req, res) => {
  try {
    const {
      sessionId,
      deviceId,
      patientId,
      readings
    } = req.body;

    // Step 1: Verify that the device exists
    const device = await Device.findOne({ deviceId });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Device is not registered"
      });
    }

    if (device.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Device is not active and cannot sync readings"
      });
    }

    // Step 2: Verify that the session exists
    const session = await Session.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found"
      });
    }

    // Step 3: Verify session ownership
    if (
      session.deviceId !== deviceId ||
      session.patientId !== patientId
    ) {
      return res.status(409).json({
        success: false,
        message: "Session, device and patient details do not match"
      });
    }

    // Step 4: Check existing reading IDs
    const readingIds = readings.map((item) => item.readingId);

    const existingReadings = await Reading.find({
      readingId: { $in: readingIds }
    }).lean();

    const existingMap = new Map(
      existingReadings.map((item) => [item.readingId, item])
    );

    let alreadySyncedCount = 0;

    // A repeated ID must represent the same reading
    for (const incoming of readings) {
      const existing = existingMap.get(incoming.readingId);

      if (!existing) {
        continue;
      }

      const sameReading =
        existing.sessionId === sessionId &&
        existing.deviceId === deviceId &&
        existing.patientId === patientId &&
        existing.heartRate === incoming.heartRate &&
        new Date(existing.recordedAt).getTime() ===
          incoming.recordedAt.getTime();

      if (!sameReading) {
        return res.status(409).json({
          success: false,
          message: `Reading ID ${incoming.readingId} already exists with different data`
        });
      }

      alreadySyncedCount++;
    }

    // Step 5: Insert only new readings
    const newReadings = readings.filter(
      (item) => !existingMap.has(item.readingId)
    );

    let insertedCount = 0;

    if (newReadings.length > 0) {
      const operations = newReadings.map((item) => ({
        updateOne: {
          filter: { readingId: item.readingId },
          update: {
            $setOnInsert: {
              readingId: item.readingId,
              sessionId,
              deviceId,
              patientId,
              heartRate: item.heartRate,
              recordedAt: item.recordedAt
            }
          },
          upsert: true
        }
      }));

      try {
        const result = await Reading.bulkWrite(operations, {
          ordered: false
        });

        insertedCount = result.upsertedCount || 0;
        alreadySyncedCount +=
          newReadings.length - insertedCount;
      } catch (error) {
        // A concurrent request may have inserted the same IDs.
        // Verify the stored data before acknowledging the batch.
        const savedReadings = await Reading.find({
          readingId: { $in: readingIds }
        }).lean();

        const savedMap = new Map(
          savedReadings.map((item) => [item.readingId, item])
        );

        for (const incoming of readings) {
          const saved = savedMap.get(incoming.readingId);

          if (!saved) {
            throw error;
          }

          const matches =
            saved.sessionId === sessionId &&
            saved.deviceId === deviceId &&
            saved.patientId === patientId &&
            saved.heartRate === incoming.heartRate &&
            new Date(saved.recordedAt).getTime() ===
              incoming.recordedAt.getTime();

          if (!matches) {
            return res.status(409).json({
              success: false,
              message: `Reading ID ${incoming.readingId} already exists with different data`
            });
          }
        }

        // All records are now confirmed in the database.
        insertedCount = 0;
        alreadySyncedCount = readings.length;
      }
    }

    // Step 6: Update the session's last synchronization time
    const syncedAt = new Date();

    await Session.updateOne(
      { sessionId },
      { $set: { lastSyncedAt: syncedAt } }
    );

    // Step 7: Acknowledge successful synchronization
    return res.status(200).json({
      success: true,
      message: "Readings synchronized successfully",
      data: {
        sessionId,
        deviceId,
        totalReceived: readings.length,
        insertedCount,
        alreadySyncedCount,
        syncedAt,
        acknowledgedReadingIds: readingIds
      }
    });
  } catch (error) {
    console.error("Reading synchronization error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error while synchronizing readings"
    });
  }
};

module.exports = {
  syncReadings
};
