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

/* Products page (with search) */
router.get(
  "/products",
  isAuth,
  allow("inventory-admin", "super-admin"),
  async (req, res) => {
    const search = req.query.search || "";

    const result = await pool.query(
      `
      SELECT p.id, p.name, p.quantity, s.name AS supplier
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.name ILIKE $1
      ORDER BY p.id DESC
      `,
      [`%${search}%`]
    );

    res.render("inventory-admin/products", {
      products: result.rows,
      search
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

/* Edit product page */
router.get(
  "/products/edit/:id",
  isAuth,
  allow("inventory-admin", "super-admin"),
  async (req, res) => {
    const { id } = req.params;

    const product = await pool.query(
      "SELECT * FROM products WHERE id=$1",
      [id]
    );

    const suppliers = await pool.query(
      "SELECT id, name FROM suppliers"
    );

    if (!product.rows.length) {
      return res.redirect("/inventory-admin/products");
    }

    res.render("inventory-admin/edit-product", {
      product: product.rows[0],
      suppliers: suppliers.rows
    });
  }
);

/* Update product */
router.post(
  "/products/edit/:id",
  isAuth,
  allow("inventory-admin", "super-admin"),
  async (req, res) => {
    const { id } = req.params;
    const { name, quantity, supplier_id } = req.body;

    await pool.query(
      `UPDATE products
       SET name=$1, quantity=$2, supplier_id=$3
       WHERE id=$4`,
      [name, quantity, supplier_id, id]
    );

    res.redirect("/inventory-admin/products");
  }
);

/* Pending orders (indents) */
router.get(
  "/orders/pending",
  isAuth,
  allow("inventory-admin"),
  async (req, res) => {
    const result = await pool.query(`
      SELECT c.id AS cart_id, u.name AS staff_name, u.email AS staff_email, ci.product_id, p.name AS product_name, ci.quantity
      FROM carts c
      JOIN users u ON c.staff_id = u.id
      JOIN cart_items ci ON ci.cart_id = c.id
      JOIN products p ON ci.product_id = p.id
      WHERE c.status='ordered'
      ORDER BY c.id DESC
    `);

    // Group by cart
    const orders = {};
    result.rows.forEach(row => {
      if (!orders[row.cart_id]) {
        orders[row.cart_id] = {
          cart_id: row.cart_id,
          staff_name: row.staff_name,
          staff_email: row.staff_email,
          items: []
        };
      }
      orders[row.cart_id].items.push({
        product_name: row.product_name,
        quantity: row.quantity
      });
    });

    res.render("inventory-admin/orders-pending", {
      orders: Object.values(orders)
    });
  }
);

// Receive order (update stock and mark cart as received)
router.get(
  "/orders/pending",
  isAuth,
  allow("inventory-admin"),
  async (req, res) => {
    const result = await pool.query(`
      SELECT c.id AS cart_id, u.name AS staff_name, u.email AS staff_email,
             ci.product_id, p.name AS product_name, ci.quantity
      FROM carts c
      JOIN users u ON c.staff_id = u.id
      JOIN cart_items ci ON ci.cart_id = c.id
      JOIN products p ON ci.product_id = p.id
      WHERE c.status = 'ordered'
      ORDER BY c.id DESC
    `);

    // Group items by cart
    const orders = {};
    result.rows.forEach(row => {
      if (!orders[row.cart_id]) {
        orders[row.cart_id] = {
          staff_name: row.staff_name,
          staff_email: row.staff_email,
          items: []
        };
      }
      orders[row.cart_id].items.push({
        product_name: row.product_name,
        quantity: row.quantity,
        product_id: row.product_id
      });
    });

    res.render("inventory-admin/pending-orders", { orders });
  }
);

/* Order History (Received Orders) */
router.get(
  "/orders/history",
  isAuth,
  allow("inventory-admin"),
  async (req, res) => {
    const result = await pool.query(`
      SELECT 
        c.id AS cart_id,
        u.name AS staff_name,
        c.created_at,
        p.name AS product_name,
        ci.quantity
      FROM carts c
      JOIN users u ON u.id = c.staff_id
      JOIN cart_items ci ON ci.cart_id = c.id
      JOIN products p ON ci.product_id = p.id
      WHERE c.status = 'received'
      ORDER BY c.created_at DESC
    `);

    const orders = {};
    result.rows.forEach(row => {
      if (!orders[row.cart_id]) {
        orders[row.cart_id] = {
          cart_id: row.cart_id,
          staff_name: row.staff_name,
          created_at: row.created_at,
          items: []
        };
      }
      orders[row.cart_id].items.push({
        product_name: row.product_name,
        quantity: row.quantity
      });
    });

    res.render("inventory-admin/order-history", {
      orders: Object.values(orders)
    });
  }
);



export default router;
