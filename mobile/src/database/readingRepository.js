
import { db } from "./database";

export const saveReading = async (reading) => {

  await db.runAsync(
    `INSERT OR IGNORE INTO readings
    (
      readingId,
      sessionId,
      deviceId,
      patientId,
      heartRate,
      recordedAt,
      syncStatus
    )
    VALUES (?, ?, ?, ?, ?, ?, 'pending')`,

    reading.readingId,
    reading.sessionId,
    reading.deviceId,
    reading.patientId,
    reading.heartRate,
    reading.recordedAt
  );
};

export const getPendingReadings = async () => {

  return db.getAllAsync(
    `SELECT * FROM readings
     WHERE syncStatus = 'pending'
     ORDER BY recordedAt ASC
     LIMIT 500`
  );
};

export const markReadingsSynced = async (ids) => {

  if (!ids.length) return;

  await db.withTransactionAsync(async () => {

    for (const id of ids) {
      await db.runAsync(
        `UPDATE readings
         SET syncStatus = 'synced'
         WHERE readingId = ?`,
        id
      );
    }

  });
};
