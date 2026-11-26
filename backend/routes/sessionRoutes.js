const express = require("express");

const router = express.Router();

const {
  createSession,
  getSessionHistory,
  completeSession
} = require("../controllers/sessionController");

router.get("/history", getSessionHistory);

router.patch("/:sessionId/complete", completeSession);

router.post("/", createSession);

module.exports = router;