import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.routes.js";
import superAdminRoutes from "./routes/superadmin.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import staffRoutes from "./routes/staff.routes.js";

dotenv.config();

const app = express();

/* -------------------- ESM FIX FOR __dirname -------------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* -------------------- MIDDLEWARE -------------------- */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    name: "inventory-session",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
  })
);

/* -------------------- VIEW ENGINE -------------------- */
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

/* -------------------- STATIC FILES -------------------- */
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use(express.static(path.join(__dirname, "public")));

/* -------------------- ROUTES -------------------- */
app.use("/", authRoutes);
app.use("/super-admin", superAdminRoutes);
app.use("/inventory-admin", inventoryRoutes);
app.use("/staff", staffRoutes);

/* -------------------- DEFAULT ROUTES -------------------- */

// Login page
app.get("/", (req, res) => {
  res.render("login");
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).send("Page not found");
});

export default app;
