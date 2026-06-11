const express = require("express");
const router = express.Router();
const Communication = require("../models/Communication");
const Campaign = require("../models/Campaign");
const Customer = require("../models/Customer");
const Order = require("../models/Order");

// GET /api/analytics/overview — dashboard KPIs
router.get("/overview", async (req, res, next) => {
  try {
    const [
      totalCustomers,
      totalCampaigns,
      activeCampaigns,
      recentCommunications,
    ] = await Promise.all([
      Customer.countDocuments(),
      Campaign.countDocuments(),
      Campaign.countDocuments({ status: "running" }),
      Communication.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            delivered: { $sum: { $cond: [{ $in: ["$status", ["delivered", "opened", "clicked", "converted"]] }, 1, 0] } },
            opened: { $sum: { $cond: [{ $in: ["$status", ["opened", "clicked", "converted"]] }, 1, 0] } },
            converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } },
          },
        },
      ]),
    ]);

    const comms = recentCommunications[0] || { total: 0, delivered: 0, opened: 0, converted: 0 };
    res.json({
      total_customers: totalCustomers,
      total_campaigns: totalCampaigns,
      active_campaigns: activeCampaigns,
      total_messages_sent: comms.total,
      overall_open_rate: comms.total ? ((comms.opened / comms.total) * 100).toFixed(1) : 0,
      overall_conversion_rate: comms.total ? ((comms.converted / comms.total) * 100).toFixed(1) : 0,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/campaigns — aggregate all campaigns performance
router.get("/campaigns", async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - Number(days));

    const data = await Communication.aggregate([
      { $match: { created_at: { $gte: since } } },
      {
        $group: {
          _id: "$campaign_id",
          sent: { $sum: 1 },
          opened: { $sum: { $cond: [{ $in: ["$status", ["opened", "clicked", "converted"]] }, 1, 0] } },
          clicked: { $sum: { $cond: [{ $in: ["$status", ["clicked", "converted"]] }, 1, 0] } },
          converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } },
        },
      },
      {
        $lookup: {
          from: "campaigns",
          localField: "_id",
          foreignField: "_id",
          as: "campaign",
        },
      },
      { $unwind: "$campaign" },
      {
        $project: {
          campaign_name: "$campaign.name",
          goal: "$campaign.goal",
          channel: "$campaign.channel",
          sent: 1,
          open_rate: { $multiply: [{ $divide: ["$opened", "$sent"] }, 100] },
          ctr: { $multiply: [{ $divide: ["$clicked", "$sent"] }, 100] },
          conversion_rate: { $multiply: [{ $divide: ["$converted", "$sent"] }, 100] },
        },
      },
      { $sort: { sent: -1 } },
    ]);

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/channel-performance
router.get("/channel-performance", async (req, res, next) => {
  try {
    const data = await Communication.aggregate([
      {
        $group: {
          _id: "$channel",
          total: { $sum: 1 },
          opened: { $sum: { $cond: [{ $in: ["$status", ["opened", "clicked", "converted"]] }, 1, 0] } },
          clicked: { $sum: { $cond: [{ $in: ["$status", ["clicked", "converted"]] }, 1, 0] } },
          converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } },
        },
      },
      {
        $project: {
          channel: "$_id",
          total: 1,
          open_rate: { $multiply: [{ $divide: ["$opened", "$total"] }, 100] },
          ctr: { $multiply: [{ $divide: ["$clicked", "$total"] }, 100] },
          conversion_rate: { $multiply: [{ $divide: ["$converted", "$total"] }, 100] },
        },
      },
    ]);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/roi — per-campaign revenue attributed vs estimated cost
router.get("/roi", async (req, res, next) => {
  try {
    const data = await Communication.aggregate([
      {
        $group: {
          _id: "$campaign_id",
          revenue: { $sum: "$revenue_attributed" },
          sent: { $sum: 1 },
          converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } },
        },
      },
      {
        $lookup: {
          from: "campaigns",
          localField: "_id",
          foreignField: "_id",
          as: "campaign",
        },
      },
      { $unwind: "$campaign" },
      {
        $project: {
          campaign_name: "$campaign.name",
          channel: "$campaign.channel",
          revenue_attributed: "$revenue",
          sent: 1,
          converted: 1,
          estimated_cost: { $multiply: ["$sent", 0.5] },
          roi: {
            $cond: [
              { $gt: [{ $multiply: ["$sent", 0.5] }, 0] },
              { $divide: ["$revenue", { $multiply: ["$sent", 0.5] }] },
              0,
            ],
          },
        },
      },
      { $sort: { roi: -1 } },
    ]);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
