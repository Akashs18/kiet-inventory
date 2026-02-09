import pool from "../db/pool.js";

/* ---------- DASHBOARD (SEARCH + PAGINATION) ---------- */
export const dashboard = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 5;
  const offset = (page - 1) * limit;
  const search = (req.query.search || "").trim();

  const result = await pool.query(
    `SELECT * FROM products
     WHERE name ILIKE $1
     ORDER BY id
     LIMIT $2 OFFSET $3`,
    [`%${search}%`, limit + 1, offset]
  );

  res.render("staff/dashboard", {
    products: result.rows.slice(0, limit),
    page,
    search,
    hasNext: result.rows.length > limit
  });
};

/* ---------- ADD TO CART (STOCK VALIDATION + NO DUPLICATES) ---------- */
export const addToCart = async (req, res) => {
  const { product_id, quantity } = req.body;
  const staffId = req.session.user.id;

  // Validate quantity
  if (!quantity || parseInt(quantity) <= 0) {
    return res.send("Quantity must be greater than zero");
  }

  // Check product stock
  const stock = await pool.query(
    "SELECT quantity FROM products WHERE id=$1",
    [product_id]
  );

  if (!stock.rows.length) {
    return res.send("Product not found");
  }

  if (parseInt(quantity) > stock.rows[0].quantity) {
    return res.send("Not enough stock available");
  }

  // Get or create pending cart
  let cart = await pool.query(
    "SELECT * FROM carts WHERE staff_id=$1 AND status='pending'",
    [staffId]
  );

  if (!cart.rows.length) {
    cart = await pool.query(
      "INSERT INTO carts (staff_id) VALUES ($1) RETURNING *",
      [staffId]
    );
  }

  // Check if product already in cart
  const existingItem = await pool.query(
    "SELECT * FROM cart_items WHERE cart_id=$1 AND product_id=$2",
    [cart.rows[0].id, product_id]
  );

  if (existingItem.rows.length) {
    // Update quantity instead of inserting duplicate
    await pool.query(
      "UPDATE cart_items SET quantity = quantity + $1 WHERE id=$2",
      [quantity, existingItem.rows[0].id]
    );
  } else {
    await pool.query(
      "INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)",
      [cart.rows[0].id, product_id, quantity]
    );
  }

  res.redirect("/staff/dashboard");
};

/* ---------- VIEW CART ---------- */
export const viewCart = async (req, res) => {
  const staffId = req.session.user.id;

  const items = await pool.query(`
    SELECT ci.id AS cart_item_id, p.id AS product_id, p.name, ci.quantity, p.quantity AS stock
    FROM cart_items ci
    JOIN carts c ON ci.cart_id = c.id
    JOIN products p ON ci.product_id = p.id
    WHERE c.staff_id=$1 AND c.status='pending'
  `, [staffId]);

  res.render("staff/cart", { items: items.rows });
};

/* ---------- SUBMIT CART ---------- */
export const submitCart = async (req, res) => {
  const staffId = req.session.user.id;

  await pool.query(
    "UPDATE carts SET status='ordered' WHERE staff_id=$1 AND status='pending'",
    [staffId]
  );

  res.redirect("/staff/dashboard");
};

/* ---------- REMOVE ITEM FROM CART ---------- */
export const removeFromCart = async (req, res) => {
  const { cart_item_id } = req.params;
  await pool.query("DELETE FROM cart_items WHERE id=$1", [cart_item_id]);
  res.redirect("/staff/cart");
};

/* ---------- increase quantity of item in cart ---------- */
export const increaseQty = async (req, res) => {
  const { cart_item_id } = req.params;

  // get cart item + stock
  const item = await pool.query(`
    SELECT ci.quantity, p.quantity AS stock
    FROM cart_items ci
    JOIN products p ON ci.product_id = p.id
    WHERE ci.id = $1
  `, [cart_item_id]);

  if (!item.rows.length) {
    return res.redirect("/staff/cart");
  }

  if (item.rows[0].quantity >= item.rows[0].stock) {
    return res.send("Cannot exceed available stock");
  }

  await pool.query(
    "UPDATE cart_items SET quantity = quantity + 1 WHERE id=$1",
    [cart_item_id]
  );

  res.redirect("/staff/cart");
};
/* ---------- decrease quantity of item in cart ---------- */
export const decreaseQty = async (req, res) => {
  const { cart_item_id } = req.params;

  const item = await pool.query(
    "SELECT quantity FROM cart_items WHERE id=$1",
    [cart_item_id]
  );

  if (!item.rows.length) {
    return res.redirect("/staff/cart");
  }

  if (item.rows[0].quantity <= 1) {
    // remove item if quantity becomes 0
    await pool.query(
      "DELETE FROM cart_items WHERE id=$1",
      [cart_item_id]
    );
  } else {
    await pool.query(
      "UPDATE cart_items SET quantity = quantity - 1 WHERE id=$1",
      [cart_item_id]
    );
  }

  res.redirect("/staff/cart");
};

//order history
export const orderHistory = async (req, res) => {
  const staffId = req.session.user.id;
  const search = req.query.q || "";


  const orders = await pool.query(`
    SELECT 
      c.id AS cart_id,
      c.status,
      c.created_at,
      p.name AS product_name,
      ci.quantity
    FROM carts c
    JOIN cart_items ci ON ci.cart_id = c.id
    JOIN products p ON ci.product_id = p.id
    WHERE c.staff_id = $1
      AND c.status != 'pending'
      AND (
       c.id = CASE 
        WHEN $2 ~ '^[0-9]+$' THEN $2::int
        ELSE -1
      END
      OR c.status ILIKE $3
      OR p.name ILIKE $3
      )
    ORDER BY c.created_at DESC
  `, [staffId, search, `%${search}%`]);

  // Group products by cart
  const grouped = {};
  orders.rows.forEach(row => {
    if (!grouped[row.cart_id]) grouped[row.cart_id] = { 
      cart_id: row.cart_id,
      status: row.status,
      created_at: row.created_at,
      
      items: []
    };
    grouped[row.cart_id].items.push({ name: row.product_name, quantity: row.quantity });
  });

  res.render("staff/order-history", { orders: Object.values(grouped),query: req.query.q || "" });
};

