
const express = require("express");

const router = express.Router();

const {
  registerDevice
} = require("../controllers/deviceController");

const validateDevice = require('../middleware/validateDevice');


// Register a device
router.post("/register", validateDevice, registerDevice);

module.exports = router;
