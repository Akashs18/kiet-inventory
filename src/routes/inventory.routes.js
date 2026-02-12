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
// For inline add row in products page
router.post(
  "/products",
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
    const page = parseInt(req.query.page) || 1; // current page
    const limit = 10; // products per page
    const offset = (page - 1) * limit;

    // Total count for pagination
    const countResult = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.name ILIKE $1
      `,
      [`%${search}%`]
    );

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    // Fetch paginated products
    const result = await pool.query(
      `
      SELECT p.id, p.name, p.quantity, p.description, s.name AS supplier
      FROM products p
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      WHERE p.name ILIKE $1
      ORDER BY p.id DESC
      LIMIT $2 OFFSET $3
      `,
      [`%${search}%`, limit, offset]
    );

    const suppliers = await pool.query(
      "SELECT id, name FROM suppliers"
    );

    res.render("inventory-admin/products", {
      products: result.rows,
      suppliers: suppliers.rows,
      search,
      currentPage: page,
      totalPages
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

    const search = req.query.q || "";

    const result = await pool.query(`
       SELECT *
  FROM suppliers
  WHERE (
    -- Exact match on ID only if numeric
    ($1 ~ '^[0-9]+$' AND id = $1::int)
    -- Text search on name, contact, address
    OR name ILIKE $2
    OR CAST(contact AS TEXT) ILIKE $2
    OR address ILIKE $2
  )
  ORDER BY id DESC
    `,[
      search,          // $1 exact ID match
      `%${search}%`    // $2 text search
    ]);
    res.render("inventory-admin/suppliers", {
      suppliers: result.rows,
      query: search

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

   const search = req.query.q || "";
const searchInt = parseInt(search, 10); // NaN if not a number

let result;

if (!isNaN(searchInt)) {
  // If search is a number, match cart ID exactly
  result = await pool.query(`
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
      AND c.id = $1
    ORDER BY c.created_at DESC
  `, [searchInt]);
} else {
  // If search is text, match staff or product names
  result = await pool.query(`
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
      AND (u.name ILIKE $1 OR p.name ILIKE $1)
    ORDER BY c.created_at DESC
  `, [`%${search}%`]);
}


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
      orders: Object.values(orders),
      query: search
    });
  }
);

//edit supplier page
router.get(
  "/suppliers/edit/:id",
  isAuth,
  allow("inventory-admin", "super-admin"),
  async (req, res) => {
    const { id } = req.params;

    const result = await pool.query(
      "SELECT * FROM suppliers WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.redirect("/inventory-admin/suppliers");
    }

    res.render("inventory-admin/edit-supplier", {
      supplier: result.rows[0],
      error: null
    });
  }
);

//Update supplier page
router.post(
  "/suppliers/edit/:id",
  isAuth,
  allow("inventory-admin", "super-admin"),
  async (req, res) => {
    const { id } = req.params;
    const { name, contact, address } = req.body;

    // Prevent duplicates (excluding current supplier)
    const existing = await pool.query(
      "SELECT * FROM suppliers WHERE (name = $1 OR contact = $2) AND id != $3",
      [name, contact, id]
    );

    if (existing.rows.length > 0) {
      return res.render("inventory-admin/edit-supplier", {
        supplier: { id, name, contact, address },
        error: "Supplier with this name or contact already exists."
      });
    }

    await pool.query(
      "UPDATE suppliers SET name=$1, contact=$2, address=$3 WHERE id=$4",
      [name, contact, address, id]
    );

    res.redirect("/inventory-admin/suppliers");
  }
);

router.get("/dashboard", async (req, res) => {

  const stats = {
    products: 120,
    suppliers: 25,
    pendingOrders: 8
  };

  const monthlyOrders = [12, 19, 8, 15, 22, 30];
  const productGrowth = [5, 10, 15, 20, 28, 35];

  res.render("dashboard", {
    stats,
    monthlyOrders,
    productGrowth
  });

});


export default router;
