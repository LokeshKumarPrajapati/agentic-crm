import json
import asyncio
from langchain_google_genai import ChatGoogleGenerativeAI
from app.config import settings
from app.prompts.personalization_prompt import PERSONALIZATION_PROMPT
from app.graph.state import CRMAgentState
from app.tools.mongo_tools import get_customer_profile
from app.tools.offer_tools import select_best_offer
from app.utils.callbacks import post_progress
from pymongo import MongoClient

_mongo_client = None


def get_db():
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = MongoClient(settings.mongodb_uri)
    return _mongo_client["crm"]


def recommend_product_from_db(top_categories: list) -> str:
    """Fetch a real product from MongoDB matching customer categories."""
    try:
        db = get_db()
        cats = top_categories[:3] if top_categories else []
        query = {"in_stock": True}
        if cats:
            query["category"] = {"$in": cats}
        product = db.products.find_one(query, sort=[("price", -1)])
        if product:
            return product["name"]
    except Exception:
        pass
    return "New Arrivals Collection"


async def personalize_one(
    customer_id: str,
    template: str,
    variant_id: str,
    campaign_goal: str,
    llm: ChatGoogleGenerativeAI,
) -> dict:
    profile_raw = get_customer_profile.invoke(customer_id)
    try:
        profile = json.loads(profile_raw)
    except Exception:
        profile = {}

    # get best offer for this customer + goal
    offer_raw = select_best_offer.invoke({"customer_id": customer_id, "campaign_goal": campaign_goal})
    try:
        offer = json.loads(offer_raw)
    except Exception:
        offer = {"offer_text": "an exclusive discount just for you"}

    name = profile.get("name", "there").split()[0]
    top_cats = profile.get("top_categories", [])
    last_cat = top_cats[0] if top_cats else "your favourites"
    rec_product = recommend_product_from_db(top_cats)
    avg_order = int(profile.get("avg_order_value", 1500))

    chain = PERSONALIZATION_PROMPT | llm

    result = await chain.ainvoke({
        "template_body": template,
        "customer_name": name,
        "last_category": last_cat,
        "top_categories": ", ".join(top_cats[:3]) if top_cats else "fashion",
        "recommended_product": rec_product,
        "avg_order_value": str(avg_order),
        "offer_text": offer.get("offer_text", "an exclusive discount"),
    })

    try:
        data = json.loads(result.content)
    except Exception:
        data = {"message_body": result.content, "subject": None, "personalization_tokens": {}}

    return {
        "customer_id": customer_id,
        "message_body": data.get("message_body", result.content),
        "subject": data.get("subject"),
        "variant_id": variant_id,
        "personalization_tokens": data.get("personalization_tokens", {}),
        "offer_id": offer.get("offer_id"),
        "best_send_hour": 19,
    }


def personalization_node(state: CRMAgentState) -> dict:
    segment = state.get("segment", {})
    campaign_draft = state.get("campaign_draft", {})
    campaign_goal = state.get("campaign_plan", {}).get("goal", "re-engage")
    customer_ids = segment.get("customer_ids", [])[:200]  # cap for demo

    if not customer_ids:
        post_progress(state["session_id"], "personalization", "No customers to personalize", step="personalize")
        return {"personalized_messages": [], "current_step": "select_channel"}

    post_progress(
        state["session_id"],
        "personalization",
        f"Personalizing {len(customer_ids)} messages with AI offers...",
        step="personalize",
    )

    variants = campaign_draft.get("variants", [])

    def get_variant_for_idx(i):
        if len(variants) >= 2:
            return variants[i % 2]
        return variants[0] if variants else {"body": campaign_draft.get("body", ""), "variant_id": "A"}

    llm = ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        google_api_key=settings.google_api_key,
        temperature=0.6,
    )

    async def run_all():
        tasks = []
        for i, cid in enumerate(customer_ids):
            v = get_variant_for_idx(i)
            tasks.append(personalize_one(cid, v.get("body", ""), v.get("variant_id", "A"), campaign_goal, llm))
        return await asyncio.gather(*tasks, return_exceptions=True)

    results = asyncio.run(run_all())
    messages = [r for r in results if isinstance(r, dict)]

    post_progress(
        state["session_id"],
        "personalization",
        f"Personalized {len(messages)} messages",
        step="personalize",
    )

    return {
        "personalized_messages": messages,
        "current_step": "select_channel",
    }
