(function () {
  function injectConfirmStyles() {
    if (document.getElementById("xyron-confirm-style")) return;

    const style = document.createElement("style");
    style.id = "xyron-confirm-style";
    style.innerHTML = `
      .xyron-confirm-overlay {
        position: fixed;
        inset: 0;
        z-index: 999998;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background:
          radial-gradient(circle at top left, rgba(255, 70, 220, 0.15), transparent 28%),
          radial-gradient(circle at bottom right, rgba(150, 90, 255, 0.13), transparent 32%),
          rgba(7, 4, 16, 0.74);
        backdrop-filter: blur(12px);
      }

      .xyron-confirm-box {
        width: 100%;
        max-width: 410px;
        border-radius: 28px;
        padding: 26px 20px 20px;
        color: #fff;
        text-align: center;
        background:
          linear-gradient(180deg, rgba(58, 15, 92, 0.96), rgba(21, 5, 37, 0.97));
        border: 1px solid rgba(255,255,255,0.12);
        box-shadow:
          0 24px 80px rgba(0,0,0,0.42),
          0 0 30px rgba(255, 60, 210, 0.10);
        animation: xyronConfirmPop .25s ease;
      }

      .xyron-confirm-icon {
        width: 74px;
        height: 74px;
        margin: 0 auto 14px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 34px;
        background: linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04));
        border: 1px solid rgba(255,255,255,0.14);
      }

      .xyron-confirm-badge {
        display: inline-block;
        margin-bottom: 10px;
        padding: 8px 14px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 1.7px;
        color: #ffd7fb;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.10);
      }

      .xyron-confirm-title {
        margin: 0 0 10px;
        font-size: 28px;
        font-weight: 800;
      }

      .xyron-confirm-text {
        margin: 0 0 18px;
        font-size: 16px;
        line-height: 1.7;
        color: #efe8ff;
      }

      .xyron-confirm-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      .xyron-confirm-btn {
        border: none;
        border-radius: 16px;
        padding: 14px 16px;
        cursor: pointer;
        font-size: 15px;
        font-weight: 800;
      }

      .xyron-confirm-btn.cancel {
        color: #fff;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.10);
      }

      .xyron-confirm-btn.ok {
        color: #fff;
        background: linear-gradient(90deg, #9d58f6, #ff39cf);
        box-shadow: 0 14px 32px rgba(255, 57, 207, 0.22);
      }

      .xyron-loading-active {
        pointer-events: none;
        opacity: .7;
      }

      @keyframes xyronConfirmPop {
        from { opacity: 0; transform: translateY(14px) scale(.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    `;

    document.head.appendChild(style);
  }

  function showConfirm(message, onConfirm) {
    injectConfirmStyles();

    const old = document.getElementById("xyron-confirm-popup");
    if (old) old.remove();

    const overlay = document.createElement("div");
    overlay.id = "xyron-confirm-popup";
    overlay.className = "xyron-confirm-overlay";
    overlay.innerHTML = `
      <div class="xyron-confirm-box">
        <div class="xyron-confirm-icon">⚡</div>
        <div class="xyron-confirm-badge">XYRON CONFIRM</div>
        <h2 class="xyron-confirm-title">Konfirmasi Aksi</h2>
        <p class="xyron-confirm-text">${message}</p>
        <div class="xyron-confirm-actions">
          <button class="xyron-confirm-btn cancel" id="xyron-confirm-cancel">Batal</button>
          <button class="xyron-confirm-btn ok" id="xyron-confirm-ok">Lanjut</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = function () {
      overlay.remove();
    };

    document.getElementById("xyron-confirm-cancel").addEventListener("click", close);

    document.getElementById("xyron-confirm-ok").addEventListener("click", function () {
      close();
      onConfirm();
    });

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
  }

  function setupConfirmActions() {
    document.querySelectorAll(".confirm-action").forEach(function (el) {
      if (el.dataset.boundConfirm === "1") return;
      el.dataset.boundConfirm = "1";

      el.addEventListener("click", function (e) {
        e.preventDefault();

        const href = el.getAttribute("href");
        const message = el.getAttribute("data-confirm") || "Yakin mau lanjut?";

        showConfirm(message, function () {
          if (href) {
            window.location.href = href;
          }
        });
      });
    });
  }

  function setupLoadingForms() {
    document.querySelectorAll(".loading-form").forEach(function (form) {
      if (form.dataset.boundLoading === "1") return;
      form.dataset.boundLoading = "1";

      form.addEventListener("submit", function () {
        const btn = form.querySelector(".loading-submit-btn");
        if (!btn) return;

        form.classList.add("xyron-loading-active");
        btn.disabled = true;
        btn.textContent = "Memproses...";
      });
    });
  }

  function setupSearch() {
    const userSearch = document.getElementById("userSearch");
    const productSearch = document.getElementById("productSearch");
    const orderSearch = document.getElementById("orderSearch");
    const orderFilter = document.getElementById("orderFilter");

    if (userSearch && userSearch.dataset.boundSearch !== "1") {
      userSearch.dataset.boundSearch = "1";

      userSearch.addEventListener("input", function () {
        const q = userSearch.value.toLowerCase();

        document.querySelectorAll(".searchable-user").forEach(function (card) {
          card.style.display = card.dataset.search.includes(q) ? "" : "none";
        });
      });
    }

    if (productSearch && productSearch.dataset.boundSearch !== "1") {
      productSearch.dataset.boundSearch = "1";

      productSearch.addEventListener("input", function () {
        const q = productSearch.value.toLowerCase();

        document.querySelectorAll(".searchable-product").forEach(function (card) {
          card.style.display = card.dataset.search.includes(q) ? "" : "none";
        });
      });
    }

    function filterOrders() {
      const q = orderSearch ? orderSearch.value.toLowerCase() : "";
      const status = orderFilter ? orderFilter.value : "all";

      document.querySelectorAll(".searchable-order").forEach(function (card) {
        const matchSearch = card.dataset.search.includes(q);
        const matchStatus = status === "all" || card.dataset.status === status;
        card.style.display = matchSearch && matchStatus ? "" : "none";
      });
    }

    if (orderSearch && orderSearch.dataset.boundSearch !== "1") {
      orderSearch.dataset.boundSearch = "1";
      orderSearch.addEventListener("input", filterOrders);
    }

    if (orderFilter && orderFilter.dataset.boundSearch !== "1") {
      orderFilter.dataset.boundSearch = "1";
      orderFilter.addEventListener("change", filterOrders);
    }
  }

  window.setupXyronPanelUi = function () {
    setupConfirmActions();
    setupLoadingForms();
    setupSearch();
  };

  document.addEventListener("DOMContentLoaded", function () {
    if (typeof window.setupXyronPanelUi === "function") {
      window.setupXyronPanelUi();
    }
  });
})();
