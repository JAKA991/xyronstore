const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

/* =========================
   FILE PATH
========================= */
const PRODUCTS_FILE = "products.json";
const ORDERS_FILE = "orders.json";
const USERS_FILE = "users.json";
const UPLOAD_DIR = "uploads";
const PAYMENT_DIR = path.join(UPLOAD_DIR, "payments");
const MAIN_OWNER_ID = 1;

/* =========================
   INIT STORAGE
========================= */
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
if (!fs.existsSync(PAYMENT_DIR)) fs.mkdirSync(PAYMENT_DIR, { recursive: true });
if (!fs.existsSync(PRODUCTS_FILE)) fs.writeFileSync(PRODUCTS_FILE, "[]");
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, "[]");

if (!fs.existsSync(USERS_FILE)) {
  const users = [
    {
      id: MAIN_OWNER_ID,
      username: "Jaksky2029",
      passwordHash: bcrypt.hashSync("JakSky221007", 10),
      role: "owner",
      status: "active",
      activeSessionId: null,
      title: "👑TUAN MUDA👑",
      lastLoginAt: null,
      lastLoginIp: "-",
      lastLoginDevice: "-",
      createdAt: new Date().toISOString()
    }
  ];

  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

/* =========================
   HELPERS
========================= */
function readJson(file, fallback = []) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function getUsers() {
  const users = readJson(USERS_FILE, []);
  return users.map((u) => ({
    ...u,
    title:
      u.title ||
      (u.id === MAIN_OWNER_ID
        ? "👑TUAN MUDA👑"
        : u.role === "owner"
        ? "Owner"
        : "Admin"),
    activeSessionId: u.activeSessionId || null,
    lastLoginAt: u.lastLoginAt || null,
    lastLoginIp: u.lastLoginIp || "-",
    lastLoginDevice: u.lastLoginDevice || "-"
  }));
}

function saveUsers(data) {
  writeJson(USERS_FILE, data);
}

function getProducts() {
  return readJson(PRODUCTS_FILE, []);
}

function saveProducts(data) {
  writeJson(PRODUCTS_FILE, data);
}

function getOrders() {
  return readJson(ORDERS_FILE, []);
}

function saveOrders(data) {
  writeJson(ORDERS_FILE, data);
}

function generateUserId() {
  return Date.now();
}

function generateOrderCode() {
  return "XYR-" + Math.floor(10000 + Math.random() * 90000);
}

function getUser(req) {
  if (!req.session.userId) return null;
  return getUsers().find((u) => u.id === req.session.userId) || null;
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return (
    req.headers["cf-connecting-ip"] ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

function getDeviceName(req) {
  const ua = (req.headers["user-agent"] || "").toLowerCase();

  if (ua.includes("android")) return "Android";
  if (ua.includes("iphone")) return "iPhone";
  if (ua.includes("ipad")) return "iPad";
  if (ua.includes("windows")) return "Windows";
  if (ua.includes("mac os")) return "Mac";
  if (ua.includes("linux")) return "Linux";

  return "Unknown Device";
}

function isMainOwner(user) {
  return !!user && user.role === "owner" && user.id === MAIN_OWNER_ID;
}

function canCreateOwner(actor) {
  return isMainOwner(actor);
}

function canChangeTarget(actor, target) {
  if (!actor || !target) return false;
  if (actor.role !== "owner") return false;
  if (actor.id === target.id) return false;
  if (target.id === MAIN_OWNER_ID) return false;
  if (target.role === "owner" && !isMainOwner(actor)) return false;
  return true;
}

function canSetRole(actor, target, nextRole) {
  if (!actor || !target) return false;
  if (actor.role !== "owner") return false;
  if (actor.id === target.id) return false;
  if (target.id === MAIN_OWNER_ID) return false;
  if (nextRole === "owner" && !isMainOwner(actor)) return false;
  if (target.role === "owner" && !isMainOwner(actor)) return false;
  return true;
}

function canEditSensitiveTarget(actor, target) {
  return canChangeTarget(actor, target);
}

function buildOwnerViewData(currentUser, users, error = null, success = null) {
  const products = getProducts();
  const orders = getOrders();

  return {
    currentUser,
    users,
    stats: {
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.status === "active").length,
      bannedUsers: users.filter((u) => u.status === "banned").length,
      totalOrders: orders.length,
      totalProducts: products.length
    },
    error,
    success,
    isMainOwner: isMainOwner(currentUser)
  };
}

/* =========================
   SOCKET MAP
========================= */
const userSockets = new Map();

function addSocketForUser(userId, socketId) {
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId).add(socketId);
}

function removeSocketForUser(userId, socketId) {
  if (!userSockets.has(userId)) return;
  const set = userSockets.get(userId);
  set.delete(socketId);
  if (set.size === 0) {
    userSockets.delete(userId);
  }
}

function emitForceLogout(userId, reason) {
  const sockets = userSockets.get(userId);
  if (!sockets) return;

  for (const socketId of sockets) {
    io.to(socketId).emit("force-logout", { reason });
  }
}

function emitUsersUpdated() {
  io.emit("users-updated");
}

/* =========================
   EXPRESS SETUP
========================= */
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

const sessionMiddleware = session({
  secret: "xyron-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 1000 * 60 * 60 * 24
  }
});

app.use(sessionMiddleware);

/* =========================
   SOCKET + SESSION
========================= */
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

io.on("connection", (socket) => {
  const req = socket.request;
  const userId = req.session && req.session.userId ? req.session.userId : null;

  if (userId) {
    addSocketForUser(userId, socket.id);
    socket.data.userId = userId;
  }

  socket.on("disconnect", () => {
    if (socket.data.userId) {
      removeSocketForUser(socket.data.userId, socket.id);
    }
  });
});

/* =========================
   MULTER
========================= */
const uploadProduct = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      cb(
        null,
        "product-" + Date.now() + "-" + file.originalname.replace(/\s+/g, "-")
      );
    }
  })
});

const uploadPayment = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, PAYMENT_DIR),
    filename: (req, file, cb) => {
      cb(
        null,
        "payment-" + Date.now() + "-" + file.originalname.replace(/\s+/g, "-")
      );
    }
  })
});

/* =========================
   AUTH
========================= */
function requireLogin(req, res, next) {
  const user = getUser(req);

  if (!user) {
    return res.redirect("/JakSkyLogin");
  }

  if (user.status !== "active") {
    req.session.destroy(() => {
      return res.redirect("/JakSkyLogin");
    });
    return;
  }

  if (!user.activeSessionId) {
    req.session.destroy(() => {
      return res.redirect("/JakSkyLogin");
    });
    return;
  }

  if (user.activeSessionId !== req.sessionID) {
    req.session.destroy(() => {
      return res.redirect("/JakSkyLogin");
    });
    return;
  }

  req.user = user;
  next();
}

function requireOwner(req, res, next) {
  requireLogin(req, res, () => {
    if (req.user.role !== "owner") {
      return res.redirect("/admin");
    }
    next();
  });
}

/* =========================
   API CHECK SESSION
========================= */
app.get("/api/check-session", (req, res) => {
  if (!req.session.userId) {
    return res.json({ valid: false, reason: "logged_out" });
  }

  const user = getUsers().find((u) => u.id === req.session.userId);

  if (!user) return res.json({ valid: false, reason: "deleted" });
  if (user.status === "banned") return res.json({ valid: false, reason: "banned" });
  if (user.status === "pending") return res.json({ valid: false, reason: "pending" });
  if (user.status !== "active") return res.json({ valid: false, reason: "inactive" });
  if (!user.activeSessionId) return res.json({ valid: false, reason: "logged_out" });
  if (user.activeSessionId !== req.sessionID) return res.json({ valid: false, reason: "kicked" });

  return res.json({
    valid: true,
    username: user.username,
    role: user.role,
    title: user.title,
    lastLoginAt: user.lastLoginAt,
    lastLoginIp: user.lastLoginIp,
    lastLoginDevice: user.lastLoginDevice
  });
});

/* =========================
   API USERS
========================= */
app.get("/api/users", requireOwner, (req, res) => {
  const users = getUsers().sort((a, b) => b.id - a.id);
  return res.json({
    success: true,
    currentUser: req.user,
    isMainOwner: isMainOwner(req.user),
    users
  });
});

/* =========================
   HOME
========================= */
app.get("/", (req, res) => {
  const products = getProducts();

  res.render("index", {
    products,
    android: products.filter((p) => p.category === "Android"),
    iphone: products.filter((p) => p.category === "iPhone")
  });
});

/* =========================
   PRODUCT DETAIL
========================= */
app.get("/product/:id", (req, res) => {
  const products = getProducts();
  const product = products.find((p) => p.id == req.params.id);

  if (!product) {
    return res.send("Produk tidak ditemukan");
  }

  const relatedProducts = products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  res.render("product", {
    product,
    relatedProducts
  });
});

/* =========================
   LOGIN
========================= */
app.get("/login", (req, res) => {
  return res.redirect("/JakSkyLogin");
});

app.get("/JakSkyLogin", (req, res) => {
  res.render("login", { error: null });
});

app.post("/JakSkyLogin", async (req, res) => {
  const { username, password } = req.body;
  const users = getUsers();
  const user = users.find((u) => u.username === username);

  if (!user) {
    return res.render("login", { error: "Username salah" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    return res.render("login", { error: "Password salah" });
  }

  if (user.status === "banned") {
    return res.render("login", { error: "Akun dibanned owner" });
  }

  if (user.status === "pending") {
    return res.render("login", { error: "Akun sedang pending" });
  }

  if (user.status !== "active") {
    return res.render("login", { error: "Akun belum aktif" });
  }

  if (user.activeSessionId && user.activeSessionId !== req.sessionID) {
    emitForceLogout(user.id, "kicked");
  }

  user.activeSessionId = req.sessionID;
  user.lastLoginAt = new Date().toISOString();
  user.lastLoginIp = getClientIp(req);
  user.lastLoginDevice = getDeviceName(req);

  saveUsers(users);

  req.session.userId = user.id;

  req.session.save(() => {
    emitUsersUpdated();

    if (user.role === "owner") {
      return res.redirect("/owner");
    }

    return res.redirect("/admin");
  });
});

/* =========================
   LOGOUT
========================= */
app.get("/logout", (req, res) => {
  const users = getUsers();
  const user = users.find((u) => u.id === req.session.userId);

  if (user) {
    user.activeSessionId = null;
    user.lastLoginIp = "-";
    user.lastLoginDevice = "-";
    saveUsers(users);
    emitForceLogout(user.id, "logged_out");
    emitUsersUpdated();
  }

  req.session.destroy(() => {
    res.redirect("/JakSkyLogin");
  });
});

/* =========================
   OWNER PANEL
========================= */
app.get("/owner", requireOwner, (req, res) => {
  const users = getUsers().sort((a, b) => b.id - a.id);
  res.render("owner", buildOwnerViewData(req.user, users));
});

app.get("/JakSkyOwnerPanel", requireOwner, (req, res) => {
  const users = getUsers().sort((a, b) => b.id - a.id);
  res.render("owner", buildOwnerViewData(req.user, users));
});

app.post("/owner/create-user", requireOwner, (req, res) => {
  const { username, password, role, status } = req.body;
  const users = getUsers();

  if (!username || !password || !role || !status) {
    return res.render("owner", buildOwnerViewData(req.user, users, "Semua field wajib diisi."));
  }

  if (users.some((u) => u.username === username)) {
    return res.render("owner", buildOwnerViewData(req.user, users, "Username sudah dipakai."));
  }

  if (role === "owner" && !canCreateOwner(req.user)) {
    return res.render("owner", buildOwnerViewData(req.user, users, "Hanya owner utama yang bisa membuat owner baru."));
  }

  users.push({
    id: generateUserId(),
    username,
    passwordHash: bcrypt.hashSync(password, 10),
    role: role === "owner" ? "owner" : "admin",
    status,
    activeSessionId: null,
    title: role === "owner" ? "Owner" : "Admin",
    lastLoginAt: null,
    lastLoginIp: "-",
    lastLoginDevice: "-",
    createdAt: new Date().toISOString()
  });

  saveUsers(users);
  emitUsersUpdated();

  return res.redirect("/owner");
});app.post("/owner/update-title/:id", requireOwner, (req, res) => {
  const { id } = req.params;
  const { title } = req.body;
  const users = getUsers();
  const target = users.find((u) => u.id == id);

  if (!target) return res.redirect("/owner");
  if (!isMainOwner(req.user)) return res.redirect("/owner");

  target.title = (title || "").trim() || "User";
  saveUsers(users);
  emitUsersUpdated();

  return res.redirect("/owner");
});

app.get("/owner/set-status/:id/:status", requireOwner, (req, res) => {
  const { id, status } = req.params;
  const users = getUsers();
  const target = users.find((u) => u.id == id);

  if (!target) return res.redirect("/owner");
  if (!["active", "pending", "banned"].includes(status)) return res.redirect("/owner");
  if (!canChangeTarget(req.user, target)) return res.redirect("/owner");

  target.status = status;

  if (status === "active") {
    saveUsers(users);
    emitUsersUpdated();
    return res.redirect("/owner");
  }

  target.activeSessionId = null;
  target.lastLoginIp = "-";
  target.lastLoginDevice = "-";
  saveUsers(users);

  if (status === "pending") {
    emitForceLogout(target.id, "pending");
  }

  if (status === "banned") {
    emitForceLogout(target.id, "banned");
  }

  emitUsersUpdated();

  return res.redirect("/owner");
});

app.get("/owner/set-role/:id/:role", requireOwner, (req, res) => {
  const { id, role } = req.params;
  const users = getUsers();
  const target = users.find((u) => u.id == id);

  if (!target) return res.redirect("/owner");
  if (!["admin", "owner"].includes(role)) return res.redirect("/owner");
  if (!canSetRole(req.user, target, role)) return res.redirect("/owner");

  target.role = role;
  if (!target.title) {
    target.title = role === "owner" ? "Owner" : "Admin";
  }
  saveUsers(users);
  emitUsersUpdated();

  return res.redirect("/owner");
});

app.post("/owner/reset-password/:id", requireOwner, (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  const users = getUsers();
  const target = users.find((u) => u.id == id);

  if (!target || !newPassword) {
    return res.redirect("/owner");
  }

  if (!canEditSensitiveTarget(req.user, target)) {
    return res.redirect("/owner");
  }

  target.passwordHash = bcrypt.hashSync(newPassword, 10);
  target.activeSessionId = null;
  target.lastLoginIp = "-";
  target.lastLoginDevice = "-";
  saveUsers(users);

  emitForceLogout(target.id, "kicked");
  emitUsersUpdated();

  return res.redirect("/owner");
});

app.get("/owner/kick/:id", requireOwner, (req, res) => {
  const users = getUsers();
  const target = users.find((u) => u.id == req.params.id);

  if (!target) return res.redirect("/owner");
  if (!canChangeTarget(req.user, target)) return res.redirect("/owner");

  target.activeSessionId = null;
  target.lastLoginIp = "-";
  target.lastLoginDevice = "-";
  saveUsers(users);

  emitForceLogout(target.id, "kicked");
  emitUsersUpdated();

  return res.redirect("/owner");
});

app.get("/owner/delete-user/:id", requireOwner, (req, res) => {
  const users = getUsers();
  const target = users.find((u) => u.id == req.params.id);

  if (!target) return res.redirect("/owner");
  if (!canEditSensitiveTarget(req.user, target)) return res.redirect("/owner");

  saveUsers(users.filter((u) => u.id != req.params.id));

  emitForceLogout(target.id, "deleted");
  emitUsersUpdated();

  return res.redirect("/owner");
});

/* =========================
   ADMIN PANEL
========================= */
app.get("/admin", requireLogin, (req, res) => {
  const products = getProducts();
  const orders = getOrders().sort((a, b) => b.id - a.id);

  res.render("admin", {
    currentUser: req.user,
    products,
    orders,
    stats: {
      totalProducts: products.length,
      totalOrders: orders.length,
      pendingOrders: orders.filter((o) => o.status === "Pending").length,
      doneOrders: orders.filter((o) => o.status === "Selesai").length
    }
  });
});

/* =========================
   UPLOAD PRODUCT
========================= */
app.post("/admin/upload", requireLogin, uploadProduct.single("image"), (req, res) => {
  const { title, price, category, description, stock, bestSeller } = req.body;
  const products = getProducts();

  products.push({
    id: Date.now(),
    title,
    price: Number(price),
    category,
    description: description || "",
    stock: Number(stock) || 0,
    bestSeller: bestSeller === "on",
    image: req.file ? req.file.filename : null
  });

  saveProducts(products);
  return res.redirect("/admin");
});

/* =========================
   DELETE PRODUCT
========================= */
app.get("/admin/delete/:id", requireLogin, (req, res) => {
  const products = getProducts();
  const product = products.find((p) => p.id == req.params.id);

  if (product && product.image) {
    const imagePath = path.join(UPLOAD_DIR, product.image);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  }

  saveProducts(products.filter((p) => p.id != req.params.id));
  return res.redirect("/admin");
});

/* =========================
   ORDER STATUS
========================= */
app.get("/admin/order-status/:id/:status", requireLogin, (req, res) => {
  const { id, status } = req.params;
  const allowed = ["Pending", "Lunas", "Diproses", "Selesai"];

  if (!allowed.includes(status)) {
    return res.redirect("/admin");
  }

  const orders = getOrders();
  const products = getProducts();
  const order = orders.find((o) => o.id == id);

  if (!order) {
    return res.redirect("/admin");
  }

  if (status === "Lunas" && order.status !== "Lunas") {
    const product = products.find((p) => p.id == order.productId);

    if (!product || product.stock <= 0) {
      return res.redirect("/admin");
    }

    product.stock -= 1;
    saveProducts(products);
  }

  order.status = status;
  saveOrders(orders);

  return res.redirect("/admin");
});

/* =========================
   DELETE ORDER
========================= */
app.get("/admin/order-delete/:id", requireLogin, (req, res) => {
  const orders = getOrders();
  const order = orders.find((o) => o.id == req.params.id);

  if (order && order.paymentProof) {
    const filePath = path.join(PAYMENT_DIR, order.paymentProof);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  saveOrders(orders.filter((o) => o.id != req.params.id));
  return res.redirect("/admin");
});

/* =========================
   CHECKOUT
========================= */
app.get("/checkout/:id", (req, res) => {
  const product = getProducts().find((p) => p.id == req.params.id);

  if (!product) {
    return res.send("Produk tidak ditemukan");
  }

  res.render("checkout", {
    product,
    success: null,
    error: null,
    uploadedOrder: null
  });
});

app.post("/checkout/:id", uploadPayment.single("paymentProof"), (req, res) => {
  const product = getProducts().find((p) => p.id == req.params.id);

  if (!product) {
    return res.send("Produk tidak ditemukan");
  }

  const { customerName, customerWhatsapp, note } = req.body;

  if (!customerName || !customerWhatsapp || !req.file) {
    return res.render("checkout", {
      product,
      error: "Nama, nomor WhatsApp, dan bukti transfer wajib diisi.",
      success: null,
      uploadedOrder: null
    });
  }

  if (typeof product.stock === "number" && product.stock <= 0) {
    return res.render("checkout", {
      product,
      error: "Produk sudah habis.",
      success: null,
      uploadedOrder: null
    });
  }

  const orders = getOrders();

  const newOrder = {
    id: Date.now(),
    orderCode: generateOrderCode(),
    productId: product.id,
    productTitle: product.title,
    category: product.category,
    price: product.price,
    customerName,
    customerWhatsapp,
    note: note || "",
    paymentProof: req.file.filename,
    status: "Pending",
    createdAt: new Date().toISOString()
  };

  orders.push(newOrder);
  saveOrders(orders);

  return res.render("checkout", {
    product,
    success: "Upload berhasil",
    error: null,
    uploadedOrder: newOrder
  });
});

/* =========================
   START
========================= */
server.listen(PORT, "0.0.0.0", () => {
  console.log("Server jalan di http://localhost:" + PORT);
  console.log("Login admin/user di /JakSkyLogin");
  console.log("Owner panel di /owner");
});
