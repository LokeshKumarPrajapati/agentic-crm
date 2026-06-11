const express = require("express");
const router = express.Router();
const Campaign = require("../models/Campaign");
const Communication = require("../models/Communication");
const Analytics = require("../models/Analytics");

// GET /api/campaigns
router.get("/", async (req, res, next) => {
  try {
    const { status, goal, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (goal) filter.goal = goal;

    const [campaigns, total] = await Promise.all([
      Campaign.find(filter)
        .populate("segment_id", "name size")
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Campaign.countDocuments(filter),
    ]);
    res.json({ campaigns, total });
  } catch (err) {
    next(err);
  }
});

// GET /api/campaigns/:id
router.get("/:id", async (req, res, next) => {
  try {
    const campaign = await Campaign.findById(req.params.id)
      .populate("segment_id", "name size criteria_nl")
      .lean();
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

// POST /api/campaigns — manual campaign creation
router.post("/", async (req, res, next) => {
  try {
    const campaign = await Campaign.create(req.body);
    res.status(201).json(campaign);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/campaigns/:id/status
router.patch("/:id/status", async (req, res, next) => {
  try {
    const { status } = req.body;
    const campaign = await Campaign.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    );
    if (!campaign) return res.status(404).json({ error: "Campaign not found" });

    // emit real-time update
    req.io.emit("campaign:status_changed", { campaign_id: campaign._id, status });
    res.json(campaign);
  } catch (err) {
    next(err);
  }
});

// GET /api/campaigns/:id/analytics
router.get("/:id/analytics", async (req, res, next) => {
  try {
    const analytics = await Analytics.findOne({ campaign_id: req.params.id }).lean();
    if (!analytics) {
      // compute on the fly from communications
      const pipeline = [
        { $match: { campaign_id: require("mongoose").Types.ObjectId.createFromHexString(req.params.id) } },
        {
          $group: {
            _id: "$campaign_id",
            sent: { $sum: 1 },
            delivered: { $sum: { $cond: [{ $in: ["$status", ["delivered", "opened", "clicked", "converted"]] }, 1, 0] } },
            opened: { $sum: { $cond: [{ $in: ["$status", ["opened", "clicked", "converted"]] }, 1, 0] } },
            clicked: { $sum: { $cond: [{ $in: ["$status", ["clicked", "converted"]] }, 1, 0] } },
            converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
          },
        },
      ];
      const [raw] = await Communication.aggregate(pipeline);
      if (!raw) return res.json({ funnel: {} });

      const funnel = {
        sent: raw.sent,
        delivered: raw.delivered,
        delivered_rate: raw.sent ? (raw.delivered / raw.sent) * 100 : 0,
        opened: raw.opened,
        open_rate: raw.sent ? (raw.opened / raw.sent) * 100 : 0,
        clicked: raw.clicked,
        ctr: raw.sent ? (raw.clicked / raw.sent) * 100 : 0,
        converted: raw.converted,
        conversion_rate: raw.sent ? (raw.converted / raw.sent) * 100 : 0,
        failed: raw.failed,
      };
      return res.json({ funnel });
    }
    res.json(analytics);
  } catch (err) {
    next(err);
  }
});

// GET /api/campaigns/:id/communications — paginated
router.get("/:id/communications", async (req, res, next) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    const filter = { campaign_id: req.params.id };
    if (status) filter.status = status;

    const [comms, total] = await Promise.all([
      Communication.find(filter)
        .populate("customer_id", "name email phone")
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      Communication.countDocuments(filter),
    ]);
    res.json({ communications: comms, total });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
