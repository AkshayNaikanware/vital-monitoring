
import * as SQLite from "expo-sqlite";

let databasePromise = null;

// ==========================================
// 1. OPEN DATABASE CONNECTION
// ==========================================

const getDatabase = async () => {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync("skitii.db");
  }

  return databasePromise;
};

// ==========================================
// 2. INITIALIZE DATABASE
// ==========================================

export const initDatabase = async () => {
  const db = await getDatabase();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    -- SESSIONS TABLE
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY NOT NULL,
      device_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,

      status TEXT NOT NULL
        CHECK (status IN ('active', 'completed', 'interrupted')),

      started_at TEXT NOT NULL,
      ended_at TEXT,

      sync_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (sync_status IN ('pending', 'synced')),

      created_at TEXT NOT NULL
    );

    -- HEART RATE READINGS TABLE
    CREATE TABLE IF NOT EXISTS readings (
      reading_id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,

      heart_rate INTEGER NOT NULL
        CHECK (heart_rate >= 60 AND heart_rate <= 100),

      recorded_at TEXT NOT NULL,

      sync_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (sync_status IN ('pending', 'synced')),

      synced_at TEXT,

      FOREIGN KEY (session_id)
        REFERENCES sessions(session_id)
        ON DELETE CASCADE
    );

    -- BLUETOOTH EVENTS TABLE
    CREATE TABLE IF NOT EXISTS bluetooth_events (
      event_id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL,

      event_type TEXT NOT NULL
        CHECK (event_type IN ('disconnected', 'reconnected')),

      occurred_at TEXT NOT NULL,

      FOREIGN KEY (session_id)
        REFERENCES sessions(session_id)
        ON DELETE CASCADE
    );

    -- INDEXES
    CREATE INDEX IF NOT EXISTS idx_readings_session
      ON readings(session_id);

    CREATE INDEX IF NOT EXISTS idx_readings_sync
      ON readings(sync_status);

    CREATE INDEX IF NOT EXISTS idx_sessions_sync
      ON sessions(sync_status);

    CREATE INDEX IF NOT EXISTS idx_bluetooth_events_session
      ON bluetooth_events(session_id);
  `);

  // ========================================
  // 3. SQLITE MIGRATION FOR BLUETOOTH SYNC
  // ========================================

  const bluetoothColumns = await db.getAllAsync(
    "PRAGMA table_info(bluetooth_events)"
  );

  const columnNames = bluetoothColumns.map(
    (column) => column.name
  );

  if (!columnNames.includes("sync_status")) {
    await db.execAsync(`
      ALTER TABLE bluetooth_events
      ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending'
    `);
  }

  if (!columnNames.includes("synced_at")) {
    await db.execAsync(`
      ALTER TABLE bluetooth_events
      ADD COLUMN synced_at TEXT
    `);
  }

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_bluetooth_events_sync
    ON bluetooth_events(sync_status)
  `);

  console.log("SKITII SQLite database initialized.");

  return db;
};

// ==========================================
// 4. SAVE SESSION
// ==========================================

export const saveSession = async (session) => {
  const db = await getDatabase();

  const {
    sessionId,
    deviceId,
    patientId,
    status = "active",
    startedAt,
    endedAt = null,
  } = session;

  if (!sessionId || !deviceId || !patientId || !startedAt) {
    throw new Error("Session information is incomplete.");
  }

  await db.runAsync(
    `INSERT OR IGNORE INTO sessions
      (
        session_id,
        device_id,
        patient_id,
        status,
        started_at,
        ended_at,
        created_at
      )
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    sessionId,
    deviceId,
    patientId,
    status,
    startedAt,
    endedAt,
    new Date().toISOString()
  );

  console.log("Session saved locally:", sessionId);
};

// ==========================================
// 5. UPDATE LOCAL SESSION STATUS
// ==========================================

export const updateLocalSessionStatus = async (
  sessionId,
  status,
  endedAt = null
) => {
  const db = await getDatabase();

  if (!sessionId) {
    throw new Error("Session ID is required.");
  }

  if (!["active", "completed", "interrupted"].includes(status)) {
    throw new Error("Invalid session status.");
  }

  await db.runAsync(
    `UPDATE sessions
     SET status = ?,
         ended_at = ?,
         sync_status = 'pending'
     WHERE session_id = ?`,
    status,
    endedAt,
    sessionId
  );

  console.log("Local session status updated:", status);
};

// ==========================================
// 6. SAVE HEART RATE READING
// ==========================================

export const saveReading = async (reading) => {
  const db = await getDatabase();

  const {
    readingId,
    sessionId,
    deviceId,
    patientId,
    heartRate,
    recordedAt,
  } = reading;

  if (
    !readingId ||
    !sessionId ||
    !deviceId ||
    !patientId ||
    !recordedAt
  ) {
    throw new Error("Reading information is incomplete.");
  }

  if (
    !Number.isInteger(heartRate) ||
    heartRate < 60 ||
    heartRate > 100
  ) {
    throw new Error("Heart rate must be between 60 and 100.");
  }

  await db.runAsync(
    `INSERT INTO readings
      (
        reading_id,
        session_id,
        device_id,
        patient_id,
        heart_rate,
        recorded_at
      )
     VALUES (?, ?, ?, ?, ?, ?)`,
    readingId,
    sessionId,
    deviceId,
    patientId,
    heartRate,
    recordedAt
  );

  console.log("Reading saved locally:", heartRate, "BPM");
};

// ==========================================
// 7. GET SESSION READINGS
// ==========================================

export const getSessionReadings = async (sessionId) => {
  const db = await getDatabase();

  return await db.getAllAsync(
    `SELECT *
     FROM readings
     WHERE session_id = ?
     ORDER BY recorded_at ASC`,
    sessionId
  );
};

// ==========================================
// 8. GET ALL SAVED READINGS
// ==========================================

export const getAllSavedReadings = async () => {
  const db = await getDatabase();

  return await db.getAllAsync(`
    SELECT *
    FROM readings
    ORDER BY recorded_at DESC
  `);
};

// ==========================================
// 9. GET PENDING READINGS
// ==========================================

export const getPendingReadings = async (limit = 100) => {
  const db = await getDatabase();

  return await db.getAllAsync(
    `SELECT *
     FROM readings
     WHERE sync_status = 'pending'
     ORDER BY recorded_at ASC
     LIMIT ?`,
    limit
  );
};

// ==========================================
// 10. MARK READINGS SYNCHRONIZED
// ==========================================

export const markReadingsSynced = async (readingIds) => {
  const db = await getDatabase();

  if (!Array.isArray(readingIds) || readingIds.length === 0) {
    return;
  }

  const syncedAt = new Date().toISOString();

  for (const readingId of readingIds) {
    await db.runAsync(
      `UPDATE readings
       SET sync_status = 'synced',
           synced_at = ?
       WHERE reading_id = ?`,
      syncedAt,
      readingId
    );
  }

  console.log(
    "Readings marked as synchronized:",
    readingIds.length
  );
};

// ==========================================
// 11. GET PENDING READING COUNT
// ==========================================

export const getPendingReadingCount = async () => {
  const db = await getDatabase();

  const result = await db.getAllAsync(`
    SELECT COUNT(*) AS count
    FROM readings
    WHERE sync_status = 'pending'
  `);

  return Number(result[0]?.count ?? 0);
};

// ==========================================
// 12. GET PENDING SESSIONS
// ==========================================

export const getPendingSessions = async () => {
  const db = await getDatabase();

  return await db.getAllAsync(`
    SELECT *
    FROM sessions
    WHERE sync_status = 'pending'
    ORDER BY created_at ASC
  `);
};

// ==========================================
// 13. MARK SESSION SYNCHRONIZED
// ==========================================

export const markSessionSynced = async (sessionId) => {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE sessions
     SET sync_status = 'synced'
     WHERE session_id = ?`,
    sessionId
  );

  console.log("Session marked as synchronized:", sessionId);
};

// ==========================================
// 14. GET ALL LOCAL SESSIONS
// ==========================================

export const getAllLocalSessions = async () => {
  const db = await getDatabase();

  return await db.getAllAsync(`
    SELECT *
    FROM sessions
    ORDER BY created_at DESC
  `);
};

// ==========================================
// 15. GET ALL SAVED SESSIONS
// ==========================================

export const getAllSavedSessions = async () => {
  return await getAllLocalSessions();
};

// ==========================================
// 16. SAVE BLUETOOTH EVENT
// ==========================================

export const saveBluetoothEvent = async (
  sessionId,
  eventType
) => {
  const db = await getDatabase();

  if (!sessionId) {
    throw new Error("Session ID is required.");
  }

  if (!["disconnected", "reconnected"].includes(eventType)) {
    throw new Error("Invalid Bluetooth event.");
  }

  // Generate an ID without requiring expo-crypto.
  const eventId = `BT-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;

  const occurredAt = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO bluetooth_events
      (
        event_id,
        session_id,
        event_type,
        occurred_at,
        sync_status
      )
     VALUES (?, ?, ?, ?, 'pending')`,
    eventId,
    sessionId,
    eventType,
    occurredAt
  );

  console.log(
    "Bluetooth event saved locally:",
    eventType,
    occurredAt
  );

  return {
    eventId,
    sessionId,
    eventType,
    occurredAt,
  };
};

// ==========================================
// 17. GET BLUETOOTH EVENTS
// ==========================================

export const getBluetoothEvents = async (sessionId) => {
  const db = await getDatabase();

  return await db.getAllAsync(
    `SELECT *
     FROM bluetooth_events
     WHERE session_id = ?
     ORDER BY occurred_at ASC`,
    sessionId
  );
};

// ==========================================
// 18. GET PENDING BLUETOOTH EVENTS
// ==========================================

export const getPendingBluetoothEvents = async (limit = 100) => {
  const db = await getDatabase();

  return await db.getAllAsync(
    `SELECT
       b.event_id,
       b.session_id,
       b.event_type,
       b.occurred_at,
       s.device_id,
       s.patient_id
     FROM bluetooth_events AS b
     INNER JOIN sessions AS s
       ON s.session_id = b.session_id
     WHERE b.sync_status = 'pending'
     ORDER BY b.occurred_at ASC
     LIMIT ?`,
    limit
  );
};

// ==========================================
// 19. MARK BLUETOOTH EVENTS SYNCHRONIZED
// ==========================================

export const markBluetoothEventsSynced = async (eventIds) => {
  const db = await getDatabase();

  if (!Array.isArray(eventIds) || eventIds.length === 0) {
    return;
  }

  const syncedAt = new Date().toISOString();

  for (const eventId of eventIds) {
    await db.runAsync(
      `UPDATE bluetooth_events
       SET sync_status = 'synced',
           synced_at = ?
       WHERE event_id = ?`,
      syncedAt,
      eventId
    );
  }

  console.log(
    "Bluetooth events marked as synchronized:",
    eventIds.length
  );
};

// ==========================================
// 20. GET DATABASE SUMMARY
// ==========================================

export const getDatabaseSummary = async () => {
  const db = await getDatabase();

  const result = await db.getAllAsync(`
    SELECT
      (SELECT COUNT(*) FROM sessions)
        AS totalSessions,

      (SELECT COUNT(*) FROM readings)
        AS totalReadings,

      (SELECT COUNT(*) FROM sessions
       WHERE sync_status = 'pending')
        AS pendingSessions,

      (SELECT COUNT(*) FROM readings
       WHERE sync_status = 'pending')
        AS pendingReadings,

      (SELECT COUNT(*) FROM bluetooth_events)
        AS totalBluetoothEvents,

      (SELECT COUNT(*) FROM bluetooth_events
       WHERE sync_status = 'pending')
        AS pendingBluetoothEvents
  `);

  const summary = result[0];

  const databaseSummary = {
    totalSessions: Number(summary?.totalSessions ?? 0),
    totalReadings: Number(summary?.totalReadings ?? 0),
    pendingSessions: Number(summary?.pendingSessions ?? 0),
    pendingReadings: Number(summary?.pendingReadings ?? 0),
    totalBluetoothEvents: Number(
      summary?.totalBluetoothEvents ?? 0
    ),
    pendingBluetoothEvents: Number(
      summary?.pendingBluetoothEvents ?? 0
    ),
  };

  console.log("SKITII Database Summary:", databaseSummary);

  return databaseSummary;
};

// ==========================================
// 21. DELETE TEST SESSION
// ==========================================

export const deleteTestSession = async () => {
  const db = await getDatabase();

  await db.runAsync(
    `DELETE FROM sessions
     WHERE session_id = ?`,
    "SQLITE_TEST_SESSION_001"
  );

  console.log("Test session deleted from SQLite.");
};
