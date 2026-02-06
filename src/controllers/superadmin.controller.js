import bcrypt from "bcrypt";
import pool   from "../db/pool.js";

export const dashboard = async (req, res) => {
  const users = await pool.query("SELECT COUNT(*) FROM users");
  const products = await pool.query("SELECT COUNT(*) FROM products");
  const suppliers = await pool.query("SELECT COUNT(*) FROM suppliers");

  res.render("super-admin/dashboard", {
    stats: {
      users: users.rows[0].count,
      products: products.rows[0].count,
      suppliers: suppliers.rows[0].count
    }
  });
};

export const createUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  const hash = await bcrypt.hash(password, 10);

  await pool.query(
    "INSERT INTO users (name,email,password,role) VALUES ($1,$2,$3,$4)",
    [name, email, hash, role]
  );

  res.redirect("/super-admin/dashboard");
};

export const reports = async (req, res) => {
  const users = await pool.query("SELECT COUNT(*) FROM users");
  const products = await pool.query("SELECT COUNT(*) FROM products");
  const suppliers = await pool.query("SELECT COUNT(*) FROM suppliers");
  const orders = await pool.query(
    "SELECT COUNT(*) FROM carts WHERE status='received'"
  );

  res.render("super-admin/reports", {
    users: users.rows[0].count,
    products: products.rows[0].count,
    suppliers: suppliers.rows[0].count,
    orders: orders.rows[0].count
  });
};

export const showCreateUser = (req, res) => {
  res.render("super-admin/create-user");
};

