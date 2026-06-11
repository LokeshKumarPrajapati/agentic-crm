import json
from app.graph.state import CRMAgentState
from app.tools.mongo_tools import get_customer_engagement_history, get_customer_profile
from app.utils.callbacks import post_progress

CHANNEL_PRIORITY = ["whatsapp", "sms", "email", "rcs"]


def select_channel_for_customer(customer_id: str, preferred_channel: str) -> dict:
    if preferred_channel and preferred_channel != "auto":
        profile_raw = get_customer_profile.invoke(customer_id)
        try:
            profile = json.loads(profile_raw)
            prefs = profile.get("channel_preferences", {})
            if prefs.get(preferred_channel, True):
                return {
                    "customer_id": customer_id,
                    "channel": preferred_channel,
                    "confidence_score": 0.85,
                    "reason": "campaign channel preference",
                    "best_send_hour": 19,
                }
        except Exception:
            pass

    # use engagement history
    history_raw = get_customer_engagement_history.invoke(customer_id)
    try:
        history = json.loads(history_raw)
        if history:
            best = max(history.items(), key=lambda x: x[1].get("open_rate", 0))
            channel, stats = best
            return {
                "customer_id": customer_id,
                "channel": channel,
                "confidence_score": round(min(stats["open_rate"] / 100, 0.99), 2),
                "reason": f"historical open rate {stats['open_rate']}%",
                "best_send_hour": 19,
            }
    except Exception:
        pass

    # fallback
    try:
        profile = json.loads(get_customer_profile.invoke(customer_id))
        prefs = profile.get("channel_preferences", {})
        for ch in CHANNEL_PRIORITY:
            if prefs.get(ch, False):
                return {
                    "customer_id": customer_id,
                    "channel": ch,
                    "confidence_score": 0.7,
                    "reason": "customer opt-in preference",
                    "best_send_hour": 19,
                }
    except Exception:
        pass

    return {
        "customer_id": customer_id,
        "channel": "email",
        "confidence_score": 0.5,
        "reason": "default fallback",
        "best_send_hour": 19,
    }


def channel_selection_node(state: CRMAgentState) -> dict:
    messages = state.get("personalized_messages", [])
    plan = state.get("campaign_plan", {})
    preferred_channel = plan.get("channel_preference", "auto")

    if not messages:
        return {"channel_assignments": [], "current_step": "execute"}

    post_progress(
        state["session_id"],
        "channel_selection",
        f"Assigning channels + best send times to {len(messages)} customers...",
        step="select_channel",
    )

    assignments = []
    for msg in messages:
        cid = msg.get("customer_id")
        if cid:
            assignment = select_channel_for_customer(cid, preferred_channel)
            # carry over best_send_hour from personalized message if present
            if msg.get("best_send_hour") and assignment.get("best_send_hour") == 19:
                assignment["best_send_hour"] = msg["best_send_hour"]
            assignments.append(assignment)

    channel_counts = {}
    for a in assignments:
        ch = a["channel"]
        channel_counts[ch] = channel_counts.get(ch, 0) + 1

    summary = ", ".join([f"{ch}: {cnt}" for ch, cnt in channel_counts.items()])
    post_progress(
        state["session_id"],
        "channel_selection",
        f"Channel assignments: {summary}",
        step="select_channel",
        data={"channel_breakdown": channel_counts},
    )

    return {
        "channel_assignments": assignments,
        "current_step": "execute",
    }
