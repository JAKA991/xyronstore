(function () {
  let handled = false;

  function forceOut(reason) {
    if (handled) return;
    handled = true;

    const messages = {
      kicked: "Sesi kamu telah di-kick oleh owner.",
      banned: "Akun kamu telah dibanned oleh owner.",
      pending: "Akun kamu sedang diubah ke status pending.",
      deleted: "Akun kamu telah dihapus.",
      inactive: "Akun kamu sudah tidak aktif.",
      logged_out: "Sesi login kamu sudah berakhir."
    };

    const message = messages[reason] || "Sesi kamu sudah tidak valid.";

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div style="position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(5,2,14,.82);backdrop-filter:blur(14px)">
        <div style="width:100%;max-width:420px;padding:30px 24px 22px;border-radius:30px;text-align:center;color:#fff;background:linear-gradient(180deg, rgba(60, 12, 98, 0.97), rgba(20, 4, 34, 0.98));border:1px solid rgba(255,255,255,.14);box-shadow:0 24px 80px rgba(0,0,0,.45)">
          <div style="font-size:42px;margin-bottom:10px">⚠️</div>
          <div style="font-size:12px;letter-spacing:2px;font-weight:800;color:#ff6df6;margin-bottom:10px">XYRON SECURITY</div>
          <h2 style="margin:0 0 10px;font-size:30px;color:#fff">Akses Dihentikan</h2>
          <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#f2ebff">${message}</p>
          <button id="xyron-popup-btn" style="width:100%;padding:14px 16px;border:none;border-radius:18px;cursor:pointer;color:#fff;font-size:16px;font-weight:800;background:linear-gradient(90deg,#9d58f6,#ff3fd3)">Kembali ke Login</button>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);

    const btn = document.getElementById("xyron-popup-btn");
    if (btn) {
      btn.addEventListener("click", function () {
        window.location.href = "/JakSkyLogin";
      });
    }

    setTimeout(function () {
      window.location.href = "/JakSkyLogin";
    }, 1200);
  }

  async function checkSessionFallback() {
    if (handled) return;

    try {
      const res = await fetch("/api/check-session", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json"
        }
      });

      if (!res.ok) return;

      const data = await res.json();

      if (!data.valid) {
        if (data.reason === "logged_out") return;
        forceOut(data.reason);
      }
    } catch (err) {
      console.log("check-session gagal");
    }
  }

  if (typeof io !== "undefined") {
    const socket = io({
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000
    });

    socket.on("connect", function () {
      console.log("socket connect:", socket.id);
    });

    socket.on("force-logout", function (data) {
      forceOut(data && data.reason ? data.reason : "logged_out");
    });

    socket.on("disconnect", function () {
      console.log("socket disconnect");
    });
  }

  checkSessionFallback();
  setInterval(checkSessionFallback, 1000);

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      checkSessionFallback();
    }
  });
})();
