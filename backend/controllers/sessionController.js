const Device = require("../models/Device");
const Session = require("../models/Session");
const Reading = require("../models/Reading");

// POST /api/sessions
const createSession = async (req, res) => {
  try {
    const { sessionId, deviceId, patientId } = req.body;

    // Step 1: Check whether the device exists
    const device = await Device.findOne({ deviceId });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Device is not registered"
      });
    }

    // Step 2: Check whether the device is active
    if (device.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Device is not active and cannot start a session"
      });
    }

    // Step 3: Check whether this session already exists
    let existingSession = await Session.findOne({ sessionId });

    if (existingSession) {
      // A session ID cannot be reused for another device or patient
      if (
        existingSession.deviceId !== deviceId ||
        existingSession.patientId !== patientId
      ) {
        return res.status(409).json({
          success: false,
          message: "Session ID already belongs to another device or patient"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Session already exists",
        data: formatSession(existingSession)
      });
    }

    // Step 4: Create a new active session
    try {
      const session = await Session.create({
        sessionId,
        deviceId,
        patientId,
        status: "active"
      });

      return res.status(201).json({
        success: true,
        message: "Session created successfully",
        data: formatSession(session)
      });
    } catch (error) {
      if (error.code === 11000) {
        existingSession = await Session.findOne({ sessionId });

        if (!existingSession) {
          throw error;
        }

        if (
          existingSession.deviceId !== deviceId ||
          existingSession.patientId !== patientId
        ) {
          return res.status(409).json({
            success: false,
            message: "Session ID already belongs to another device or patient"
          });
        }

        return res.status(200).json({
          success: true,
          message: "Session already exists",
          data: formatSession(existingSession)
        });
      }

      throw error;
    }
  } catch (error) {
    console.error("Session creation error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error while creating session"
    });
  }
};
const completeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId || !sessionId.trim()) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required"
      });
    }

    const session = await Session.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found"
      });
    }

    // Make repeated completion requests safe.
    if (session.status === "completed") {
      return res.status(200).json({
        success: true,
        message: "Session is already completed",
        data: {
          sessionId: session.sessionId,
          status: session.status,
          startedAt: session.startedAt,
          endedAt: session.endedAt
        }
      });
    }

    if (session.status !== "active") {
      return res.status(409).json({
        success: false,
        message: `Cannot complete a session with status: ${session.status}`
      });
    }

    session.status = "completed";
    session.endedAt = new Date();

    await session.save();

    return res.status(200).json({
      success: true,
      message: "Session completed successfully",
      data: {
        sessionId: session.sessionId,
        status: session.status,
        startedAt: session.startedAt,
        endedAt: session.endedAt
      }
    });
  } catch (error) {
    console.error("Complete session error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to complete session"
    });
  }
};
// GET /api/sessions (Session history)
const getSessionHistory = async (req, res) => {
  try {
    const {
      deviceId,
      patientId,
      status,
      page = 1,
      limit = 20
    } = req.query;

    // Build filters
    const filter = {};

    if (deviceId) {
      filter.deviceId = deviceId;
    }

    if (patientId) {
      filter.patientId = patientId;
    }

    if (status) {
      const allowedStatuses = [
        "active",
        "completed",
        "interrupted"
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid session status"
        });
      }

      filter.status = status;
    }

    // Validate pagination
    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if (
      !Number.isInteger(pageNumber) ||
      !Number.isInteger(limitNumber) ||
      pageNumber < 1 ||
      limitNumber < 1 ||
      limitNumber > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid page or limit"
      });
    }

    const skip = (pageNumber - 1) * limitNumber;

    const [sessions, totalSessions] = await Promise.all([
      Session.find(filter)
        .sort({ startedAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),

      Session.countDocuments(filter)
    ]);

    // Count readings belonging to each returned session
    const sessionIds = sessions.map(
      (session) => session.sessionId
    );

    const readingCounts = await Reading.aggregate([
      {
        $match: {
          sessionId: { $in: sessionIds }
        }
      },
      {
        $group: {
          _id: "$sessionId",
          totalReadings: { $sum: 1 }
        }
      }
    ]);

    const countMap = {};

    readingCounts.forEach((item) => {
      countMap[item._id] = item.totalReadings;
    });

    const history = sessions.map((session) => ({
      sessionId: session.sessionId,
      deviceId: session.deviceId,
      patientId: session.patientId,
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      lastSyncedAt: session.lastSyncedAt,
      totalReadings: countMap[session.sessionId] || 0
    }));

    return res.status(200).json({
      success: true,
      message: "Session history retrieved successfully",
      data: {
        sessions: history,
        pagination: {
          currentPage: pageNumber,
          limit: limitNumber,
          totalSessions,
          totalPages: Math.ceil(
            totalSessions / limitNumber
          )
        }
      }
    });
  } catch (error) {
    console.error("Get session history error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve session history"
    });
  }
};

// Keep the response structure consistent
const formatSession = (session) => ({
  sessionId: session.sessionId,
  deviceId: session.deviceId,
  patientId: session.patientId,
  status: session.status,
  startedAt: session.startedAt,
  endedAt: session.endedAt
});




module.exports = {
  createSession,
  getSessionHistory,
  completeSession
};
