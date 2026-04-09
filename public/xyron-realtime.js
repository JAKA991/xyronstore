(function () {
  let handled = false;
  let checkTimer = null;
  let refreshTimer = null;
  let socket = null;

  function getReasonData(reason) {
    switch (reason) {
      case "kicked":
        return {
          icon: "⚠️",
          badge: "SESSION REMOVED",
          title: "Sesi Dihentikan",
          text: "Kamu telah di-kick oleh owner."
        };
      case "banned":
        return {
          icon: "⛔",
          badge: "ACCOUNT BLOCKED",
          title: "Akun Dibanned",
          text: "Akun kamu telah dibanned oleh owner."
        };
      case "pending":
        return {
          icon: "⏳",
          badge: "ACCESS PAUSED",
          title: "Akun Pending",
          text: "Akun kamu sedang pending."
        };
      case "deleted":
        return {
          icon: "🗑️",
          badge: "ACCOUNT REMOVED",
          title: "Akun Dihapus",
          text: "Akun kamu telah dihapus oleh owner."
        };
      case "inactive":
        return {
          icon: "🔒",
          badge: "ACCOUNT INACTIVE",
          title: "Akun Tidak Aktif",
          text: "Akun kamu sudah tidak aktif."
        };
      case "logged_out":
        return {
          icon: "🔐",
          badge: "SESSION ENDED",
          title: "Logout",
          text: "Sesi login kamu sudah berakhir."
        };
      default:
        return {
          icon: "❗",
          badge: "SESSION INVALID",
          title: "Akses Dihentikan",
          text: "Sesi kamu sudah tidak valid."
        };
    }
  }

  function injectStyles() {
    if (document.getElementById("xyron-realtime-style")) return;

    const style = document.createElement("style");
    style.id = "xyron-realtime-style";
    style.innerHTML = `
      .xyron-popup-overlay {
        position: fixed;
        inset: 0;
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 22px;
        background:
          radial-gradient(circle at top left, rgba(255, 70, 220, 0.16), transparent 28%),
          radial-gradient(circle at bottom right, rgba(150, 90, 255, 0.14), transparent 32%),
          rgba(7, 4, 16, 0.78);
        backdrop-filter: blur(14px);
      }

      .xyron-popup-box {
        width: 100%;
        max-width: 430px;
        border-radius: 30px;
        padding: 28px 22px 22px;
        color: #fff;
        text-align: center;
        background: linear-gradient(180deg, rgba(58, 15, 92, 0.96), rgba(21, 5, 37, 0.97));
        border: 1px solid rgba(255,255,255,0.12);
        box-shadow: 0 24px 80px rgba(0,0,0,0.42);
      }

      .xyron-popup-icon {
        width: 78px;
        height: 78px;
        margin: 0 auto 14px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 36px;
        background: linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04));
        border: 1px solid rgba(255,255,255,0.14);
      }

      .xyron-popup-badge {
        display: inline-block;
        margin-bottom: 10px;
        padding: 8px 14px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 1.8px;
        color: #ffd7fb;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.10);
      }

      .xyron-popup-title {
        margin: 0 0 10px;
        font-size: 30px;
        font-weight: 800;
        color: #ffffff;
      }

      .xyron-popup-text {
        margin: 0 0 18px;
        font-size: 16px;
        line-height: 1.7;
        color: #efe8ff;
      }

      .xyron-popup-count {
        margin-bottom: 14px;
        font-size: 14px;
        color: #d8c9f2;
      }

      .xyron-popup-count span {
        color: #ff5be0;
        font-weight: 800;
      }

      .xyron-popup-progress {
        width: 100%;
        height: 10px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(255,255,255,0.07);
        border: 1px solid rgba(255,255,255,0.07);
        margin-bottom: 18px;
      }

      .xyron-popup-progress-bar {
        width: 100%;
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, #9d58f6, #ff39cf);
        transition: width 1s linear;
      }

      .xyron-popup-btn {
        width: 100%;
        border: none;
        border-radius: 18px;
        padding: 14px 16px;
        cursor: pointer;
        color: #fff;
        font-size: 16px;
        font-weight: 800;
        background: linear-gradient(90deg, #9d58f6, #ff39cf);
      }
    `;

    document.head.appendChild(style);
  }

  function forceOut(reason) {
    if (handled) return;
    handled = true;

    if (checkTimer) clearInterval(checkTimer);
    if (refreshTimer) clearInterval(refreshTimer);

    injectStyles();

    const data = getReasonData(reason);
    const old = document.getElementById("xyron-premium-popup");
    if (old) old.remove();

    const popup = document.createElement("div");
    popup.id = "xyron-premium-popup";
    popup.className = "xyron-popup-overlay";
    popup.innerHTML = `
      <div class="xyron-popup-box">
        <div class="xyron-popup-icon">${data.icon}</div>
        <div class="xyron-popup-badge">${data.badge}</div>
        <h2 class="xyron-popup-title">${data.title}</h2>
        <p class="xyron-popup-text">${data.text}</p>

        <div class="xyron-popup-count">
          Dialihkan ke login dalam <span id="xyron-countdown-value">3</span> detik...
        </div>

        <div class="xyron-popup-progress">
          <div class="xyron-popup-progress-bar" id="xyron-progress-bar"></div>
        </div>

        <button class="xyron-popup-btn" id="xyron-popup-btn">
          Kembali ke Login
        </button>
      </div>
    `;

    document.body.appendChild(popup);

    const button = document.getElementById("xyron-popup-btn");
    const countdownText = document.getElementById("xyron-countdown-value");
    const progressBar = document.getElementById("xyron-progress-bar");

    if (button) {
      button.addEventListener("click", function () {
        window.location.href = "/JakSkyLogin";
      });
    }

    let seconds = 3;
    let width = 100;

    const timer = setInterval(function () {
      seconds -= 1;
      width -= 33.33;

      if (countdownText) countdownText.textContent = String(Math.max(seconds, 0));
      if (progressBar) progressBar.style.width = Math.max(width, 0) + "%";

      if (seconds <= 0) {
        clearInterval(timer);
        window.location.href = "/JakSkyLogin";
      }
    }, 1000);
  }

  async function checkSession() {
    if (handled) return;

    try {
      const res = await fetch("/api/check-session", {
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json"
        }
      });

      if (!res.ok) return;

      const data = await res.json();

      if (!data.valid) {
        forceOut(data.reason || "logged_out");
      }
    } catch (e) {
      console.log("check-session gagal");
    }
  }

  async function refreshUsersPanel() {
    const usersGrid = document.getElementById("usersGrid");
    if (!usersGrid || handled) return;

    try {
      const res = await fetch("/api/users", {
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          Accept: "application/json"
        }
      });

      if (!res.ok) return;

      const data = await res.json();
      if (!data.success) return;

      location.reload();
    } catch (e) {
      console.log("refresh users gagal");
    }
  }

  if (typeof io !== "undefined") {
    socket = io({
      transports: ["websocket", "polling"],
      reconnection: true,
      forceNew: true
    });

    socket.on("connect", function () {
      console.log("CONNECTED:", socket.id);
    });

    socket.on("force-logout", function (data) {
      forceOut(data && data.reason ? data.reason : "logged_out");
    });

    socket.on("users-updated", function () {
      if (document.getElementById("usersGrid")) {
        location.reload();
      }
    });
  }

  checkTimer = setInterval(checkSession, 1000);
  checkSession();

  if (document.getElementById("usersGrid")) {
    refreshTimer = setInterval(refreshUsersPanel, 3000);
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      checkSession();
    }
  });
})();
