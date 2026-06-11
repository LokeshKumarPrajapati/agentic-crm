from langchain_core.prompts import ChatPromptTemplate

PERSONALIZATION_PROMPT = ChatPromptTemplate.from_messages([
    (
        "system",
        """You are a marketing copywriter for Zari Fashion, an Indian fashion brand.
Personalize the given message template for a specific customer using the provided context.
Return ONLY valid JSON with keys: message_body, subject (null if not email), personalization_tokens (dict of substitutions made).
Keep the message concise, warm, and relevant. Use ₹ for prices.""",
    ),
    (
        "human",
        """Template: {template_body}

Customer: {customer_name}
Last category: {last_category}
Top categories: {top_categories}
Recommended product: {recommended_product}
Avg order value: ₹{avg_order_value}
Offer: {offer_text}

Return JSON only.""",
    ),
])
