import json
import uuid
import httpx
from app.graph.state import CRMAgentState
from app.tools.mongo_tools import save_communication
from app.utils.callbacks import post_progress
from app.config import settings

BATCH_SIZE = 50


def execution_node(state: CRMAgentState) -> dict:
    messages = state.get("personalized_messages", [])
    assignments = state.get("channel_assignments", [])
    campaign_draft = state.get("campaign_draft", {})
    segment = state.get("segment", {})

    campaign_id = campaign_draft.get("campaign_id")

    if not messages:
        return {"execution_records": [], "current_step": "analyze"}

    # build assignment lookup
    channel_map = {a["customer_id"]: a for a in (assignments or [])}

    post_progress(
        state["session_id"],
        "execution",
        f"Dispatching {len(messages)} messages...",
        step="execute",
    )

    channel_service_url = settings.backend_url.replace(":3001", ":3002")
    backend_url = settings.backend_url

    execution_records = []
    send_batch = []

    for msg in messages:
        customer_id = msg.get("customer_id")
        assignment = channel_map.get(customer_id, {})
        channel = assignment.get("channel", "whatsapp")
        message_id = str(uuid.uuid4())

        send_batch.append({
            "message_id": message_id,
            "recipient": f"customer_{customer_id}",  # anonymized for stubbed service
            "channel": channel,
            "message": msg.get("message_body", ""),
            "campaign_id": campaign_id,
            "customer_id": customer_id,
        })

        # save communication record to MongoDB
        comm_data = json.dumps({
            "campaign_id": campaign_id or "000000000000000000000000",
            "customer_id": customer_id,
            "channel": channel,
            "variant_id": msg.get("variant_id", "A"),
            "personalized_body": msg.get("message_body", ""),
            "channel_message_id": message_id,
        })
        save_communication.invoke(comm_data)

        execution_records.append({
            "customer_id": customer_id,
            "channel": channel,
            "channel_message_id": message_id,
            "status": "queued",
        })

    # dispatch batches to channel service
    sent_count = 0
    failed_count = 0
    for i in range(0, len(send_batch), BATCH_SIZE):
        batch = send_batch[i : i + BATCH_SIZE]
        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(f"{channel_service_url}/send/batch", json={"messages": batch})
                if resp.status_code == 202:
                    sent_count += len(batch)
                else:
                    failed_count += len(batch)
        except Exception as e:
            failed_count += len(batch)
            print(f"Batch send error: {e}")

        post_progress(
            state["session_id"],
            "execution",
            f"Sent {min(i + BATCH_SIZE, len(send_batch))}/{len(send_batch)} messages",
            step="execute",
        )

    # update campaign status in backend
    if campaign_id:
        try:
            with httpx.Client(timeout=10.0) as client:
                client.patch(
                    f"{backend_url}/api/campaigns/{campaign_id}/status",
                    json={"status": "running"},
                )
        except Exception:
            pass

    post_progress(
        state["session_id"],
        "execution",
        f"Dispatched {sent_count} messages. {failed_count} failed.",
        step="execute",
        data={"sent": sent_count, "failed": failed_count},
    )

    return {
        "execution_records": execution_records,
        "current_step": "analyze",
    }
