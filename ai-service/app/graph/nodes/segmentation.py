import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_classic.agents import create_tool_calling_agent, AgentExecutor
from app.config import settings
from app.models.segment import MongoPipeline
from app.prompts.segmentation_prompt import SEGMENTATION_PROMPT
from app.graph.state import CRMAgentState
from app.tools.mongo_tools import query_customers_by_pipeline, save_segment
from app.tools.vector_tools import search_segment_profiles
from app.utils.callbacks import post_progress


def segmentation_node(state: CRMAgentState) -> dict:
    post_progress(state["session_id"], "segmentation", "Searching for matching customers...", step="segment")

    plan = state["campaign_plan"]
    criteria = plan.get("segment_criteria", {})
    channel = plan.get("channel_preference", "any")

    # RAG: retrieve similar past segment definitions
    rag_docs_raw = search_segment_profiles.invoke(
        f"{json.dumps(criteria)} channel:{channel}"
    )
    rag_context = rag_docs_raw if isinstance(rag_docs_raw, str) else json.dumps(rag_docs_raw)

    llm = ChatGoogleGenerativeAI(
        model=settings.gemini_model,
        google_api_key=settings.google_api_key,
        temperature=0.0,
    )

    tools = [query_customers_by_pipeline, save_segment]

    agent = create_tool_calling_agent(llm, tools, SEGMENTATION_PROMPT)
    executor = AgentExecutor(agent=agent, tools=tools, verbose=False, max_iterations=4)

    result = executor.invoke({
        "criteria": json.dumps(criteria),
        "channel": channel,
        "rag_context": rag_context,
        "agent_scratchpad": [],
    })

    # parse agent output to get segment
    output = result.get("output", "{}")
    try:
        segment_data = json.loads(output) if isinstance(output, str) else output
    except Exception:
        segment_data = {"error": output}

    # if agent saved segment, segment_data should have segment_id
    # also get the customer count from the pipeline result
    customer_ids = segment_data.get("customer_ids", [])
    size = segment_data.get("size", len(customer_ids))

    post_progress(
        state["session_id"],
        "segmentation",
        f"Segment created: {size} customers found",
        step="segment",
        data={"size": size},
    )

    return {
        "segment": segment_data,
        "current_step": "create_campaign",
    }
