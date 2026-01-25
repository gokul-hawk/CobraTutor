import os
import sys
from unittest.mock import MagicMock, patch

# Mock Django settings BEFORE importing anything that uses them
from django.conf import settings
if not settings.configured:
    settings.configure(
        GROQ_API_KEY="test_key",
        GROQ_MODEL="llama3-70b-8192",
        INSTALLED_APPS=['main_agent'],
        DATABASES={'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}
    )

# Mock knowledge_graph.models
sys.modules["knowledge_graph"] = MagicMock()
sys.modules["knowledge_graph.models"] = MagicMock()
mock_topic_model = MagicMock()
sys.modules["knowledge_graph.models"].Topic = mock_topic_model

# Mock GroqService
sys.modules["chatbot"] = MagicMock()
sys.modules["chatbot.services"] = MagicMock()
sys.modules["chatbot.services.groq_service"] = MagicMock()
MockGroqService = MagicMock()
sys.modules["chatbot.services.groq_service"].GroqService = MockGroqService

# Now import the factory
from main_agent.services.agent_factory import build_agent_executor, check_prerequisites, teach_concept

def test_flow():
    print("--- Starting Mocked Verification ---")

    # Setup Mocks
    # 1. Mock CheckPrerequisites
    # We need to patch the Tool's underlying function or just the tool execution if we could, 
    # but the tool is defined in the module. 
    # Since we use @tool, `check_prerequisites` is a BaseTool.
    # We can mock the `Topic.nodes.get` call inside it.
    
    # Mock Topic.nodes.get
    mock_node = MagicMock()
    mock_node.name = "Variables"
    mock_node.prerequisites.all.return_value = [] # No prerequisites
    mock_topic_model.nodes.get.return_value = mock_node
    
    # Mock GroqService.generate_content
    mock_groq_instance = MockGroqService.return_value
    mock_groq_instance.generate_content.return_value = "Variables are storage containers."
    
    # We also need to mock ChatGroq because we don't want real API keys usage
    with patch("main_agent.services.agent_factory.ChatGroq") as MockChatGroq:
        mock_llm = MockChatGroq.return_value
        
        # Test 1: User asks for Variables. logic: Check prereqs -> return answer?
        # Actually create_react_agent logic is complex to mock purely via LLM output simulation without real LLM.
        # But we can verify the Tools are correct and the Graph is built.
        
        executor = build_agent_executor()
        print("Agent Executor built successfully.")
        
        # We can't easily run the full invoke without a real or simulated LLM that picks tools.
        # Using a mock LLM that returns a ToolCall is possible but verbose.
        # Instead, let's verify the Tools function correctly when called directly.
        
        print("\nTesting Tools directly:")
        
        # Test CheckPrerequisites
        print("Invoking check_prerequisites tool...")
        res = check_prerequisites.invoke("Variables")
        print(f"Result: {res}")
        assert "found, but it has no recorded prerequisites" in res
        
        # Test TeachConcept
        print("Invoking teach_concept tool...")
        res = teach_concept.invoke("Variables")
        print(f"Result: {res}")
        assert "Variables are storage containers" in res
        
        # Test SwitchToCoding
        # We need to import it or get it from the module if we exported it via TOOLS list
        from main_agent.services.agent_factory import switch_to_coding
        print("Invoking switch_to_coding tool...")
        res = switch_to_coding.invoke("Variables")
        print(f"Result: {res}")
        assert "ACTION_TRIGGER:SWITCH_TO_CODE:Variables" in res
        
        print("\nValidation Successful: All tools perform as expected with mocks.")

if __name__ == "__main__":
    try:
        test_flow()
    except Exception as e:
        print(f"Test Failed: {e}")
        import traceback
        traceback.print_exc()
