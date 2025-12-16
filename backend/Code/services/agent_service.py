# services/agent_service.py
import random
import random
import json
import re
from typing import Dict, Any
# from langchain.agents import initialize_agent, Tool, AgentType (REMOVED)
# from langchain.memory import ConversationBufferMemory (REMOVED)
from .gemini_service import GeminiLLM
from Code.models import QuestionB, Plan, TestCase

# Initialize Gemini model
gemini = GeminiLLM()

# ─────────────────────────────
# TOOL 1: Intent classification
# ─────────────────────────────
def decide_intent_tool(user_query: str) -> Dict[str, Any]:
    """
    Uses LLM to understand what the user wants:
    - type: 'plan' | 'Learn'
    - topic: e.g. 'arrays', 'graphs'
    - count: number of questions (1-5)
    - intent: 'practice' | 'interview' | 'explore'
    -company: 'Google' | 'Amazon' | 'Tcs' | 'Practice'
    """
    prompt = f"""
    You are an intelligent study planner. Analyze this user's query and return a JSON describing their intent.

    Example outputs:
    {{"type": "plan", "topic": "arrays", "count": 5, "intent": "interview",company": "Google"}}
    {{"type": "Learn", "topic": "recursion", "count": 1, "intent": "practice","company": "Practice"}}
    {{"type": "plan", "topic": "data structures", "count": 3, "intent": "explore","company": "Tcs"}}
    {{"type": "Learn", "topic": "recursion", "count": 2, "intent": "practice","company": "Practice"}}
    User query: "{user_query}"
    """
    resp = gemini.ask(prompt)
    resp = gemini.ask(prompt)
    try:
        # Robust extraction
        match = re.search(r"\{.*\}", resp, re.DOTALL)
        if match:
             cleaned = match.group()
             return json.loads(cleaned)
        else:
             # Try direct load if no braces found (unlikely but possible)
             return json.loads(resp)
    except Exception as e:
        print(f"Intent parsing error: {e}, Response: {resp}")
        # fallback random defaults
        return {"type": "single", "topic": "general", "count": 1, "intent": "explore"}

# ─────────────────────────────
# TOOL 2: Question generator
# ─────────────────────────────
def generate_question_tool(topic: str, difficulty: str = "medium") -> Dict[str, Any]:
    prompt = f"""
    Generate a {difficulty} coding question about "{topic}".
    Return JSON with keys: title, description, difficulty, testcases: [{{"input_data:string", "expected_output:string"}}].
    """
    resp = gemini.ask(prompt)
    resp = gemini.ask(prompt)
    try:
        match = re.search(r"\{.*\}", resp, re.DOTALL)
        if match:
            cleaned = match.group()
            print("Generated question JSON:", cleaned)
            return json.loads(cleaned)
        else:
            return json.loads(resp)
    except Exception as e:
        print(f"Question parsing error: {e}")
        return {"title": f"{topic} Problem", "description": resp, "difficulty": difficulty, "testcases": []}

# ─────────────────────────────
# TOOL 3: Plan generator
# ─────────────────────────────
def create_plan_tool(topic: str, intent: str, count: int,company:str) -> Dict[str, Any]:
    """
    Generate a learning plan with N question titles or descriptions.
    """
    prompt = f"""
    Create a short coding practice plan for topic '{topic}' (intent: {intent}) with {count} problems with previously asked interview questions in {company}.Collect important questions from the {company}.
    Return JSON: {{"plan":[{{"title":"...","difficulty":"..."}},...]}}
    """
    resp = gemini.ask(prompt)
    resp = gemini.ask(prompt)
    try:
        match = re.search(r"\{.*\}", resp, re.DOTALL)
        if match:
             cleaned = match.group()
             print("Generated plan JSON:", cleaned)
             return json.loads(cleaned)
        else:
             return json.loads(resp)
    except Exception as e:
        print(f"Plan parsing error: {e}")
        return {"plan": [{"title": f"{topic} challenge {i+1}", "difficulty": random.choice(["easy","medium","hard"])} for i in range(count)]}


# build_agent REMOVED

# build_agent Logic Removed


# ─────────────────────────────
# MAIN ENTRY FUNCTION
# ─────────────────────────────
def process_user_query(user_query: str,user):
    """
    Handles full logic — one entry point for the Django view.
    """
    # agent = build_agent() (REMOVED)

    # 1️⃣ Decide intent
    intent_info = decide_intent_tool(user_query)
    print("Intent decided:", intent_info)

    topic = intent_info.get("topic", "general")
    count = int(intent_info.get("count", 1))
    intent = intent_info.get("intent", "practice")
    plan_type = intent_info.get("type", "Learn")
    company = intent_info.get("company","Practice")

    results = []

    # 2️⃣ If plan: generate a study plan and questions
    if plan_type == "plan":
        plan_data = create_plan_tool(topic, intent, count,company)
        print(1,plan_data)
        question_ids = []
        for item in plan_data["plan"]:
            qdata = generate_question_tool(topic, item.get("difficulty", "medium"))
            testcases_data = qdata.get("testcases", [])
            # Fix: Ensure testcases is a list of dicts, Groq might return strings or slightly different format
            if isinstance(testcases_data, str):
                try:
                    testcases_data = json.loads(testcases_data)
                except:
                    testcases_data = []
            
            testcases = []
            for tc in testcases_data:
                # Handle potential key mismatch (input_data vs input)
                inp = tc.get("input_data") or tc.get("input") or ""
                out = tc.get("expected_output") or tc.get("expected") or ""
                testcases.append(TestCase(input_data=inp, expected_output=out))
            qdoc = QuestionB(
                user=user,
                topic=topic,
                title=qdata["title"],
                description=qdata["description"],
                difficulty=qdata.get("difficulty", "medium").lower(),
                testcases=testcases
            )
            print(3,qdata)
            print(33,qdoc._data)
            try:
                qdoc.save()
                print(3333)
                question_ids.append(str(qdoc.id))
                print(333)
                results.append(qdata)
            except Exception as e:
                print("Error saving question:", e)
        print("Generated questions for plan:", question_ids)
        user=user
        try:
            plan_doc = Plan(user=user,intent=intent, topic=topic, questions=question_ids, total_questions=str(count))
            plan_doc.save()
        except Exception as e:
            print("Error saving plan document:", e)
            
        print("Saved plan document:", str(plan_doc.id))
        return {"type": "plan", "plan_id": str(plan_doc.id), "questions": results}
    

    # 3️⃣ Else single question
    else:
        results = []
        for i in range(count):
            qdata = generate_question_tool(topic)
            testcases_data = qdata.get("testcases", [])
            if isinstance(testcases_data, str):
                try:
                   testcases_data = json.loads(testcases_data)
                except:
                   testcases_data = []

            testcases = []
            for tc in testcases_data:
                 inp = tc.get("input_data") or tc.get("input") or ""
                 out = tc.get("expected_output") or tc.get("expected") or ""
                 testcases.append(TestCase(input_data=inp, expected_output=out))
            qdoc = QuestionB(
                user=user,
                topic=topic,
                title=qdata["title"],
                description=qdata["description"],
                difficulty=qdata.get("difficulty", "medium"),
                testcases=testcases
            )
            qdoc.save()
            results.append(qdata)
        return {"type": "single", "question": qdata}
