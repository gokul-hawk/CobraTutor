import os
import sys
import unittest
from unittest.mock import MagicMock, patch

# Mock Django setup
from django.conf import settings
if not settings.configured:
    settings.configure(
        NEO4J_URI="bolt://localhost:7687",
        NEO4J_USER="neo4j",
        GROQ_API_KEY="test"
    )

# Mock modules
sys.modules["knowledge_graph"] = MagicMock()
sys.modules["knowledge_graph.models"] = MagicMock()
MockTopic = MagicMock()
sys.modules["knowledge_graph.models"].Topic = MockTopic

# Also mock persistent tutor to avoid django model loading
sys.modules["chatbot.services.persistent_tutor"] = MagicMock()

from main_agent.services.tools import MainAgentTools

class TestToolsRobustness(unittest.TestCase):
    def test_taxonomy_check_exception(self):
        print("\nTesting: taxonomy_check should survive Neo4j connection errors...")
        
        # Setup tool
        tools = MainAgentTools()
        
        # Mock Groq to return "Stack"
        tools.groq = MagicMock()
        tools.groq.generate_content.return_value = "Stack"
        
        # Mock Topic.nodes.get to RAISE massive exception
        MockTopic.nodes.get.side_effect = Exception("CRITICAL NEO4J FAILURE")
        
        # Act
        result = tools.taxonomy_check("Stack")
        
        # Assert
        print(f"Result: {result}")
        self.assertEqual(result["topic"], "Stack")
        self.assertFalse(result["found_in_db"])
        print("PASS: Exception caught and fallback returned.")

if __name__ == "__main__":
    unittest.main()
