import  pool  from "../db/pool.js";
import { sendMail } from "../utils/mailer.js";
import { generateIndentPDF } from "../utils/indentPdf.js";
import { generateIndentNumber } from "../utils/indentNumber.js";

/* ---------- DASHBOARD ---------- */
export const dashboard = async (req, res) => {
    
  const products = await pool.query("SELECT COUNT(*) FROM products");
  const suppliers = await pool.query("SELECT COUNT(*) FROM suppliers"); 
   const pendingOrders = await pool.query(
    "SELECT COUNT(*) FROM carts WHERE status = 'pending'"
  ); 
  res.render("inventory-admin/dashboard", {
    stats: {
      
      products: products.rows[0].count,
      suppliers: suppliers.rows[0].count,
      pendingOrders: pendingOrders.rows[0].count
    }
  });
};

/* ---------- PRODUCTS ---------- */
export const addProduct = async (req, res) => {
  const { name, quantity, supplier_id } = req.body;

  // Check for duplicate product (same name + same supplier)
  const existing = await pool.query(
    `SELECT id FROM products 
     WHERE LOWER(name) = LOWER($1) AND supplier_id = $2`,
    [name, supplier_id]
  );

  if (existing.rows.length > 0) {
    // Duplicate found → show error
    const suppliers = await pool.query("SELECT id, name FROM suppliers");

    return res.render("inventory-admin/add-product", {
      error: "Product already exists for this supplier.",
      suppliers: suppliers.rows,
      name,
      quantity,
      supplier_id
    });
  }

  await pool.query(
    "INSERT INTO products (name,quantity,supplier_id) VALUES ($1,$2,$3)",
    [name, quantity, supplier_id]
  );

  res.redirect("/inventory-admin/dashboard");
};

/* ---------- SUPPLIERS ---------- */
export const addSupplier = async (req, res) => {
  const { name, contact, address } = req.body;

  // Check if supplier with same name or contact exists
  const existing = await pool.query(
    "SELECT * FROM suppliers WHERE name = $1 OR contact = $2",
    [name, contact]
  );

  if (existing.rows.length > 0) {
    // Supplier exists → redirect back with an error message
    return res.render("inventory-admin/add-supplier", {
      error: "Supplier with this name or contact already exists.",
      name,
      contact,
      address
    });
  }

  // Insert new supplier
  await pool.query(
    "INSERT INTO suppliers (name, contact, address) VALUES ($1, $2, $3)",
    [name, contact, address]
  );

  res.redirect("/inventory-admin/suppliers");
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

  const client = await pool.connect();

  try {
    await client.query("BEGIN"); // Start transaction

    // Get cart items and staff email
    const itemsResult = await client.query(`
      SELECT 
        ci.quantity,
        p.id AS product_id,
        p.name AS product_name,
        p.quantity AS stock_quantity,
        u.email,
        u.name AS staff_name
      FROM cart_items ci
      JOIN carts c ON ci.cart_id = c.id
      JOIN products p ON ci.product_id = p.id
      JOIN users u ON c.staff_id = u.id
      WHERE c.id=$1
      FOR UPDATE
    `, [cart_id]);

    const items = itemsResult.rows;

    // Check if enough stock exists
    for (const item of items) {
      if (item.quantity > item.stock_quantity) {
        await client.query("ROLLBACK");
        return res.status(400).send(`Not enough stock for product: ${item.product_name}`);
      }
    }

    // Generate indent number
    const indentNo = await generateIndentNumber(client);

    // Update stock
    for (const item of items) {
      await client.query(
        "UPDATE products SET quantity = quantity - $1 WHERE id=$2",
        [item.quantity, item.product_id]
      );
    }

    // Mark cart as received
    await client.query(
      "UPDATE carts SET status='received', indent_no=$1, received_at=NOW() WHERE id=$2",
      [indentNo, cart_id]
    );

    await client.query("COMMIT"); // Commit transaction

    // Generate PDF
    const pdfPath = await generateIndentPDF(
      {
        cart_id,
        indent_no: indentNo,
        staff_name: items[0].staff_name
      },
      items
    );

    // Send email
    const staffEmail = items[0].email;
    const productList = items.map(i => `${i.product_name} - ${i.quantity}`).join("<br>");
    const emailContent = `
      <p>Dear Staff,</p>
      <p>Your indent <b>${indentNo}</b> request has been processed. Here is the list of products you received:</p>
      <p>${productList}</p>
      <p>Please find the attached indent letter.</p>
      <p>Regards,<br>Inventory Team</p>
    `;

    await sendMail(
      [staffEmail],
      `Indent Letter - ${indentNo}`,
      emailContent,
      [{ filename: `${indentNo}.pdf`, path: pdfPath }]
    );

    res.redirect("/inventory-admin/orders/pending");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).send("Failed to process the order.");
  } finally {
    client.release();
  }
};


export const orders = async (req, res) => {
  const result = await pool.query(`
    SELECT c.id AS cart_id, u.name AS staff_name, c.status, c.created_at, c.updated_at,
           p.name AS product_name, ci.quantity
    FROM carts c
    JOIN users u ON u.id = c.staff_id
    JOIN cart_items ci ON ci.cart_id = c.id
    JOIN products p ON ci.product_id = p.id
    WHERE c.status != 'pending'
    ORDER BY c.created_at DESC
  `);

  const grouped = {};
  result.rows.forEach(row => {
    if (!grouped[row.cart_id]) grouped[row.cart_id] = {
      staff_name: row.staff_name,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      items: []
    };
    grouped[row.cart_id].items.push({ name: row.product_name, quantity: row.quantity });
  });

  res.render("inventory-admin/orders", { orders: Object.values(grouped) });
};

