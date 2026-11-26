# SKITII – Offline-First Patient Vital Monitoring System

## 1. Project Overview

SKITII is an offline-first patient vital monitoring application designed to record, store, and synchronize patient heart-rate readings.

The application uses a React Native mobile app, Node.js backend, MongoDB database, and SQLite local database.

The system is designed to continue collecting readings when internet connectivity is unavailable. Locally stored data can be synchronized with the backend when connectivity returns.

The project also includes simulated Bluetooth connectivity, session management, and synchronization status tracking.

## 2. Project Objectives

- Register monitoring devices.
- Associate monitoring sessions with patient IDs.
- Generate simulated heart-rate readings between 60 and 100 BPM.
- Store readings locally using SQLite.
- Support offline monitoring.
- Preserve locally stored readings when the application is restarted.
- Synchronize pending sessions and readings with the backend.
- Prevent duplicate readings during synchronization.
- Track Bluetooth disconnect and reconnect events.
- Store monitoring session history.
- Provide backend APIs for device, session, and reading management.

## 3. Technology Stack

| Component | Technology |
|---|---|
| Mobile application | React Native |
| Mobile development | Expo |
| Backend | Node.js |
| API framework | Express.js |
| Main database | MongoDB |
| Database ODM | Mongoose |
| Local database | SQLite |
| Local database library | expo-sqlite |
| Device information | expo-device |
| Network status | expo-network |
| Local credentials | expo-secure-store |
| Local session storage | AsyncStorage |
| API testing | Postman |
| Database inspection | MongoDB Compass |
| Development environment | Visual Studio Code |
| Version control | Git |

## 4. System Architecture

```text
              ANDROID MOBILE APP
              React Native / Expo
                      |
          +-----------+-----------+
          |                       |
      SQLite DB               App Services
          |                       |
   Local Sessions           Device Registration
   Heart Rate Readings      Session Management
   Bluetooth Events         Heart Rate Simulation
          |                       |
          +-----------+-----------+
                      |
                Internet / Wi-Fi
                      |
                NODE.JS BACKEND
                   Express
                      |
              REST API Endpoints
                      |
                  MONGODB
          +-----------+-----------+
          |           |           |
        Devices     Sessions    Readings
                                  |
                            Bluetooth Events
```

## 5. Implemented Features

### 5.1 Backend Setup

- Created the Node.js and Express backend.
- Configured MongoDB connection using Mongoose.
- Configured environment variables.
- Added middleware such as Helmet, CORS, JSON parsing, and Morgan.
- Created a health-check endpoint.

### 5.2 MongoDB Models

The following models were implemented:

**Device**
- Device ID
- Device name
- Device status
- Registration date

**Session**
- Session ID
- Device ID
- Patient ID
- Session status
- Start time
- End time
- Last synchronization time

**Reading**
- Reading ID
- Session ID
- Device ID
- Patient ID
- Heart rate
- Recorded timestamp

**BluetoothEvent**
- Event ID
- Session ID
- Device ID
- Patient ID
- Event type
- Event timestamp

Note: BluetoothEvent model and synchronization implementation were prepared in Step 21; backend integration and testing still require verification.

### 5.3 Device Registration

- Generated a unique device identifier.
- Implemented device registration API.
- Stored the device PIN locally using SecureStore.
- Added handling for existing and revoked devices.

### 5.4 Session Management

- Implemented session creation.
- Generated unique session IDs.
- Associated sessions with device IDs and patient IDs.
- Implemented session completion.
- Stored session information locally in SQLite.
- Implemented pending session synchronization.

### 5.5 Heart Rate Monitoring

- Implemented simulated heart-rate generation.
- Generated readings between 60 and 100 BPM.
- Generated readings approximately once per second while monitoring is active.
- Displayed the current heart rate.
- Stored readings locally in SQLite.

### 5.6 Offline Data Storage

SQLite is used to store monitoring information locally.

Implemented functionality includes:

- Save sessions.
- Save heart-rate readings.
- Retrieve readings by session.
- Retrieve pending readings.
- Mark readings as synchronized.
- Count pending readings.
- Retrieve local session history.
- Generate database summaries.

The database uses indexes and foreign-key relationships to organize local data.

### 5.7 Offline Session Synchronization

- Pending sessions are retrieved from SQLite.
- The mobile application checks network availability.
- Sessions are sent to the backend when connectivity is available.
- Sessions are marked synchronized after successful backend acknowledgement.
- Synchronization is retried periodically.

### 5.8 Heart Rate Synchronization

- Pending readings are retrieved from SQLite.
- Readings are uploaded to the backend in batches.
- Backend acknowledgement is checked.
- Acknowledged reading IDs are marked synchronized locally.
- Duplicate reading IDs are handled by the backend.
- Synchronization logs are displayed in the Expo terminal.

### 5.9 Bluetooth Monitoring

A simulated Bluetooth status interface was implemented.

Features prepared:
- Simulate Bluetooth disconnection.
- Simulate Bluetooth reconnection.
- Display Bluetooth status.
- Stop simulated heart-rate generation during disconnection.
- Resume simulated readings after reconnection.
- Save Bluetooth events in SQLite.
- Retrieve Bluetooth event history.

Bluetooth event synchronization to MongoDB is planned and its implementation is not yet verified.

## 6. Backend API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check backend status |
| POST | `/api/devices/register` | Register device |
| POST | `/api/sessions` | Create session |
| PATCH | `/api/sessions/:sessionId/complete` | Complete session |
| GET | `/api/sessions/history` | Retrieve session history |
| POST | `/api/readings/sync` | Synchronize readings |
| POST | `/api/bluetooth-events/sync` | Planned Bluetooth event synchronization; verify implementation |

## 7. Database Structure

### MongoDB Collections

**devices**
- Stores registered device information.

**sessions**
- Stores patient monitoring sessions.

**readings**
- Stores heart-rate readings received from mobile devices.

**bluetooth_events**
- Intended to store Bluetooth disconnect and reconnect history.

### SQLite Tables

**sessions**
- Stores locally created sessions.
- Tracks session status and synchronization status.

**readings**
- Stores locally generated heart-rate readings.
- Tracks pending and synchronized readings.

**bluetooth_events**
- Stores local Bluetooth events.
- Includes synchronization status and synchronization timestamp after the Step 21 migration.

## 8. Offline Synchronization Workflow

1. The user starts a monitoring session.
2. The application stores the session locally.
3. Simulated heart-rate readings are generated.
4. Each reading is stored in SQLite.
5. If the internet is unavailable, readings remain pending.
6. When internet connectivity returns, the application retrieves pending records.
7. Records are sent to the backend.
8. The backend validates and saves the records.
9. The backend returns acknowledged reading IDs.
10. The mobile application marks acknowledged readings as synchronized.

This approach helps preserve locally collected data during temporary network interruptions.

## 9. Testing Performed and Observed Results

### Backend and Database

- MongoDB model tests were reported as passed.
- Device registration and session APIs were implemented.
- Reading synchronization was exercised.
- Duplicate reading handling was implemented.

### Mobile Application

The following successful logs were observed during development:

```text
SQLite database initialized.

Session synchronized.

Reading saved locally: 96 BPM

Pending readings found: 16

Uploading 16 readings for session: ...

Backend acknowledged readings: 16

Successfully synchronized: 16 of 16

SKITII Database Summary:
{
  "pendingReadings": 1,
  "pendingSessions": 0,
  "totalReadings": 1360,
  "totalSessions": 16
}
```

The database summary subsequently worked successfully after fixing a database summary error.

A later observed summary showed:

```text
{
  "pendingReadings": 0,
  "pendingSessions": 0,
  "totalBluetoothEvents": 0,
  "totalReadings": 1479,
  "totalSessions": 16
}
```

These are development-time observations, not a complete formal test report.

### Testing Still Required

- Verify application restart while a session is active.
- Verify readings continue to be preserved while offline.
- Verify pending readings synchronize after internet returns.
- Verify Bluetooth disconnect/reconnect events are saved correctly.
- Verify Bluetooth event synchronization with MongoDB.
- Verify duplicate Bluetooth event handling.
- Verify behavior with multiple devices.

## 10. Known Limitations

1. Heart-rate values are simulated and are not obtained from a medical sensor.
2. Bluetooth connectivity is simulated; physical Bluetooth hardware integration is not completed.
3. Bluetooth event synchronization with the backend requires integration and testing.
4. A complete React web dashboard is not yet verified as implemented.
5. Production-grade authentication and authorization require further development.
6. Remote device logout and offline credential revocation require further implementation and testing.
7. The application requires additional testing with multiple physical devices and network conditions.

## 11. Project Setup Instructions

### Backend Setup

Open a terminal:

```powershell
cd backend
npm install
```

Create a `.env` file:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/skitii
NODE_ENV=development
```

Start the backend:

```powershell
npm run dev
```

Backend address:

```text
http://localhost:5000
```

Health check:

```text
http://localhost:5000/api/health
```

### Mobile Setup

Open another terminal:

```powershell
cd mobile
npm install
```

Install the required Expo packages if they are not already installed:

```powershell
npx expo install expo-sqlite expo-network expo-device expo-crypto expo-secure-store @react-native-async-storage/async-storage
```

Update the API base URL in `mobile/services/api.js` to use the computer's local network IP address:

```javascript
const API_BASE_URL = "http://YOUR_COMPUTER_IP:5000/api";
```

The Android phone and development computer should be connected to the same Wi-Fi network.

Start Expo:

```powershell
npx expo start -c
```

Scan the QR code using Expo Go.

## 12. Project Directory Structure

```text
SKITII/
|
|-- backend/
|   |-- config/
|   |   |-- db.js
|   |
|   |-- controllers/
|   |   |-- deviceController.js
|   |   |-- sessionController.js
|   |   |-- readingController.js
|   |   |-- bluetoothEventController.js
|   |
|   |-- middleware/
|   |
|   |-- models/
|   |   |-- Device.js
|   |   |-- Session.js
|   |   |-- Reading.js
|   |   |-- BluetoothEvent.js
|   |
|   |-- routes/
|   |   |-- deviceRoutes.js
|   |   |-- sessionRoutes.js
|   |   |-- readingRoutes.js
|   |   |-- bluetoothEventRoutes.js
|   |
|   |-- .env
|   |-- server.js
|   |-- package.json
|
|-- mobile/
|   |-- src/
|   |   |-- database/
|   |   |   |-- database.js
|   |   |
|   |   |-- utils/
|   |       |-- heartRate.js
|   |       |-- bluetooth.js
|   |
|   |-- services/
|   |   |-- api.js
|   |
|   |-- App.js
|   |-- package.json
|
|-- README.md
```

The directory tree describes the intended project organization. Adjust filenames if your actual project differs.

## 13. Security Considerations

- Device credentials are stored locally using SecureStore.
- Device registration is validated by the backend.
- Revoked devices are rejected by the registration and synchronization workflows.
- Backend APIs validate incoming data.
- Unique IDs are used to avoid duplicate records.
- Production authentication, encrypted transport, access control, and secure credential lifecycle management require additional implementation.

## 14. AI Usage Disclosure

AI assistance was used during development for:

- Understanding project requirements.
- Designing MongoDB models and SQLite tables.
- Writing and explaining backend APIs.
- Developing React Native application code.
- Implementing offline storage and synchronization workflows.
- Debugging runtime and database errors.
- Preparing API testing instructions.
- Preparing project documentation.

All generated code and suggestions should be reviewed and tested as part of the final submission.

## 15. Current Project Status

| Module | Status |
|---|---|
| Backend initial setup | Implemented |
| MongoDB models | Implemented; model tests reported passed |
| Device registration API | Implemented |
| Session API | Implemented |
| Reading synchronization API | Implemented and exercised |
| Session history API | Implemented |
| Expo mobile setup | Implemented |
| Device registration in mobile | Implemented |
| Session management in mobile | Implemented |
| Simulated heart-rate generation | Implemented |
| SQLite local storage | Implemented |
| Session synchronization | Successful logs observed |
| Reading synchronization | Successful logs observed |
| Bluetooth simulation | Implemented |
| Bluetooth local event logging | Requires final verification |
| Bluetooth backend synchronization | Pending integration verification |
| Web dashboard | Pending |
| Physical Bluetooth integration | Pending |
| Production authentication | Pending |
| Complete end-to-end assessment testing | Pending |

## 16. Conclusion

SKITII establishes the foundation of an offline-first patient vital monitoring system.

The backend supports device registration, session management, reading synchronization, and session history. The mobile application supports simulated heart-rate monitoring, local SQLite storage, and synchronization of sessions and readings.

The system is designed to preserve monitoring data during internet interruptions and synchronize pending information when connectivity returns.

Further work is required to complete Bluetooth event synchronization, physical Bluetooth integration, dashboard development, production security, and comprehensive end-to-end testing.

**Project:** SKITII – Offline-First Patient Vital Monitoring System

**Documentation status:** Development progress and remaining work as of 26 November 2026.
