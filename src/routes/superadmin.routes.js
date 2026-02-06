import express from "express";
import {
  dashboard,
  showCreateUser,
  createUser,
  reports
} from "../controllers/superadmin.controller.js";

import { isAuth } from "../middleware/auth.js";
import { allow } from "../middleware/role.js";

const router = express.Router();

/* Dashboard */
router.get(
  "/dashboard",
  isAuth,
  allow("super-admin"),
  dashboard
);

/* SHOW Create User page */
router.get(
  "/users",
  isAuth,
  allow("super-admin"),
  showCreateUser
);

/* CREATE User (form submit) */
router.post(
  "/users/create",
  isAuth,
  allow("super-admin"),
  createUser
);

/* Reports */
router.get(
  "/reports",
  isAuth,
  allow("super-admin"),
  reports
);

export default router;
