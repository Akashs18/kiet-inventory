import express from "express";
import {
  dashboard,
  addProduct,
  addSupplier,
  uploadPO,
  receiveOrder
} from "../controllers/inventory.controller.js";

import { isAuth } from "../middleware/auth.js";
import { allow } from "../middleware/role.js";
import { upload } from "../utils/upload.js";
import pool from "../db/pool.js";


const router = express.Router();

/* Dashboard */
router.get(
  "/dashboard",
  isAuth,
  allow("inventory-admin", "super-admin"),
  dashboard
);

/* Products */
router.post(
  "/product/add",
  isAuth,
  allow("inventory-admin", "super-admin"),
  addProduct
);

/* Suppliers */
router.post(
  "/supplier/add",
  isAuth,
  allow("inventory-admin", "super-admin"),
  addSupplier
);

/* PO Upload UI */
router.get(
  "/po/upload",
  isAuth,
  allow("inventory-admin"),
  (req, res) => {
    res.render("inventory-admin/upload-po");
  }
);

/* PO Upload */
router.post(
  "/po/upload",
  isAuth,
  allow("inventory-admin"),
  upload.single("po"),
  uploadPO
);

/* Receive Order */
router.post(
  "/order/receive/:cart_id",
  isAuth,
  allow("inventory-admin"),
  receiveOrder
);

/* Products page */

router.get(
  "/products",
  isAuth,
  allow("inventory-admin", "super-admin"),
  async (req, res) => {
    // Get all products and their suppliers
    const result = await pool.query(`
      SELECT p.id, p.name, p.quantity, s.name AS supplier
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
    `);

    res.render("inventory-admin/products", {
      products: result.rows // pass products to the view
    });
  }
);


/* Add product page */
router.get(
  "/products/add",
  isAuth,
  allow("inventory-admin", "super-admin"),
  async (req, res) => {
    const suppliers = await pool.query("SELECT id, name FROM suppliers");
    res.render("inventory-admin/add-product", {
      suppliers: suppliers.rows
    });
  }
);

/* Suppliers page */
router.get(
  "/suppliers",
  isAuth,
  allow("inventory-admin", "super-admin"),
  async (req, res) => {
    const result = await pool.query("SELECT * FROM suppliers ORDER BY id DESC");
    res.render("inventory-admin/suppliers", {
      suppliers: result.rows
    });
  }
);

router.get(
  "/suppliers/add",
  isAuth,
  allow("inventory-admin", "super-admin"),
  (req, res) => {
    res.render("inventory-admin/add-supplier");
  }
);

export default router;
