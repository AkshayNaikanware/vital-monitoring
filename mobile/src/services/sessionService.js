
import { v4 as uuidv4 } from "uuid";

import { db } from "../database/database";

export const startSession = async (
  deviceId,
  patientId
) => {

  const sessionId = uuidv4();

  const startedAt = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO sessions
    (sessionId, deviceId, patientId,
     status, startedAt)
     VALUES (?, ?, ?, ?, ?)`,

    sessionId,
    deviceId,
    patientId,
    "active",
    startedAt
  );

  return {
    sessionId,
    deviceId,
    patientId,
    startedAt
  };
};

export const stopSession = async (sessionId) => {

  await db.runAsync(
    `UPDATE sessions
     SET status = ?, endedAt = ?
     WHERE sessionId = ?`,

    "completed",
    new Date().toISOString(),
    sessionId
  );
};
