const express = require("express");
const router = express.Router();
const Segment = require("../models/Segment");
const Customer = require("../models/Customer");

// GET /api/segments
router.get("/", async (req, res, next) => {
  try {
    const segments = await Segment.find().sort({ created_at: -1 }).lean();
    res.json(segments);
  } catch (err) {
    next(err);
  }
});

// GET /api/segments/:id
router.get("/:id", async (req, res, next) => {
  try {
    const segment = await Segment.findById(req.params.id).lean();
    if (!segment) return res.status(404).json({ error: "Segment not found" });
    res.json(segment);
  } catch (err) {
    next(err);
  }
});

// GET /api/segments/:id/customers — paginated customers in segment
router.get("/:id/customers", async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const segment = await Segment.findById(req.params.id).lean();
    if (!segment) return res.status(404).json({ error: "Segment not found" });

    const skip = (page - 1) * limit;
    const ids = segment.customer_ids.slice(skip, skip + Number(limit));
    const customers = await Customer.find({ _id: { $in: ids } }).lean();
    res.json({ customers, total: segment.size });
  } catch (err) {
    next(err);
  }
});

// POST /api/segments — manual creation
router.post("/", async (req, res, next) => {
  try {
    const { name, description, criteria_nl, criteria_json } = req.body;
    let customer_ids = [];

    if (criteria_json && Array.isArray(criteria_json)) {
      const results = await Customer.aggregate(criteria_json);
      customer_ids = results.map((r) => r._id);
    }

    const segment = await Segment.create({
      name,
      description,
      criteria_nl,
      criteria_json,
      customer_ids,
      size: customer_ids.length,
      last_refreshed_at: new Date(),
    });

    res.status(201).json(segment);
  } catch (err) {
    next(err);
  }
});

// POST /api/segments/:id/refresh — re-run dynamic criteria
router.post("/:id/refresh", async (req, res, next) => {
  try {
    const segment = await Segment.findById(req.params.id);
    if (!segment) return res.status(404).json({ error: "Segment not found" });

    if (!segment.criteria_json) {
      return res.status(400).json({ error: "No criteria_json to refresh from" });
    }

    const results = await Customer.aggregate(segment.criteria_json);
    segment.customer_ids = results.map((r) => r._id);
    segment.size = segment.customer_ids.length;
    segment.last_refreshed_at = new Date();
    await segment.save();

    res.json({ size: segment.size, refreshed_at: segment.last_refreshed_at });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/segments/:id
router.delete("/:id", async (req, res, next) => {
  try {
    await Segment.findByIdAndDelete(req.params.id);
    res.json({ message: "Segment deleted" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
