
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const connectDB = require("./config/db");
const deviceRoutes = require('./routes/deviceRoutes');
const sessionRoutes = require("./routes/sessionRoutes");
const readingRoutes = require("./routes/readingRoutes");
const bluetoothEventRoutes = require("./routes/bluetoothEventRoutes");
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "SKITII Backend is Running",
    database: "Connected"
  });
});

// Device routes
app.use("/api/devices", deviceRoutes);
app.use("/api/sessions", sessionRoutes);
// Reading routes
app.use("/api/readings", readingRoutes);
app.use("/api/bluetooth-events", bluetoothEventRoutes);

// Start server
const startServer = async () => {
  try {
    await connectDB();

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed");
    process.exit(1);
  }
};

startServer();
