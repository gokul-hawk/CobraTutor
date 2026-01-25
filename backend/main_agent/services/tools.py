from knowledge_graph.models import Topic
from chatbot.services.groq_service import GroqService
from chatbot.services.persistent_tutor import handle_persistent_chat
from neomodel.exceptions import DoesNotExist
import json

class MainAgentTools:
    def __init__(self):
        self.groq = GroqService()

    def taxonomy_check(self, user_topic):
        """
        1. Uses LLM to canonicalize the topic name (e.g. "Recursion in Python" -> "Recursion").
        2. Queries Neo4j for that topic.
        3. Returns { topic: "...", is_practical: bool, prereqs: [...] }
        """
        
        # Step 1: Canonicalize with LLM
        prompt = f"""
        User Query: "{user_topic}"
        Identify the single most likely Computer Science topic name from this query (e.g. "Binary Search", "Arrays", "Recursion").
        Return ONLY the topic name string.
        """
        try:
            canonical_name = self.groq.generate_content(prompt).strip().replace('"', '')
        except Exception:
            canonical_name = user_topic

        # Step 2: Query Neo4j
        try:
            # Try to find exact match
            topic_node = Topic.nodes.get(name=canonical_name)
            
            # Found it! Get prereqs
            prereqs = [p.name for p in topic_node.prerequisites.all()]
            
            # Determine if practical (heuristic: most topics in our graph are practical)
            # Or we could add a property to the Node model later.
            # For now, let's assume all topics except "History" are practical.
            is_practical = "History" not in canonical_name
            
            return {
                "topic": canonical_name,
                "found_in_db": True,
                "is_practical": is_practical,
                "prereqs": prereqs
            }
            
        except (DoesNotExist, Exception) as e:
            # Topic not in our Knowledge Graph OR connection error.
            # Fallback: Use LLM to hallucinate valid prereqs or just say "General"
            print(f"Topic '{canonical_name}' check failed in Neo4j: {e}")
            
            # Ask LLM if it's a coding topic
            try:
                practical_check = self.groq.generate_content(f"Is '{canonical_name}' a coding topic that requires practice? Answer YES or NO.")
                is_practical = "YES" in practical_check.upper()
            except:
                is_practical = True # Default to True to allow practice
            
            return {
                "topic": canonical_name,
                "found_in_db": False,
                "is_practical": is_practical,
                "prereqs": []
            }

    def assess_prerequisites(self, user, prereqs):
        """
        (Placeholder) If we had the quiz implementation fully wired, this would 
        return specific quiz IDs. For now, it returns the list of names.
        """
        return prereqs

    def chat_with_tutor(self, user, message, context_instruction="", chat_history=""):
        """
        Invokes the LangGraph Agent (Chatbot).
        """
        from .agent_factory import build_agent_executor
        
        agent = build_agent_executor()
        response = agent.invoke({
            "input": message,
            "context_instruction": context_instruction,
            "chat_history": chat_history
        })
        
        return {
            "reply": response["output"],
            "action": response["action"]
        }
