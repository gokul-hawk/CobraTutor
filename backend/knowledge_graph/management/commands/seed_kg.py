from django.core.management.base import BaseCommand
from knowledge_graph.models import Topic
from neomodel import db # <-- IMPORT THE 'db' OBJECT

class Command(BaseCommand):
    help = 'Seeds the Neo4j database with initial Python topics and their relationships.'

    def handle(self, *args, **kwargs):
        self.stdout.write('Seeding knowledge graph...')
        
        topics_data = {
            "Data Types": {"definition": "A classification of data which tells the interpreter how to use it.", "prerequisites": []},
            "Variables": {"definition": "A named storage location in memory.", "prerequisites": ["Data Types"]},
            "Strings": {"definition": "A sequence of characters, used to store text.", "prerequisites": ["Data Types"]},
            "Integers": {"definition": "A whole number, positive or negative, without decimals.", "prerequisites": ["Data Types"]},
            "Booleans": {"definition": "Represents one of two values: True or False.", "prerequisites": ["Data Types"]},
            "Lists": {"definition": "An ordered, mutable (changeable) collection of items.", "prerequisites": ["Variables"]},
            "If-Else Statements": {"definition": "Executes a block of code if a specified condition is true, and another block if it is false.", "prerequisites": ["Booleans", "Variables"]},
            "For Loops": {"definition": "Iterates over a sequence (like a list, tuple, dictionary, set, or string).", "prerequisites": ["Lists"]},
            "Functions": {"definition": "A block of organized, reusable code that is used to perform a single, related action.", "prerequisites": ["Variables", "If-Else Statements"]},
        }

        # --- THIS IS THE CORRECTED PART ---
        # Clear existing data using a direct Cypher query for efficiency and compatibility.
        # 'DETACH DELETE' removes nodes and any relationships connected to them.
        self.stdout.write('Clearing all existing topics and relationships...')
        db.cypher_query("MATCH (n:Topic) DETACH DELETE n")
        
        self.stdout.write(self.style.WARNING('Cleared all existing topics.'))

        # Create all topic nodes first
        for name, data in topics_data.items():
            Topic(name=name, definition=data['definition']).save()
        
        self.stdout.write('Created all topic nodes.')

        # Create relationships
        for name, data in topics_data.items():
            topic_node = Topic.nodes.get(name=name)
            for prereq_name in data['prerequisites']:
                prereq_node = Topic.nodes.get(name=prereq_name)
                topic_node.prerequisites.connect(prereq_node)

        self.stdout.write(self.style.SUCCESS('Successfully seeded the knowledge graph with topics and relationships!'))