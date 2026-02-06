import bcrypt from "bcrypt";
import  pool  from "../db/pool.js";


export const showLogin = (req, res) => {
  res.render("login");
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  const result = await pool.query(
    "SELECT * FROM users WHERE email=$1",
    [email]
  );

  if (!result.rows.length) {
    return res.send("Invalid credentials");
  }

  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password);

  if (!valid) {
    return res.send("Invalid credentials");
  }

  req.session.user = {
    id: user.id,
    role: user.role,
    email: user.email,
    name: user.name
  };

  res.redirect(`/${user.role}/dashboard`);
};

export const logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
};
