import  pool  from "../db/pool.js";
import { sendMail } from "../utils/mailer.js";

/* ---------- DASHBOARD ---------- */
export const dashboard = async (req, res) => {
  res.render("inventory-admin/dashboard");
};

/* ---------- PRODUCTS ---------- */
export const addProduct = async (req, res) => {
  const { name, quantity, supplier_id } = req.body;

  await pool.query(
    "INSERT INTO products (name,quantity,supplier_id) VALUES ($1,$2,$3)",
    [name, quantity, supplier_id]
  );

  res.redirect("/inventory-admin/dashboard");
};

/* ---------- SUPPLIERS ---------- */
export const addSupplier = async (req, res) => {
  const { name, contact, address } = req.body;

  await pool.query(
    "INSERT INTO suppliers (name,contact,address) VALUES ($1,$2,$3)",
    [name, contact, address]
  );

  res.redirect("/inventory-admin/dashboard");
};

/* ---------- PO UPLOAD ---------- */
export const uploadPO = async (req, res) => {
  const { supplier_id } = req.body;

  await pool.query(
    "INSERT INTO purchase_orders (supplier_id, po_file, created_by) VALUES ($1,$2,$3)",
    [supplier_id, req.file.path, req.session.user.id]
  );

  res.redirect("/inventory-admin/dashboard");
};

/* ---------- RECEIVE ORDER ---------- */
export const receiveOrder = async (req, res) => {
  const { cart_id } = req.params;

  const items = await pool.query(`
    SELECT ci.quantity, ci.product_id, u.email
    FROM cart_items ci
    JOIN carts c ON ci.cart_id = c.id
    JOIN users u ON c.staff_id = u.id
    WHERE c.id=$1
  `, [cart_id]);

  for (const item of items.rows) {
    await pool.query(
      "UPDATE products SET quantity = quantity - $1 WHERE id=$2",
      [item.quantity, item.product_id]
    );
  }

  await pool.query(
    "UPDATE carts SET status='received' WHERE id=$1",
    [cart_id]
  );

  await sendMail(
    [items.rows[0].email, process.env.MAIL_USER],
    "Indent Received",
    "<p>Your indent has been received successfully.</p>"
  );

  res.redirect("/inventory-admin/dashboard");
};
