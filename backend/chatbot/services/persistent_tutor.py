from django.conf import settings
from chatbot.models import TutorSession
# from chatbot.models import TutorSession
# import google.generativeai as genai (REMOVED)
import os
import json
import re
from .groq_service import GroqService

# Configure Groq
# genai.configure... (REMOVED)
# model = genai.GenerativeModel("gemini-2.5-flash") (REMOVED)
groq_service = GroqService()

def get_or_create_session(user):
    # User is a Mongo Document. We use email as the stable key.
    email = user.email
    session, created = TutorSession.objects.get_or_create(user_email=email)
    return session

def clean_json_response(text):
    text = text.strip()
    text = re.sub(r'```json|```', '', text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None

def generate_subtopics_python(topic):
    prompt = f"""
    You are an expert Python curriculum designer.
    Return 5 sequential learning subtopics for: "{topic}".
    Output strictly a JSON list of strings.
    Example: ["Introduction","What is the usage","What are the problems it solves","How to implement","What are the best practices","Real world implementation"]
    """
    # response = model.generate_content(prompt)
    # subtopics = clean_json_response(response.text)
    text = groq_service.generate_content(prompt)
    subtopics = clean_json_response(text)
    return subtopics or ["Basics", "Intermediate", "Advanced", "Practice", "Summary"]

def teach_content(subtopic):
    prompt = f"""
    You are a friendly Python Tutor.
    Teach the subtopic: "{subtopic}" for a Python beginner.
    - Keep it short and engaging.
    - Include a small code snippet.
    - END with a simple conceptual question to test understanding.
    """
    return groq_service.generate_content(prompt)

def analyze_input(user_input, current_topic, current_subtopic, last_bot_question=None):
    """
    Determine if input is:
    1. ANSWER (to the teaching question)
    2. DOUBT (question about current topic)
    3. SWITCH (request to change topic)
    """
    prompt = f"""
    Context: Python Tutoring.
    Topic: {current_topic}, Subtopic: {current_subtopic}
    Last Bot Message should have asked a question.
    User User Input: "{user_input}"

    Classify the user intent:
    - "ANSWER": If they are answering the question (correctly or incorrectly).
    - "DOUBT": If they are asking for help/explanation or saying "I don't know".
    - "SWITCH": If they clearly ask to learn something else (e.g. "teach me java", "stop").
    - "SKIP": If the user wants to skip the current question or topic (e.g. "skip", "next", "I know this").

    Output JSON:
    {{
      "intent": "ANSWER" | "DOUBT" | "SWITCH" | "SKIP",
      "is_correct": boolean (only if ANSWER, true/false),
      "analysis": "Short reason",
      "reply": "If correct ANSWER: say 'Correct!' and brief check. If incorrect ANSWER: explain why. If DOUBT: answer it clearly."
    }}
    """
    return clean_json_response(groq_service.generate_content(prompt))

def handle_persistent_chat(user, message):
    session = get_or_create_session(user)
    


    # 1. HANDLE SWITCH CONFIRMATION (Legacy internal switch)
    if session.status == "AWAITING_SWITCH_CONFIRMATION":
        if any(w in message.lower() for w in ["yes", "yeah", "ok", "sure", "yup"]):
            new_topic = session.switch_topic_buffer
            session.current_topic = new_topic
            session.subtopics = generate_subtopics_python(new_topic)
            session.current_index = 0
            session.status = "TEACHING"
            session.switch_topic_buffer = None
            session.save()
            
            content = teach_content(session.subtopics[0])
            session.status = "AWAITING_ANSWER"
            session.save()
            return {"reply": f"Ok! Switching to **{new_topic}**.\n\n{content}", "awaiting_reply": True, "is_complete": False}
        else:
            session.status = "AWAITING_ANSWER" # Revert to teaching
            session.switch_topic_buffer = None
            session.save()
            return {"reply": "Cancelled switch. Let's continue with the current topic. What is your answer?", "awaiting_reply": True, "is_complete": False}

    # 2. NEW SESSION / IDLE
    if session.status == "IDLE" or not session.current_topic:
        # IDLE: treat message as new topic request
        topic = message
        session.current_topic = topic
        session.subtopics = generate_subtopics_python(topic)
             
        session.current_index = 0
        session.status = "TEACHING"
        session.save()
        
        content = teach_content(session.subtopics[0])
        session.status = "AWAITING_ANSWER"
        session.save()
        
        # Format subtopics list
        subtopics_list = "\n".join([f"{i+1}. {sub}" for i, sub in enumerate(session.subtopics)])
        
        return {
            "reply": f"Let's learn **{topic}**! Here is the plan:\n\n{subtopics_list}\n\n---\n\n{content}", 
            "awaiting_reply": True, 
            "is_complete": False
        }

    # 3. TEACHING FLOW
    # Check bounds
    if session.current_index >= len(session.subtopics):
        # Already done?
        return {"reply": "Topic completed.", "awaiting_reply": False, "is_complete": True}

    current_sub = session.subtopics[session.current_index]
    
    # Analyze Intent
    analysis = analyze_input(message, session.current_topic, current_sub)
    if not analysis:
        return {"reply": "I didn't catch that. Could you repeat?", "awaiting_reply": True, "is_complete": False}
        
    intent = analysis.get("intent")
    
    if intent == "SWITCH": 
        session.switch_topic_buffer = message 
        session.status = "AWAITING_SWITCH_CONFIRMATION"
        session.save()
        return {"reply": f"Are you sure you want to stop learning **{session.current_topic}** and switch topics?", "awaiting_reply": True, "is_complete": False}
        
    if intent == "DOUBT":
        # Answer doubt, do not advance
        return {"reply": analysis.get("reply"), "awaiting_reply": True, "is_complete": False}
        
    if intent == "SKIP":
        session.current_index += 1
        if session.current_index >= len(session.subtopics):
            session.status = "IDLE"
            session.save()
            return {"reply": "Skipped to end. Topic completed!", "awaiting_reply": False, "is_complete": True}
        
        next_sub = session.subtopics[session.current_index]
        session.save()
        content = teach_content(next_sub)
        return {"reply": f"Skipping ahead!\n\n{content}", "awaiting_reply": True, "is_complete": False}

    if intent == "ANSWER":
        if analysis.get("is_correct"):
            # Move to next
            session.current_index += 1
            if session.current_index >= len(session.subtopics):
                session.status = "IDLE"
                # session.current_topic = None # Be careful clearing this if Orchestrator needs to know we finished
                session.save()
                return {
                    "reply": f"{analysis.get('reply')}\n\n🎉 Fantastic! You've mastered **{session.current_topic}**!", 
                    "awaiting_reply": False, 
                    "is_complete": True
                }
            
            next_sub = session.subtopics[session.current_index]
            session.status = "TEACHING"
            session.save()
            content = teach_content(next_sub)
            session.status = "AWAITING_ANSWER"
            session.save()
            
            success_msg = f"Great job understanding **{current_sub}**!"
            return {"reply": f"{analysis.get('reply')}\n\n{success_msg}\n\nMoving on:\n\n{content}", "awaiting_reply": True, "is_complete": False}
        else:
            # Incorrect
            return {"reply": f"{analysis.get('reply')}\n\nTry again?", "awaiting_reply": True, "is_complete": False}

    return {"reply": "I'm confused. Let's continue.", "awaiting_reply": True, "is_complete": False}
