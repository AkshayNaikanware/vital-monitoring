
import React, { useEffect, useRef, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as Network from "expo-network";
import * as Device from "expo-device";

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  registerDevice,
  createSession,
  completeSession,
  syncReadings,
} from "./src/services/api";

import {
  initDatabase,
  saveSession,
  saveReading,
  updateLocalSessionStatus,
  getPendingSessions,
  markSessionSynced,
  getPendingReadings,
  markReadingsSynced,
  getPendingReadingCount,
  getSessionReadings,
  getAllSavedReadings,
  getDatabaseSummary,
  saveBluetoothEvent,
  getBluetoothEvents,
  
} from "./src/database/database";
import { getBluetoothStatusText } from "./src/utils/bluetooth";

// --------------------------------------------------
// CONSTANTS
// --------------------------------------------------

const DEVICE_ID_KEY = "skitiiDeviceId";
const DEVICE_PIN_KEY = "skitiiDevicePin";
const ACTIVE_SESSION_KEY = "skitiiActiveSession";

const SYNC_INTERVAL = 15000;

// --------------------------------------------------
// HELPER FUNCTIONS
// --------------------------------------------------

const generateHeartRate = () => {
  return Math.floor(Math.random() * 41) + 60;
};

const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(remainingSeconds).padStart(2, "0"),
  ].join(":");
};

const getErrorMessage = (error) => {
  return error?.message || "An unexpected error occurred.";
};

// --------------------------------------------------
// MAIN APP
// --------------------------------------------------

export default function App() {
  // ----------------------------------------------
  // STATE
  // ----------------------------------------------

  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);

  const [deviceId, setDeviceId] = useState("");
  const [devicePin, setDevicePin] = useState("");
  const [isRegistered, setIsRegistered] = useState(false);

  const [patientId, setPatientId] = useState("");

  const [session, setSession] = useState(null);

  const [heartRate, setHeartRate] = useState(null);
  const [lastReadingAt, setLastReadingAt] = useState(null);

  const [savedReadingCount, setSavedReadingCount] = useState(0);
  const [pendingReadingCount, setPendingReadingCount] = useState(0);

  const [sessionDuration, setSessionDuration] = useState(0);

  const [networkConnected, setNetworkConnected] = useState(false);
const [bluetoothConnected, setBluetoothConnected] = useState(true);
  const [databaseSummary, setDatabaseSummary] = useState({
    totalSessions: 0,
    totalReadings: 0,
    pendingSessions: 0,
    pendingReadings: 0,
  });

  // ----------------------------------------------
  // SYNCHRONIZATION LOCKS
  // ----------------------------------------------

  const sessionSyncInProgress = useRef(false);
  const readingSyncInProgress = useRef(false);

  // ----------------------------------------------
  // DATABASE SUMMARY
  // ----------------------------------------------

  const refreshDatabaseSummary = async () => {
    try {
      const summary = await getDatabaseSummary();

      setDatabaseSummary(summary);

      setPendingReadingCount(summary.pendingReadings);

      return summary;
    } catch (error) {
      console.log(
        "Database summary error:",
        getErrorMessage(error)
      );
    }
  };

  // ----------------------------------------------
  // INITIALIZE APP
  // ----------------------------------------------

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log("Initializing SKITII...");

        // Initialize SQLite.
        await initDatabase();

        // Restore device ID.
        const savedDeviceId = await SecureStore.getItemAsync(
          DEVICE_ID_KEY
        );

        // Restore device PIN.
        const savedDevicePin = await SecureStore.getItemAsync(
          DEVICE_PIN_KEY
        );

        if (savedDeviceId) {
          setDeviceId(savedDeviceId);
        }

        if (savedDevicePin && savedDeviceId) {
          setDevicePin(savedDevicePin);
          setIsRegistered(true);
        }

        // Restore patient ID.
        const savedPatientId = await AsyncStorage.getItem(
          "skitiiPatientId"
        );

        if (savedPatientId) {
          setPatientId(savedPatientId);
        }

        // Restore active session.
        const savedSession = await AsyncStorage.getItem(
          ACTIVE_SESSION_KEY
        );

        if (savedSession) {
          const parsedSession = JSON.parse(savedSession);

          if (parsedSession.localStatus === "active") {
            setSession(parsedSession);

            const readings = await getSessionReadings(
              parsedSession.sessionId
            );

            setSavedReadingCount(readings.length);

            if (readings.length > 0) {
              const latestReading = readings[readings.length - 1];

              setHeartRate(latestReading.heart_rate);
              setLastReadingAt(latestReading.recorded_at);
            }

            console.log(
              "Restored active session:",
              parsedSession.sessionId
            );
          }
        }

        await refreshDatabaseSummary();

        console.log("SKITII initialization completed.");
      } catch (error) {
        console.log(
          "App initialization error:",
          getErrorMessage(error)
        );

        Alert.alert(
          "Initialization error",
          getErrorMessage(error)
        );
      } finally {
        setInitializing(false);
      }
    };

    initializeApp();
  }, []);

  // ----------------------------------------------
  // REGISTER DEVICE
  // ----------------------------------------------

  const handleRegisterDevice = async () => {
    if (loading) return;

    setLoading(true);

    try {
      const newDeviceId =
        deviceId || Crypto.randomUUID();

      const newDevicePin =
        devicePin ||
        String(Math.floor(100000 + Math.random() * 900000));

      const deviceName =
        Device.deviceName || "SKITII Android Device";

      console.log("Registering device:", newDeviceId);

      // Register with backend.
      const response = await registerDevice(
        newDeviceId,
        deviceName
      );

      if (!response.success) {
        throw new Error(
          response.message || "Device registration failed"
        );
      }

      // Store device details securely.
      await SecureStore.setItemAsync(
        DEVICE_ID_KEY,
        newDeviceId
      );

      await SecureStore.setItemAsync(
        DEVICE_PIN_KEY,
        newDevicePin
      );

      setDeviceId(newDeviceId);
      setDevicePin(newDevicePin);
      setIsRegistered(true);

      Alert.alert(
        "Device registered",
        `Device ID:\n${newDeviceId}\n\nDevice PIN:\n${newDevicePin}`
      );

      console.log("Device registered successfully.");
    } catch (error) {
      console.log(
        "Device registration error:",
        getErrorMessage(error)
      );

      Alert.alert(
        "Registration failed",
        getErrorMessage(error)
      );
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------
  // SYNCHRONIZE PENDING SESSIONS
  // ----------------------------------------------

  const syncPendingSessions = async () => {
    if (sessionSyncInProgress.current) {
      return false;
    }

    sessionSyncInProgress.current = true;

    let allSessionsSynced = true;

    try {
      const network = await Network.getNetworkStateAsync();

      setNetworkConnected(
        Boolean(network.isConnected) &&
          network.isInternetReachable !== false
      );

      if (
        !network.isConnected ||
        network.isInternetReachable === false
      ) {
        console.log("Session sync postponed: No internet.");
        return false;
      }

      const pendingSessions = await getPendingSessions();

      if (pendingSessions.length === 0) {
        return true;
      }

      for (const localSession of pendingSessions) {
        try {
          console.log(
            "Syncing session:",
            localSession.session_id
          );

          // Create session on the server.
          await createSession(
            localSession.session_id,
            localSession.device_id,
            localSession.patient_id
          );

          // Complete session on server when completed locally.
          if (localSession.status === "completed") {
            await completeSession(localSession.session_id);
          }

          // Mark locally synced only after server acknowledgement.
          await markSessionSynced(
            localSession.session_id
          );

          console.log(
            "Session synchronized:",
            localSession.session_id
          );
        } catch (error) {
          allSessionsSynced = false;

          console.log(
            "Session sync postponed:",
            localSession.session_id,
            getErrorMessage(error)
          );
        }
      }

      await refreshDatabaseSummary();

      return allSessionsSynced;
    } catch (error) {
      console.log(
        "Session synchronization error:",
        getErrorMessage(error)
      );

      return false;
    } finally {
      sessionSyncInProgress.current = false;
    }
  };

  // ----------------------------------------------
  // SYNCHRONIZE PENDING READINGS
  // ----------------------------------------------


const syncPendingReadings = async () => {
  if (readingSyncInProgress.current) {
    console.log("Reading sync already running.");
    return;
  }

  readingSyncInProgress.current = true;

  try {
    console.log("Starting pending reading synchronization...");

    // Step 1: Check internet connectivity.
    const network = await Network.getNetworkStateAsync();

    const isOnline =
      network.isConnected &&
      network.isInternetReachable !== false;

    setNetworkConnected(Boolean(isOnline));

    if (!isOnline) {
      console.log("Offline. Readings remain pending.");
      return;
    }

    // Step 2: Synchronize sessions first.
    const sessionsSynced = await syncPendingSessions();

    if (!sessionsSynced) {
      console.log(
        "Reading upload postponed: session sync incomplete."
      );
      return;
    }

    // Step 3: Fetch pending readings from SQLite.
    const pendingReadings = await getPendingReadings(100);

    console.log(
      "Pending readings found:",
      pendingReadings.length
    );

    if (pendingReadings.length === 0) {
      await refreshDatabaseSummary();
      return;
    }

    // Step 4: Group readings by session.
    const groups = new Map();

    for (const reading of pendingReadings) {
      const key = [
        reading.session_id,
        reading.device_id,
        reading.patient_id,
      ].join("|");

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key).push(reading);
    }

    // Step 5: Upload each session's readings.
    for (const readings of groups.values()) {
      const first = readings[0];

      try {
        console.log(
          "Uploading",
          readings.length,
          "readings for session:",
          first.session_id
        );

        const response = await syncReadings({
          sessionId: first.session_id,
          deviceId: first.device_id,
          patientId: first.patient_id,
          readings,
        });

        if (!response.success) {
          throw new Error(
            "Backend did not confirm synchronization."
          );
        }

        // Step 6: Validate server acknowledgement.
        const requestedIds = new Set(
          readings.map((item) => item.reading_id)
        );

        const acknowledgedIds = [
          ...new Set(response.acknowledgedReadingIds || []),
        ].filter((id) => requestedIds.has(id));

        if (acknowledgedIds.length === 0) {
          throw new Error(
            "Backend acknowledged zero reading IDs."
          );
        }

        // Step 7: Mark only acknowledged records as synced.
        await markReadingsSynced(acknowledgedIds);

        console.log(
          "Successfully synchronized:",
          acknowledgedIds.length,
          "of",
          readings.length
        );
      } catch (error) {
        console.log(
          "Reading upload failed for session:",
          first.session_id,
          getErrorMessage(error)
        );

        // Do not mark failed readings as synced.
        // They will be retried during the next sync.
      }
    }

    // Step 8: Refresh pending count.
    const remaining = await getPendingReadingCount();

    setPendingReadingCount(remaining);

    await refreshDatabaseSummary();

    console.log(
      "Reading synchronization finished. Pending:",
      remaining
    );
  } catch (error) {
    console.log(
      "Reading synchronization error:",
      getErrorMessage(error)
    );
  } finally {
    readingSyncInProgress.current = false;
  }
};


  // ----------------------------------------------
  // AUTOMATIC SYNCHRONIZATION
  // ----------------------------------------------

  useEffect(() => {
    if (initializing) {
      return;
    }

    // First synchronization attempt.
    syncPendingReadings();

    // Retry every 15 seconds.
    const retryInterval = setInterval(() => {
      syncPendingReadings();
    }, SYNC_INTERVAL);

    return () => {
      clearInterval(retryInterval);
    };
  }, [initializing]);

  // ----------------------------------------------
  // START SESSION
  // ----------------------------------------------

  const handleStartSession = async () => {
    if (loading) return;

    if (!isRegistered || !deviceId) {
      Alert.alert(
        "Device not registered",
        "Please register this device first."
      );

      return;
    }

    const cleanedPatientId = patientId.trim();

    if (!cleanedPatientId) {
      Alert.alert(
        "Patient ID required",
        "Please enter a patient ID."
      );

      return;
    }

    if (session?.localStatus === "active") {
      Alert.alert(
        "Session already active",
        "Stop the current session before starting another."
      );

      return;
    }

    setLoading(true);

    try {
      const sessionId = Crypto.randomUUID();
      const startedAt = new Date().toISOString();

      const newSession = {
        sessionId,
        deviceId,
        patientId: cleanedPatientId,
        startedAt,
        endedAt: null,
        localStatus: "active",
      };

      // Save session locally FIRST.
      await saveSession({
        sessionId,
        deviceId,
        patientId: cleanedPatientId,
        status: "active",
        startedAt,
      });

      // Save patient ID.
      await AsyncStorage.setItem(
        "skitiiPatientId",
        cleanedPatientId
      );

      // Store active session.
      await AsyncStorage.setItem(
        ACTIVE_SESSION_KEY,
        JSON.stringify(newSession)
      );

      setPatientId(cleanedPatientId);
      setSession(newSession);

      setHeartRate(null);
      setLastReadingAt(null);
      setSavedReadingCount(0);
      setSessionDuration(0);

      console.log(
        "Session saved locally:",
        sessionId
      );

      // Attempt synchronization without blocking session start.
      syncPendingSessions();
    } catch (error) {
      console.log(
        "Start session error:",
        getErrorMessage(error)
      );

      Alert.alert(
        "Unable to start session",
        getErrorMessage(error)
      );
    } finally {
      setLoading(false);
      await refreshDatabaseSummary();
    }
  };

  // ----------------------------------------------
  // STOP SESSION
  // ----------------------------------------------

  const handleStopSession = async () => {
    if (loading) return;

    if (!session || session.localStatus !== "active") {
      return;
    }

    Alert.alert(
      "Stop monitoring?",
      "Are you sure you want to complete this session?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Stop session",
          style: "destructive",
          onPress: async () => {
            setLoading(true);

            try {
              const endedAt = new Date().toISOString();

              // Update SQLite FIRST.
              await updateLocalSessionStatus(
                session.sessionId,
                "completed",
                endedAt
              );

              const completedSession = {
                ...session,
                localStatus: "completed",
                endedAt,
              };

              // Remove active-session restoration entry.
              await AsyncStorage.removeItem(
                ACTIVE_SESSION_KEY
              );

              setSession(completedSession);

              console.log(
                "Session completed locally:",
                session.sessionId
              );

              // Try to synchronize with backend.
              syncPendingReadings();
            } catch (error) {
              console.log(
                "Stop session error:",
                getErrorMessage(error)
              );

              Alert.alert(
                "Unable to stop session",
                getErrorMessage(error)
              );
            } finally {
              setLoading(false);
              await refreshDatabaseSummary();
            }
          },
        },
      ]
    );
  };

  // ----------------------------------------------
  // GENERATE AND SAVE HEART-RATE READINGS
  // ----------------------------------------------
// Generate and save heart-rate readings every second
useEffect(() => {
 if (
  !session ||
  session.localStatus !== "active" ||
  !bluetoothConnected
) {
  return;
}

  const saveNewReading = async () => {
    try {
      const heartRateValue = generateHeartRate();

      if (
        typeof heartRateValue !== "number" ||
        !Number.isInteger(heartRateValue) ||
        heartRateValue < 60 ||
        heartRateValue > 100
      ) {
        console.log("Invalid heart rate:", heartRateValue);
        return;
      }

      const reading = {
        readingId: Crypto.randomUUID(),
        sessionId: session.sessionId,
        deviceId: session.deviceId,
        patientId: session.patientId,
        heartRate: heartRateValue,
        recordedAt: new Date().toISOString(),
      };

      await saveReading(reading);

      setHeartRate(heartRateValue);
      setLastReadingAt(reading.recordedAt);

      console.log("Reading saved locally:", heartRateValue, "BPM");
    } catch (error) {
      console.log("Reading save error:", error.message);
    }
  };

  saveNewReading();

  const readingInterval = setInterval(() => {
    saveNewReading();
  }, 1000);

  return () => {
    clearInterval(readingInterval);
  };
}, [session?.sessionId, session?.localStatus,bluetoothConnected]);

useEffect(() => {
  if (!bluetoothConnected) {
    console.log("Bluetooth disconnected.");
    console.log("New sensor readings paused.");
  } else {
    console.log("Bluetooth connected.");
    console.log("Sensor reading generation resumed.");
  }
}, [bluetoothConnected]);

  // ----------------------------------------------
  // SESSION TIMER
  // ----------------------------------------------

  useEffect(() => {
    if (!session || session.localStatus !== "active") {
      return;
    }

    const updateTimer = () => {
      const startTime = new Date(
        session.startedAt
      ).getTime();

      const currentTime = Date.now();

      const seconds = Math.max(
        0,
        Math.floor((currentTime - startTime) / 1000)
      );

      setSessionDuration(seconds);
    };

    updateTimer();

    const timerInterval = setInterval(
      updateTimer,
      1000
    );

    return () => {
      clearInterval(timerInterval);
    };
  }, [session?.sessionId, session?.localStatus]);

  // ----------------------------------------------
  // REFRESH LOCAL LOGS
  // ----------------------------------------------

  const handleViewLocalLogs = async () => {
    try {
      const sessions = await getDatabaseSummary();

      const readings = await getAllSavedReadings();

      console.log("SKITII DATABASE SUMMARY:");
      console.log(JSON.stringify(sessions, null, 2));

      console.log("SKITII SAVED READINGS:");
      console.log(JSON.stringify(readings, null, 2));

      Alert.alert(
        "Local database logs",
        `Sessions: ${sessions.totalSessions}\n` +
          `Readings: ${sessions.totalReadings}\n` +
          `Pending sessions: ${sessions.pendingSessions}\n` +
          `Pending readings: ${sessions.pendingReadings}\n\n` +
          "Full reading logs are available in the Expo terminal."
      );

      await refreshDatabaseSummary();
    } catch (error) {
      Alert.alert(
        "Database error",
        getErrorMessage(error)
      );
    }
  };

  // ----------------------------------------------
  // MANUAL SYNC
  // ----------------------------------------------

  const handleManualSync = async () => {
    await syncPendingReadings();

    await refreshDatabaseSummary();

    Alert.alert(
      "Synchronization",
      "Synchronization attempt completed. Check the Expo terminal for details."
    );
  };

  // ----------------------------------------------
  // LOADING SCREEN
  // ----------------------------------------------

  if (initializing) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#2563EB" />

        <Text style={styles.loadingText}>
          Initializing SKITII...
        </Text>
      </SafeAreaView>
    );
  }


  // Save Bluetooth disconnect/reconnect events locally
const handleBluetoothToggle = async () => {
  const nextStatus = !bluetoothConnected;

  setBluetoothConnected(nextStatus);

  if (session?.sessionId && session?.localStatus === "active") {
    try {
      const eventType = nextStatus
        ? "reconnected"
        : "disconnected";

      await saveBluetoothEvent(session.sessionId, eventType);

      console.log("Bluetooth event recorded:", eventType);
    } catch (error) {
      console.log("Bluetooth event save error:", error);
    }
  }
};

const showBluetoothHistory = async () => {
  if (!session?.sessionId) {
    console.log("No session available.");
    return;
  }

  try {
    const events = await getBluetoothEvents(session.sessionId);

    console.log(
      "Bluetooth Event History:",
      JSON.stringify(events, null, 2)
    );
  } catch (error) {
    console.log("Bluetooth history error:", error);
  }
};
  // ----------------------------------------------
  // MAIN USER INTERFACE
  // ----------------------------------------------

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
      >
        {/* HEADER */}

        <View style={styles.header}>
          <Text style={styles.appTitle}>SKITII</Text>

          <Text style={styles.subtitle}>
            Patient Vital Monitoring System
          </Text>
        </View>

        {/* DEVICE INFORMATION */}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Device Information
          </Text>

          <Text style={styles.infoText}>
            Device ID:
          </Text>

          <Text style={styles.valueText}>
            {deviceId || "Not registered"}
          </Text>

          <Text style={styles.infoText}>
            Device PIN:
          </Text>

          <Text style={styles.valueText}>
            {devicePin || "Not registered"}
          </Text>

          <View style={styles.statusRow}>
            <Text style={styles.infoText}>
              Registration:
            </Text>

            <Text
              style={[
                styles.statusText,
                isRegistered
                  ? styles.successText
                  : styles.errorText,
              ]}
            >
              {isRegistered ? "Registered" : "Not registered"}
            </Text>
          </View>

          {!isRegistered && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleRegisterDevice}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? "Registering..." : "Register Device"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* PATIENT INFORMATION */}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Patient Information
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Enter Patient ID"
            placeholderTextColor="#888"
            value={patientId}
            onChangeText={setPatientId}
            editable={
              !session || session.localStatus !== "active"
            }
            autoCapitalize="characters"
          />
        </View>

        {/* SESSION CONTROLS */}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Monitoring Session
          </Text>

          <View style={styles.statusRow}>
            <Text style={styles.infoText}>
              Session status:
            </Text>

            <Text
              style={[
                styles.statusText,
                session?.localStatus === "active"
                  ? styles.successText
                  : styles.errorText,
              ]}
            >
              {session?.localStatus
                ? session.localStatus.toUpperCase()
                : "NOT STARTED"}
            </Text>
          </View>

          {session && (
            <>
              <Text style={styles.infoText}>
                Session ID:
              </Text>

              <Text style={styles.valueText}>
                {session.sessionId}
              </Text>

              <Text style={styles.infoText}>
                Started:
              </Text>

              <Text style={styles.valueText}>
                {new Date(
                  session.startedAt
                ).toLocaleString()}
              </Text>
            </>
          )}

          {session?.localStatus === "active" ? (
            <>
              <Text style={styles.timer}>
                {formatDuration(sessionDuration)}
              </Text>

              <TouchableOpacity
                style={styles.stopButton}
                onPress={handleStopSession}
                disabled={loading}
              >
                <Text style={styles.buttonText}>
                  {loading ? "Stopping..." : "Stop Monitoring"}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleStartSession}
              disabled={!isRegistered || loading}
            >
              <Text style={styles.buttonText}>
                {loading ? "Please wait..." : "Start Monitoring"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* HEART RATE */}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Heart Rate Monitoring
          </Text>

          <Text style={styles.heartRate}>
            {session?.localStatus === "active"
              ? heartRate ?? "--"
              : "--"}
          </Text>

          <Text style={styles.bpm}>
            BPM
          </Text>

          <Text style={styles.infoText}>
            Simulated heart-rate reading
          </Text>

          <Text style={styles.infoText}>
            Last reading:
          </Text>

          <Text style={styles.valueText}>
            {lastReadingAt
              ? new Date(lastReadingAt).toLocaleTimeString()
              : "No readings yet"}
          </Text>

          <Text style={styles.infoText}>
            Readings saved in this session:
          </Text>

          <Text style={styles.valueText}>
            {savedReadingCount}
          </Text>
        </View>

        {/* NETWORK STATUS */}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Network Status
          </Text>

          <View style={styles.statusRow}>
            <Text style={styles.infoText}>
              Internet:
            </Text>

            <Text
              style={[
                styles.statusText,
                networkConnected
                  ? styles.successText
                  : styles.errorText,
              ]}
            >
              {networkConnected ? "CONNECTED" : "OFFLINE"}
            </Text>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.infoText}>
              Pending readings:
            </Text>

            <Text style={styles.valueText}>
              {pendingReadingCount}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleManualSync}
          >
            <Text style={styles.buttonText}>
              Sync Now
            </Text>
          </TouchableOpacity>
        </View>

        {/* DATABASE SUMMARY */}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Local SQLite Database
          </Text>

          <View style={styles.summaryRow}>
            <Text style={styles.infoText}>
              Total sessions
            </Text>

            <Text style={styles.summaryValue}>
              {databaseSummary.totalSessions}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.infoText}>
              Total readings
            </Text>

            <Text style={styles.summaryValue}>
              {databaseSummary.totalReadings}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.infoText}>
              Pending sessions
            </Text>

            <Text style={styles.summaryValue}>
              {databaseSummary.pendingSessions}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.infoText}>
              Pending readings
            </Text>

            <Text style={styles.summaryValue}>
              {databaseSummary.pendingReadings}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleViewLocalLogs}
          >
            <Text style={styles.secondaryButtonText}>
              View Local Database Logs
            </Text>
          </TouchableOpacity>
        </View>

<View style={styles.bluetoothCard}>
  <Text style={styles.bluetoothHeading}>
    Bluetooth Status
  </Text>

  <Text
    style={[
      styles.bluetoothStatus,
      {
        color: bluetoothConnected ? "#16A34A" : "#DC2626",
      },
    ]}
  >
    {getBluetoothStatusText(bluetoothConnected)}
  </Text>

  <TouchableOpacity
    style={styles.bluetoothButton}
    onPress={handleBluetoothToggle}
  >
    <Text style={styles.bluetoothButtonText}>
      {bluetoothConnected
        ? "Simulate Bluetooth Disconnect"
        : "Simulate Bluetooth Reconnect"}
    </Text>
  </TouchableOpacity>

  <TouchableOpacity
    style={styles.bluetoothHistoryButton}
    onPress={showBluetoothHistory}
  >
    <Text style={styles.bluetoothHistoryButtonText}>
      View Bluetooth History
    </Text>
  </TouchableOpacity>
</View>

        {/* FOOTER */}

        <Text style={styles.footer}>
          SKITII Patient Monitoring System
        </Text>

        <Text style={styles.footerSmall}>
          Development build - simulated heart-rate data
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// --------------------------------------------------
// STYLES
// --------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F1F5F9",
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  loadingScreen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#334155",
  },

  header: {
    alignItems: "center",
    marginBottom: 20,
    paddingTop: 10,
  },

  appTitle: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#1D4ED8",
  },

  subtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 4,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    elevation: 2,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 16,
  },

  infoText: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 8,
  },

  valueText: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "600",
    marginTop: 3,
  },

  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },

  statusText: {
    fontSize: 13,
    fontWeight: "bold",
  },

  successText: {
    color: "#16A34A",
  },

  errorText: {
    color: "#DC2626",
  },

  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 13,
    fontSize: 16,
    color: "#0F172A",
    marginTop: 4,
  },

  primaryButton: {
    backgroundColor: "#2563EB",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 18,
  },

  stopButton: {
    backgroundColor: "#DC2626",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 18,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "bold",
  },

  timer: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    color: "#2563EB",
    marginTop: 20,
  },

  heartRate: {
    fontSize: 64,
    fontWeight: "bold",
    color: "#DC2626",
    textAlign: "center",
    marginTop: 10,
  },

  bpm: {
    textAlign: "center",
    color: "#64748B",
    fontSize: 18,
    fontWeight: "bold",
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },

  summaryValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0F172A",
  },

  secondaryButton: {
    borderWidth: 1,
    borderColor: "#2563EB",
    padding: 13,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 18,
  },

  secondaryButtonText: {
    color: "#2563EB",
    fontWeight: "bold",
    fontSize: 14,
  },

  footer: {
    textAlign: "center",
    color: "#64748B",
    fontSize: 13,
    marginTop: 10,
  },

  footerSmall: {
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 11,
    marginTop: 5,
  },

bluetoothCard: {
  backgroundColor: "#FFFFFF",
  padding: 20,
  marginVertical: 10,
  marginHorizontal: 15,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: "#E5E7EB",
  elevation: 3,
  shadowColor: "#000",
  shadowOffset: {
    width: 0,
    height: 2,
  },
  shadowOpacity: 0.08,
  shadowRadius: 4,
},

bluetoothHeading: {
  fontSize: 18,
  fontWeight: "bold",
  color: "#1F2937",
  marginBottom: 12,
},

bluetoothStatus: {
  fontSize: 16,
  fontWeight: "600",
  color: "#16A34A",
  marginBottom: 15,
},

bluetoothButton: {
  backgroundColor: "#2563EB",
  paddingVertical: 13,
  paddingHorizontal: 15,
  borderRadius: 10,
  alignItems: "center",
  marginBottom: 10,
},

bluetoothButtonText: {
  color: "#FFFFFF",
  fontSize: 14,
  fontWeight: "bold",
},

bluetoothHistoryButton: {
  backgroundColor: "#475569",
  paddingVertical: 13,
  borderRadius: 10,
  alignItems: "center",
},

bluetoothHistoryButtonText: {
  color: "#FFFFFF",
  fontSize: 14,
  fontWeight: "bold",
},

});
