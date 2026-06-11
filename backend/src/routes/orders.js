const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Customer = require("../models/Customer");

// GET /api/orders
router.get("/", async (req, res, next) => {
  try {
    const { page = 1, limit = 20, customer_id, status } = req.query;
    const filter = {};
    if (customer_id) filter.customer_id = customer_id;
    if (status) filter.status = status;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate("customer_id", "name email")
        .sort({ placed_at: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Order.countDocuments(filter),
    ]);
    res.json({ orders, total });
  } catch (err) {
    next(err);
  }
});

// POST /api/orders — create order + update customer stats
router.post("/", async (req, res, next) => {
  try {
    const order = await Order.create(req.body);

    // denormalize stats onto customer
    const stats = await Order.aggregate([
      { $match: { customer_id: order.customer_id } },
      {
        $group: {
          _id: "$customer_id",
          total_orders: { $sum: 1 },
          ltv: { $sum: "$total" },
          avg_order_value: { $avg: "$total" },
          last_purchase_at: { $max: "$placed_at" },
          categories: { $push: "$items.category" },
        },
      },
    ]);

    if (stats.length) {
      const s = stats[0];
      const flatCategories = s.categories.flat();
      const topCategories = [...new Set(flatCategories)].slice(0, 3);
      await Customer.findByIdAndUpdate(order.customer_id, {
        total_orders: s.total_orders,
        ltv: s.ltv,
        avg_order_value: s.avg_order_value,
        last_purchase_at: s.last_purchase_at,
        top_categories: topCategories,
      });
    }

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
