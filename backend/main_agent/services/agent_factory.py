import os
import json
from typing import Annotated, Literal, TypedDict, Union, List

from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage, AIMessage, BaseMessage
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.graph.message import add_messages
from django.conf import settings
from neomodel.exceptions import DoesNotExist

from knowledge_graph.models import Topic
from chatbot.services.groq_service import GroqService

# --- Tools ---

@tool
def check_prerequisites(topic_name: str) -> str:
    """
    Checks the Knowledge Graph for prerequisites of a given topic.
    Returns a string list of prerequisites.
    Use this tool FIRST when a user asks about a specific topic.
    """
    try:
        node = Topic.nodes.get(name=topic_name)
        prereqs = [p.name for p in node.prerequisites.all()]
        if not prereqs:
            return f"Topic '{topic_name}' found, but it has no recorded prerequisites in the database."
        return f"Prerequisites for '{topic_name}': {', '.join(prereqs)}"
    except DoesNotExist:
        return f"Topic '{topic_name}' was not found in the Knowledge Graph. It might be a new or specific topic."
    except Exception as e:
        return f"Error checking prerequisites: {str(e)}"

@tool
def teach_concept(query: str) -> str:
    """
    Generates a concise teaching explanation for a concept.
    Use this to explain concepts to the user.
    """
    try:
        groq = GroqService()
        prompt = f"Teach this concept to a beginner in Python: {query}. Be concise and clear."
        return groq.generate_content(prompt)
    except Exception as e:
        return f"Error teaching concept: {str(e)}"

@tool
def switch_to_coding(problem_topic: str) -> str:
    """
    Activates the Coding Environment for the user to practice the given topic.
    Use this when the user understands the concept and is ready to code.
    """
    return f"ACTION_TRIGGER:SWITCH_TO_CODE:{problem_topic}"

@tool
def switch_to_debugging(problem_topic: str) -> str:
    """
    Activates the Debugging Environment for the user to practice fixing bugs.
    Use this when the user wants to practice debugging.
    """
    return f"ACTION_TRIGGER:SWITCH_TO_DEBUG:{problem_topic}"

@tool
def switch_to_quiz(topic: str) -> str:
    """
    Activates the Quiz Module for the user to take a quiz on the given topic.
    Use this when the user asks for a quiz or practice questions.
    """
    return f"ACTION_TRIGGER:SWITCH_TO_QUIZ:{topic}"

@tool
def generate_learning_plan(topic: str) -> str:
    """
    Generates a structured learning plan for a given topic.
    Returns a JSON string of steps.
    Use this when the user asks to learn a new topic.
    """
    try:
        groq = GroqService()
        prompt = f"""
        Create a learning plan for Python topic: "{topic}".
        Return ONLY a JSON list of steps. No other text.
        
        STANDARD FLOW (Do not deviate):
        1. "check_prereqs": Assess the user's current knowledge and prerequisites using a Quiz.
        2. "teach_prereqs": Address any gaps found in the quiz (Agent will skip if passed).
        3. "teach_content": Teach the main topic efficiently.
        4. "practice_code": Write code to solve a problem related to the topic.
        5. "practice_debug": Fix a buggy version of the code.

        Format:
        [
            {{"step": "check_prereqs", "topic": "{topic} Prerequisites"}},
            {{"step": "teach_prereqs", "topic": "{topic} Gaps"}},
            {{"step": "teach_content", "topic": "{topic}"}},
            {{"step": "practice_code", "topic": "{topic}"}},
            {{"step": "practice_debug", "topic": "{topic} Errors"}}
        ]
        """
        plan_json = groq.generate_content(prompt)
        # Clean JSON if needed
        if "```json" in plan_json:
             plan_json = plan_json.split("```json")[1].split("```")[0].strip()
        elif "```" in plan_json:
             plan_json = plan_json.split("```")[1].split("```")[0].strip()
             
        return f"ACTION_TRIGGER:SET_PLAN:{plan_json}"
    except Exception as e:
        return f"Error generating plan: {str(e)}"

TOOLS = [check_prerequisites, teach_concept, switch_to_coding, switch_to_debugging, switch_to_quiz, generate_learning_plan]

# --- State ---

class AgentState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]

# --- Graph Definition ---

def create_agent_graph():
    api_key = getattr(settings, "GROQ_API_KEY", None) or os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY is not set.")

    # Initialize LLM with tool binding
    model_name = getattr(settings, "GROQ_MODEL", "llama-3.3-70b-versatile")
    llm = ChatGroq(
        api_key=api_key,
        model_name=model_name,
        temperature=0.7
    )
    llm_with_tools = llm.bind_tools(TOOLS)

    def agent_node(state: AgentState):
        return {"messages": [llm_with_tools.invoke(state["messages"])]}

    builder = StateGraph(AgentState)
    builder.add_node("agent", agent_node)
    builder.add_node("tools", ToolNode(TOOLS))

    builder.add_edge(START, "agent")
    builder.add_conditional_edges(
        "agent",
        tools_condition,
    )
    builder.add_edge("tools", "agent")

    return builder.compile()

# --- Wrapper for Compatibility ---

class LangGraphAgentWrapper:
    def __init__(self):
        self.graph = create_agent_graph()
        
    def invoke(self, inputs):
        user_input = inputs.get("input")
        chat_history_str = inputs.get("chat_history", "No history.")
        
        context_instruction = inputs.get("context_instruction", "")
        
        system_prompt = f"""You are the "Main Agent Orchestrator" for CobraTutor.
You are NOT just a chatbot. You are the MANAGER of the student's learning path.
YOUR GOAL: actively manage and "Decide the Flow" of the lesson.

CONTEXT: {context_instruction}

AVAILABLE MODULES:
1. **Coding Environment**: For writing/running code. (Tool: switch_to_coding)
2. **Debugger**: For fixing buggy code. (Tool: switch_to_debugging)
3. **Concept Explorer (Quiz)**: For testing knowledge. (Tool: switch_to_quiz)
4. **Plan Generator**: To create a lesson plan. (Tool: generate_learning_plan)

RULES:
1. **PRIORITY**: If the context instructions say "Generate a learning plan", you MUST call `generate_learning_plan(topic)` immediately. Do NOT explain the topic first.
2. If the user asks for a topic and you don't have a plan, call `generate_learning_plan`.
3. If prerequisites are missing, teach them first.
4. **CRITICAL**: If the user asks to "practice", "code", "debug", or "quiz", YOU MUST USE THE CORRESPONDING TOOL.
   - Do NOT just say "Okay, let's practice". You MUST call `switch_to_coding` or `switch_to_quiz`.
   - **NEVER** provide Markdown links like `[Click here](/coding)`. The user cannot navigate manually. You MUST use the tool.
5. **CRITICAL**: If the `Context` tells you to say a keyword (like 'TEACH_DONE') or trigger a tool, DO IT IMMEDIATELY. Do NOT ask check-in questions like "Do you understand?" or "What next?". Just assume success and output the keyword.
"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Here is the chat history so far:\n{chat_history_str}"),
            HumanMessage(content=user_input)
        ]
        
        # Run graph
        result = self.graph.invoke({"messages": messages})
        
        # Extract last message
        messages_out = result["messages"]
        last_message = messages_out[-1]
        output_text = last_message.content
        
        action = None
        
        # Scan recent messages for tool outputs containing our trigger
        # We look in reverse to find the most recent trigger
        for msg in reversed(messages_out):
            if isinstance(msg, ToolMessage) and "ACTION_TRIGGER:" in str(msg.content):
                trigger_text = str(msg.content)
                # Split only on the prefix, then handle potential colon in data
                try:
                    payload = trigger_text.split("ACTION_TRIGGER:")[1].strip()
                    if ":" in payload:
                        action_type, action_data = payload.split(":", 1)
                        action_type = action_type.strip()
                        action_data = action_data.strip()
                        
                        if action_type == "SWITCH_TO_CODE":
                            action = {
                                "type": "SWITCH_TAB",
                                "view": "code",
                                "data": {"topic": action_data}
                            }
                        elif action_type == "SWITCH_TO_DEBUG":
                             action = {
                                "type": "SWITCH_TAB",
                                "view": "debugger",
                                "data": {"topic": action_data}
                            }
                        elif action_type == "SWITCH_TO_QUIZ":
                             action = {
                                "type": "SWITCH_TAB",
                                "view": "quiz",
                                "data": {"topic": action_data}
                            }
                        elif action_type == "SET_PLAN":
                            # This is an internal action for the Orchestrator
                            action = {
                                "type": "SET_PLAN",
                                "data": action_data # JSON string
                            }
                    break # Found the latest action
                except Exception as e:
                    print(f"Error parsing trigger: {e}")
                    continue

        return {"output": output_text, "action": action}

def build_agent_executor():
    """
    Returns the LangGraph agent wrapper. 
    This function replaces the old factory but keeps the same name for compatibility.
    """
    return LangGraphAgentWrapper()
