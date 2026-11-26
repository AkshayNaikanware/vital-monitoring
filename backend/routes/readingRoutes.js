
const express = require("express");

const router = express.Router();

const {
  syncReadings
} = require("../controllers/readingController");

const validateReadings = require("../middleware/validateReadings");

// Synchronize a batch of readings
router.post("/sync", validateReadings, syncReadings);

module.exports = router;
