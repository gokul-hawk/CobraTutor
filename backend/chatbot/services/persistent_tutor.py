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
    if not text:
        return None
    text = text.strip()
    
    # 1. Remove <think> blocks if present
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()
    
    # 2. Extract JSON from code blocks if present
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()
    
    # 3. Last resort: regex find JSON object
    # Try array first then object
    json_match = re.search(r"(\{|\[).+(\}|\])", text, re.DOTALL)
    if json_match:
        text = json_match.group()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        print(f"JSON Parse Error: {text}")
        return None

def generate_subtopics_python(topic):
    prompt = f"""
    You are an expert Computer Science Curriculum Designer for strictly python.
    Create a highly structured, emoji-rich learning roadmap for "{topic}".
    
    Structure the roadmap into Levels (Level 1, Level 2, etc.) progressing for Beginner.
    
    Output strictly a JSON object with two keys:
    1. "roadmap_md": A string containing the beautiful Markdown representation.
       - Use headers "🟢 {topic.upper()} COMPLETE ROADMAP".
       - Use "Level X - Title" format.
       - Use bullet points with formatting.
       - Mark important concepts with "🔥".
    
    2. "steps": A flat list of strings representing the granular individual lessons to teach.
       - Each string should correspond to a sub-bullet in your roadmap.
       - This list will be used by the teaching bot to iterate 1-by-1.
       
    Example Output Format:
    {{
      "roadmap_md": "🟢 STACK ROADMAP\\n\\nLevel 1 - Basics\\n* Definition\\n* LIFO Principle...",
      "steps": ["Stack Definition", "LIFO Principle", "Push/Pop Operations", ...]
    }}
    """
    text = groq_service.generate_content(prompt)
    data = clean_json_response(text)
    
    if data and "roadmap_md" in data and "steps" in data:
        return data["roadmap_md"], data["steps"]
    
    # Fallback
    fallback_steps = data if isinstance(data, list) else ["Basics", "Core Concepts", "Advanced", "Summary"]
    fallback_md = f"**{topic} Roadmap**\n\n" + "\n".join([f"* {s}" for s in fallback_steps])
    return fallback_md, fallback_steps

def teach_content(subtopic, style="Socratic"):
    style_instruction = ""
    if style == "socratic":
         style_instruction = "Style: SOCRATIC. Do NOT give the answer. Ask guiding questions to lead the user to understanding."
    elif style == "practical":
         style_instruction = "Style: PRACTICAL. minimal theory. Show code immediately and explain line-by-line."
    elif style == "analogy":
         style_instruction = "Style: ANALOGY-HEAVY. Use real-world metaphors for everything."
    else:
         style_instruction = "Style: EXPERT TEACHER. Balanced theory, analogy, and code."

    prompt = f"""
    You are an expert Computer Science teacher with 20 years of experience who is Humorous and jokeful in nature. And YOu are strictly a python Tutor IF asked for any other subject just say It is not our course.
    Topic: "{subtopic}"
    {style_instruction}

    Your goal is to teach this specific subtopic clearly and effectively.
    
    OUTPUT FORMAT:
    Please provide the response in two clearly marked blocks. Do not use JSON.
    
    [CONTENT]
    (Your explanation text here. Use markdown for formatting.)
    [/CONTENT]
    
    [VISUALIZATION]
    (Your complete, self-contained HTML/JS code here, starting with <!DOCTYPE html>.)
    (If no visualization is suitable, leave this block empty.)
    [/VISUALIZATION]
    
    Guidelines for Content:
    1. Teach the content with human-like sentences.
    2. Be a tutor, not a textbook.
    3. Include all important points.
    4. Share personal experience or common pitfalls.
    5. Use humor.
    6. Provide step-by-step guidance.
    7. Adjust depth as needed (definition, example, math).
    8. For algorithms, explain the logic step-by-step.
    9.Heavily comment the coding programs as tutor explaining everyline why it is needed and what it do.
    
    Guidelines for Visualization:
    - The HTML will be rendered in a safe iframe.
    - Make it visually appealing (modern, clean).
    - It should help the student UNDERSTAND the concept (e.g., sorting animation, tree traversal).
    - Use clean vanilla JS.
    """
    response_text = groq_service.generate_content(prompt)

    # Parse Blocks using Regex
    content_match = re.search(r'\[CONTENT\](.*?)\[/CONTENT\]', response_text, re.DOTALL)
    viz_match = re.search(r'\[VISUALIZATION\](.*?)\[/VISUALIZATION\]', response_text, re.DOTALL)
    
    content = content_match.group(1).strip() if content_match else response_text
    visualization = viz_match.group(1).strip() if viz_match else None
    
    # Generic cleanup for empty viz
    if visualization and len(visualization) < 20: 
        visualization = None
        
    # Remove any markdown code blocks from viz if present (e.g. ```html ... ```)
    if visualization:
        visualization = re.sub(r'^```html\s*', '', visualization)
        visualization = re.sub(r'^```\s*', '', visualization)
        visualization = re.sub(r'\s*```$', '', visualization)
    
    return {"content": content, "visualization": visualization}

def regenerate_visualization(topic):
    """
    Specifically requests ONLY the visualization for a topic.
    Used when the user clicks 'Regenerate' in the UI.
    """
    prompt = f"""
    You are an Expert Frontend Engineer & CS Educator.
    The user is unsatisfied with the previous visualization for "{topic}". Your goal is to build a STUNNING, INTERACTIVE, and ROBUST visualization.

    REQUIREMENTS:
    1. **Self-Contained**: Must be a single HTML file with embedded CSS/JS.
    2. **Visual Appeal**: Use modern UI. You MAY use TailwindCSS via CDN: <script src="https://cdn.tailwindcss.com"></script>.
    3. **Interactivity**: Include buttons (e.g., "Step", "Play", "Reset") to control the animation.
    4. **Robustness**: Handle edge cases (empty input, etc.). NO PLACEHOLDERS like "// code here". Write the FULL logic.
    5. **Educational**: Show the "State" of the algorithm clearly (e.g., highlighting array indices being compared).

    OUTPUT FORMAT:
    [VISUALIZATION]
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
             /* Custom Animations */
             @keyframes highlight {{ 0% {{ background-color: #fef08a; }} 100% {{ background-color: transparent; }} }}
             .highlight-node {{ animation: highlight 1s ease; }}
        </style>
    </head>
    <body class="bg-slate-50 p-4 font-sans text-slate-800">
        <!-- YOUR UI HERE -->
        <script>
            // YOUR FULL LOGIC HERE
        </script>
    </body>
    </html>
    [/VISUALIZATION]
    """
    response_text = groq_service.generate_content(prompt)
    
    viz_match = re.search(r'\[VISUALIZATION\](.*?)\[/VISUALIZATION\]', response_text, re.DOTALL)
    visualization = viz_match.group(1).strip() if viz_match else None
    
    if visualization:
        visualization = re.sub(r'^```html\s*', '', visualization)
        visualization = re.sub(r'^```\s*', '', visualization)
        visualization = re.sub(r'\s*```$', '', visualization)
        
    return visualization

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
    - "FINISH": If the user says "I am done", "Finish", "Complete this", or "I understand everything".

    Output JSON:
    {{
      "intent": "ANSWER" | "DOUBT" | "SWITCH" | "SKIP" | "FINISH",
      "is_correct": boolean (only if ANSWER, true/false),
      "analysis": "Short reason",
      "reply": "If correct ANSWER: say 'Correct!' and brief check. If incorrect ANSWER: explain why. If DOUBT: answer it clearly."
    }}
    """
    return clean_json_response(groq_service.generate_content(prompt))
    
def start_new_topic(user, topic):
    """
    Forces the Tutor Session to start a new topic immediately.
    Used by Main Agent Orchestrator to sync state.
    """
    session = get_or_create_session(user)
    session.current_topic = topic
    
    # Generate Rich Roadmap
    roadmap_md, steps = generate_subtopics_python(topic)
    session.subtopics = steps
             
    session.current_index = -1 
    session.status = "AWAITING_PLAN_APPROVAL"
    session.switch_topic_buffer = None # Clear any pending switches
    session.save()
    
    return {
        "reply": f"{roadmap_md}\n\n**Shall we proceed with this roadmap?** (Type 'Yes' or suggest edits)", 
        "awaiting_reply": True, 
        "is_complete": False
    }

def handle_persistent_chat(user, message):
    session = get_or_create_session(user)
    


    # 1. HANDLE SWITCH CONFIRMATION (Legacy internal switch)
    if session.status == "AWAITING_SWITCH_CONFIRMATION":
        if any(w in message.lower() for w in ["yes", "yeah", "ok", "sure", "yup"]):
            new_topic = session.switch_topic_buffer
            session.current_topic = new_topic
            session.subtopics = generate_subtopics_python(new_topic)
            # Unpack roadmap
            roadmap_md, steps = generate_subtopics_python(new_topic)
            
            session.current_topic = new_topic
            session.subtopics = steps
            session.current_index = -1
            session.status = "AWAITING_PLAN_APPROVAL"
            session.switch_topic_buffer = None
            session.save()
            
            return {
                "reply": f"Ok! Switching to **{new_topic}**.\n\n{roadmap_md}\n\n**Does this roadmap look good?** (Type 'Yes' to start or suggest changes)", 
                "awaiting_reply": True, 
                "is_complete": False
            }
        else:
            session.status = "AWAITING_ANSWER" # Revert to teaching
            session.switch_topic_buffer = None
            session.save()
            return {"reply": "Cancelled switch. Let's continue with the current topic. What is your answer?", "awaiting_reply": True, "is_complete": False}

    # 2. PLAN APPROVAL FLOW
    if session.status == "AWAITING_PLAN_APPROVAL":
        # Check if user approves or wants changes
        prompt = f"""
        User Input: "{message}"
        Context: The user is reviewing a learning plan.
        Task: Determine if the user is APPROVING (Yes, Ok, Start) or REQUESTING CHANGES.
        Output JSON: {{ "intent": "APPROVE" | "MODIFY", "modification_request": "..." }}
        """
        analysis = clean_json_response(groq_service.generate_content(prompt))
        intent = analysis.get("intent", "APPROVE") if analysis else "APPROVE"
        
        if intent == "APPROVE" or any(w in message.lower() for w in ["yes", "ok", "ready", "start", "good"]):
            session.current_index = 0
            session.status = "TEACHING"
            session.save()
            
            # Determine Style
            style = "expert"
            if "practical" in message.lower(): style = "practical"
            elif "socratic" in message.lower(): style = "socratic"
            elif "analogy" in message.lower(): style = "analogy"
            
            teaching_data = teach_content(session.subtopics[0], style=style)
            content = teaching_data.get("content", "")
            visualization = teaching_data.get("visualization")
            
            session.status = "AWAITING_ANSWER"
            session.save()
            return {
                "reply": f"Great! Let's start with **{session.subtopics[0]}**.\n\n{content}", 
                "visualization": visualization,
                "awaiting_reply": True, 
                "is_complete": False
            }
        else:
            # Modify Plan
            mod_request = analysis.get("modification_request") or message
            
            # Regenerate subtopics with feedback - Request Rich Format again for consistency
            mod_prompt = f"""
            The user wants to modify the roadmap for "{session.current_topic}".
            Current Steps: {json.dumps(session.subtopics)}
            User Feedback: "{mod_request}"
            
            Task: Represents the UPDATED roadmap.
            Output JSON: {{ "roadmap_md": "...", "steps": [...] }}
            """
            text = groq_service.generate_content(mod_prompt)
            data = clean_json_response(text)
            
            if data and "steps" in data:
                session.subtopics = data["steps"]
                session.save()
                roadmap_view = data.get("roadmap_md", "Updated Plan:\n" + "\n".join(data["steps"]))
                
                return {
                    "reply": f"Refined Roadmap based on your feedback:\n\n{roadmap_view}\n\n**Good to go?**", 
                    "awaiting_reply": True, 
                    "is_complete": False
                }
            else:
                 return {"reply": "I couldn't understand how to modify the plan. Could you clarify?", "awaiting_reply": True, "is_complete": False}

    # 3. NEW SESSION / IDLE
    if session.status == "IDLE" or not session.current_topic:
        topic = message
        session.current_topic = topic
        
        # Generate Rich Roadmap
        roadmap_md, steps = generate_subtopics_python(topic)
        session.subtopics = steps
             
        session.current_index = -1 
        session.status = "AWAITING_PLAN_APPROVAL"
        session.save()
        
        return {
            "reply": f"{roadmap_md}\n\n**Shall we proceed with this roadmap?** (Type 'Yes' or suggest edits)", 
            "awaiting_reply": True, 
            "is_complete": False
        }

    # 4. TEACHING FLOW
    
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
        
    if intent == "FINISH":
        session.status = "IDLE"
        session.save()
        return {
            "reply": f"Understood! Marking **{session.current_topic}** as complete.\n\n(Reporting completion to Main Agent...)", 
            "awaiting_reply": False, 
            "is_complete": True
        }

    if intent == "SKIP":
        session.current_index += 1
        if session.current_index >= len(session.subtopics):
            session.status = "IDLE"
            session.save()
            return {"reply": "Skipped to end. Topic completed!", "awaiting_reply": False, "is_complete": True}
        
        next_sub = session.subtopics[session.current_index]
        session.save()
        teaching_data = teach_content(next_sub) 
        content = teaching_data.get("content", "")
        visualization = teaching_data.get("visualization")
        
        return {
            "reply": f"Skipping ahead!\n\n{content}", 
            "visualization": visualization,
            "awaiting_reply": True, 
            "is_complete": False
        }

    if intent == "ANSWER":
        if analysis.get("is_correct"):
            # Move to next
            session.current_index += 1
            if session.current_index >= len(session.subtopics):
                session.status = "IDLE"
                # session.current_topic = None # Be careful clearing this if Orchestrator needs to know we finished
                session.save()
                return {
                    "reply": f"{analysis.get('reply')}\n\n🎉 Fantastic! You've mastered **{session.current_topic}**!\n\n(Reporting completion to Main Agent...)", 
                    "awaiting_reply": False, 
                    "is_complete": True
                }
            
            next_sub = session.subtopics[session.current_index]
            session.status = "TEACHING"
            session.save()
            teaching_data = teach_content(next_sub)
            content = teaching_data.get("content", "")
            visualization = teaching_data.get("visualization")
            
            session.status = "AWAITING_ANSWER"
            session.save()
            
            success_msg = f"Great job understanding **{current_sub}**!"
            return {
                "reply": f"{analysis.get('reply')}\n\n{success_msg}\n\nMoving on:\n\n{content}", 
                "visualization": visualization,
                "awaiting_reply": True, 
                "is_complete": False
            }
        else:
            # Incorrect
            return {"reply": f"{analysis.get('reply')}\n\nTry again?", "awaiting_reply": True, "is_complete": False}

    return {"reply": "I'm confused. Let's continue.", "awaiting_reply": True, "is_complete": False}
