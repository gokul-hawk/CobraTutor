from ..models import AgentSession
from .tools import MainAgentTools
import json
from chatbot.services.persistent_tutor import handle_persistent_chat

# New Agents
from .router_agent import RouterAgent
from .planner_agent import PlannerAgent
from .director_agent import DirectorAgent
from .tutor_agent import TutorAgent

class MainAgentOrchestrator:
    def __init__(self, user):
        self.user = user
        self.session = AgentSession.objects(user=user).first()
        if not self.session:
            self.session = AgentSession(user=user)
            self.session.save()
            
        # Initialize Sub-Agents
        self.router = RouterAgent()
        self.planner = PlannerAgent()
        self.director = DirectorAgent()
        self.tutor = TutorAgent()

    def process_message(self, message):
        """
        Main entry point. Uses Router to dispatch to specialized agents.
        """
        # 1. Save User Message
        self.session.chat_history.append({"sender": "user", "text": message, "timestamp": str(self.session.updated_at)})
        self.session.save()

        # Build History String for Agents
        try:
            history_str = "\n".join([f"{msg.get('sender', 'unknown').upper()}: {msg.get('text', '')}" for msg in self.session.chat_history[-10:]])
        except:
            history_str = ""

        # 2. Check Plan Status
        # If we have an active plan, we prioritize executing it, UNLESS the user explicitly wants to switch.
        # We can use the Router to check for a "PLAN" intent (switch topic) even during a plan.
        
        intent = self.router.route(message)
        print(f"Orchestrator Route: {intent}")

        # If user wants to start a NEW topic/plan, we interrupt the current one.
        if intent["route"] == "PLAN":
            topic = intent.get("topic") or "General"
            style = intent.get("style") or "comprehensive"
            
            # Reset Plan
            self.session.current_plan = []
            self.session.current_topic = topic
            self.session.failed_prereqs = []
            
            # Generate New Plan
            plan_str = self.planner.create_plan(topic, style)
            try:
                plan = json.loads(plan_str)
                self.session.current_plan = plan
                self.session.save()
                
                # Start immediately
                return self._execute_plan_step(message, history_str)
            except Exception as e:
                reply = f"I tried to create a plan for {topic}, but failed. Let's just chat about it."
                self._save_bot_reply(reply)
                return {"reply": reply, "action": None}

        # If we are currently in a plan, try to advance it or execute steps
        if self.session.current_plan:
            # Check for SKIP intent
            skip_keywords = ["skip", "next", "pass", "move on"]
            if any(k in message.lower() for k in skip_keywords):
                 skipped_step = self.session.current_plan.pop(0)
                 self.session.save()
                 reply = f"Skipping {skipped_step.get('step')}... Moving to next."
                 self._save_bot_reply(reply)
                 # Recursively call to execute the NEXT step immediately
                 return self.process_message("NEXT_STEP_TRIGGER") # Internal trigger

            # Check if the user's message is an "ACTION" that aligns with the current step?
            # Or just blindly continue execution logic.
            return self._execute_plan_step(message, history_str)

        # If NO Plan, and NOT Planning -> Handle based on Route
        if intent["route"] == "ACTION":
            # Direct Action (e.g., "Give me a quiz")
            topic = intent.get("topic") or self.session.current_topic or "General"
            
            action_trigger = self.director.handle(message, topic)
            
            # Parse trigger to standard format
            # Support ACTION_TRIGGER:TYPE:DATA or just ACTION_TRIGGER:TYPE
            clean_trigger = action_trigger.replace("ACTION_TRIGGER:", "").strip()
            parts = clean_trigger.split(":", 1)
            action_type = parts[0]
            action_data = parts[1] if len(parts) > 1 else topic
            
            action_payload = router_action_to_payload(action_type, action_data)
            
            reply = "Opening that for you now."
            self._save_bot_reply(reply)
            return {"reply": reply, "action": action_payload}

        else: # CHAT / DEFAULT
            # Just talk
            reply = self.tutor.handle(message, history_str)
            self._save_bot_reply(reply)
            return {"reply": reply, "action": None}

    def _execute_plan_step(self, message, chat_history):
        """
        Executes the current step in the plan using specialized agents.
        """
        if not self.session.current_plan:
             reply = "Plan completed! What next?"
             self._save_bot_reply(reply)
             return {"reply": reply, "action": None}
             
        current_step = self.session.current_plan[0]
        step_type = current_step.get("step")
        step_topic = current_step.get("topic")
        
        reply = ""
        action = None
        step_complete = False

        # --- STEP DISPATCHER ---
        
        # 1. PREREQUISITE TEACHING (Persistent Logic)
        if step_type == "teach_prereqs":
            # ... (Keep existing complex logic for persistent tutor if valid) ...
            # For simplicity in this refactor, let's delegate to TutorAgent but tracking state is hard.
            # Let's keep using handle_persistent_chat as it manages its own state well.
            started = current_step.get("started", False)
            if not started:
                     current_step["started"] = True
                     self.session.current_plan[0] = current_step
                     self.session.save()
            
            tutor_res = handle_persistent_chat(self.user, message)
            reply = tutor_res.get("reply")
            if tutor_res.get("is_complete"):
                step_complete = True

        # 2. CHECK PREREQS -> Director (Quiz)
        elif step_type == "check_prereqs":
             action_payload = router_action_to_payload("SWITCH_TO_QUIZ", step_topic)
             reply = f"Let's check your knowledge on {step_topic}."
             action = action_payload
             # Mark complete immediately? Or wait for success metric?
             # For flow, let's assume opening it is the 'step', strict completion tracking needs callbacks.
             # We'll rely on the user to say "Next" or "I'm done" effectively, OR simpler loop:
             step_complete = True 

        # 3. TEACH CONTENT -> Tutor Agent
        elif step_type == "teach_content":
             # Use Tutor Agent to explain
             # We inject instruction to explain
             instruction = f"Explain the concept of {step_topic} clearly to the student."
             reply = self.tutor.handle(instruction, chat_history)
             step_complete = True 

        # 4. PRACTICE -> Director
        elif step_type == "practice_code":
             action_payload = router_action_to_payload("SWITCH_TO_CODE", step_topic)
             reply = f"Time to write some code for {step_topic}."
             action = action_payload
             step_complete = True

        elif step_type == "practice_debug":
             action_payload = router_action_to_payload("SWITCH_TO_DEBUG", step_topic)
             reply = f"Let's fix some bugs related to {step_topic}."
             action = action_payload
             step_complete = True

        else:
             # Unknown step
             step_complete = True

        # Advance Plan
        if step_complete:
            self.session.last_step_result = {"step": step_type, "status": "delegated"}
            self.session.current_plan.pop(0)
            self.session.save()
            
            # If we just auto-completed a bunch of director actions, we might want to stop?
            # Or chaining?
            # If we chained multiple steps, we'd just dump multiple actions which isn't supported well.
            # So generally we assume one action per turn.
            
            if self.session.current_plan:
                reply += f"\n\n(Moving to next step: {self.session.current_plan[0]['step']})"

        self._save_bot_reply(reply)
        return {"reply": reply, "action": action}

    def _save_bot_reply(self, text):
        self.session.chat_history.append({"sender": "bot", "text": text})
        self.session.save()

def router_action_to_payload(action_type, action_data):
    if action_type == "SWITCH_TO_CODE":
        return {"type": "SWITCH_TAB", "view": "code", "data": {"topic": action_data}}
    elif action_type == "SWITCH_TO_DEBUG":
        return {"type": "SWITCH_TAB", "view": "debugger", "data": {"topic": action_data}}
    elif action_type == "SWITCH_TO_QUIZ":
        return {"type": "SWITCH_TAB", "view": "quiz", "data": {"topic": action_data}}
    return None
