import express from "express";
import {
  dashboard,
  addToCart,
  viewCart,
  submitCart,
 removeFromCart,
 increaseQty,
 decreaseQty
} from "../controllers/staff.controller.js";

import { isAuth } from "../middleware/auth.js";
import { allow } from "../middleware/role.js";

const router = express.Router();

/* Dashboard (Search + Pagination) */
router.get(
  "/dashboard",
  isAuth,
  allow("staff"),
  dashboard
);

/* Add to Cart */
router.post(
  "/cart/add",
  isAuth,
  allow("staff"),
  addToCart
);

/* View Cart */
router.get(
  "/cart",
  isAuth,
  allow("staff"),
  viewCart
);

/* Submit Cart (Indent) */
router.post(
  "/cart/submit",
  isAuth,
  allow("staff"),
  submitCart
);

router.post(
  "/cart/remove/:cart_item_id",
  isAuth,
  allow("staff"),
  removeFromCart
);

/* Increase quantity */
router.post(
  "/cart/increase/:cart_item_id",
  isAuth,
  allow("staff"),
  increaseQty
);

/* Decrease quantity */
router.post(
  "/cart/decrease/:cart_item_id",
  isAuth,
  allow("staff"),
  decreaseQty
);

export default router;
