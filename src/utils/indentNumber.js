export const generateIndentNumber = async (pool) => {
  const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,''); // YYYYMMDD
  const result = await pool.query(
    "SELECT COUNT(*) FROM carts WHERE status='received' AND created_at::date = CURRENT_DATE"
  );
  const count = parseInt(result.rows[0].count) + 1;
  return `KIET${dateStr}/${count}`;
};
