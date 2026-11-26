
const API_BASE_URL = "http://10.53.8.196:5000/api";

// --------------------------------------------------
// COMMON API REQUEST
// --------------------------------------------------

const apiRequest = async (endpoint, options = {}) => {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch (error) {
    throw new Error(
      "Cannot connect to backend. Check Wi-Fi, backend server and API IP address."
    );
  }

  let result;

  try {
    result = await response.json();
  } catch (error) {
    throw new Error(
      `Backend returned an invalid response. HTTP ${response.status}`
    );
  }

  if (!response.ok) {
    throw new Error(
      result.message || `Request failed. HTTP ${response.status}`
    );
  }

  return result;
};

// --------------------------------------------------
// REGISTER DEVICE
// --------------------------------------------------

export const registerDevice = async (deviceId, deviceName) => {
  return apiRequest("/devices/register", {
    method: "POST",
    body: JSON.stringify({
      deviceId,
      deviceName,
    }),
  });
};

// --------------------------------------------------
// CREATE SESSION
// --------------------------------------------------

export const createSession = async (
  sessionId,
  deviceId,
  patientId
) => {
  return apiRequest("/sessions", {
    method: "POST",
    body: JSON.stringify({
      sessionId,
      deviceId,
      patientId,
    }),
  });
};

// --------------------------------------------------
// COMPLETE SESSION
// --------------------------------------------------

export const completeSession = async (sessionId) => {
  return apiRequest(
    `/sessions/${encodeURIComponent(sessionId)}/complete`,
    {
      method: "PATCH",
    }
  );
};

// --------------------------------------------------
// SYNCHRONIZE READINGS
// --------------------------------------------------

export const syncReadings = async ({
  sessionId,
  deviceId,
  patientId,
  readings,
}) => {
  if (!Array.isArray(readings) || readings.length === 0) {
    throw new Error("No readings provided for synchronization.");
  }

  // Convert SQLite fields to backend fields.
  const formattedReadings = readings.map((reading) => ({
    readingId: reading.readingId ?? reading.reading_id,
    heartRate: reading.heartRate ?? reading.heart_rate,
    recordedAt: reading.recordedAt ?? reading.recorded_at,
  }));

  // Validate every reading before uploading.
  for (const reading of formattedReadings) {
    if (!reading.readingId) {
      throw new Error("A reading is missing its reading ID.");
    }

    if (
      !Number.isInteger(reading.heartRate) ||
      reading.heartRate < 60 ||
      reading.heartRate > 100
    ) {
      throw new Error(
        `Invalid heart rate for reading ${reading.readingId}`
      );
    }

    if (
      !reading.recordedAt ||
      Number.isNaN(new Date(reading.recordedAt).getTime())
    ) {
      throw new Error(
        `Invalid timestamp for reading ${reading.readingId}`
      );
    }
  }

  console.log(
    "Sending readings to backend:",
    formattedReadings.length
  );

  const response = await apiRequest("/readings/sync", {
    method: "POST",
    body: JSON.stringify({
      sessionId,
      deviceId,
      patientId,
      readings: formattedReadings,
    }),
  });

  // Backend response has acknowledged IDs inside response.data.
  const acknowledgedReadingIds =
    response.data?.acknowledgedReadingIds || [];

  console.log(
    "Backend acknowledged readings:",
    acknowledgedReadingIds.length
  );

  return {
    success: response.success === true,
    acknowledgedReadingIds,
    data: response.data,
  };
};

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

export const checkBackendHealth = async () => {
  return apiRequest("/health", {
    method: "GET",
  });
};
