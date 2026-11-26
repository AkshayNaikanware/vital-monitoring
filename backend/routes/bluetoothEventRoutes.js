
const express = require("express");

const router = express.Router();

const {
  syncBluetoothEvents,
} = require("../controllers/bluetoothEventController");

router.post("/sync", syncBluetoothEvents);

module.exports = router;
