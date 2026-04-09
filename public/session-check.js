1/* =========================
   REALTIME SESSION CHECK
========================= */
app.get("/api/check-session", (req, res) => {
  const userId = req.session && req.session.userId ? req.session.userId : null;

  if (!userId) {
    return res.json({
      valid: false,
      reason: "logged_out"
    });
  }

  const users = getUsers();
  const user = users.find((u) => u.id === userId);

  if (!user) {
    return res.json({
      valid: false,
      reason: "deleted"
    });
  }

  if (user.status === "banned") {
    return res.json({
      valid: false,
      reason: "banned"
    });
  }

  if (user.status === "pending") {
    return res.json({
      valid: false,
      reason: "pending"
    });
  }

  if (user.status !== "active") {
    return res.json({
      valid: false,
      reason: "inactive"
    });
  }

  if (!user.activeSessionId) {
    return res.json({
      valid: false,
      reason: "kicked"
    });
  }

  if (user.activeSessionId !== req.sessionID) {
    return res.json({
      valid: false,
      reason: "kicked"
    });
  }

  return res.json({
    valid: true,
    username: user.username,
    role: user.role,
    status: user.status,
    sessionId: req.sessionID
  });
});
