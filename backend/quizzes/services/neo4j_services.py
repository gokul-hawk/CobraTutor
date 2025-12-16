# quiz/services/neo4j_service.py
from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable, AuthError
from django.conf import settings
import os
from dotenv import load_dotenv

load_dotenv()

class Neo4jService:
    def __init__(self, database=None):
        self.driver = GraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, os.getenv('NEO4J_PASSWORD'))
        )
        self.database = database or "neo4j"

    def close(self):
        self.driver.close()

    def get_direct_prerequisites(self, concept_name: str):
        query = """
        MATCH (c:Concept {name: $concept})-[:REQUIRES]->(p:Concept)
        RETURN p.name AS prerequisite
        """
        try:
            with self.driver.session(database=self.database) as session:
                result = session.run(query, concept=concept_name)
                return [record["prerequisite"] for record in result]
        except (ServiceUnavailable, AuthError) as e:
            raise Exception(f"Neo4j connection error: {e}")

    def get_all_prerequisites(self, concept_name: str):
        query = """
        MATCH (c:Concept {name: $concept})-[:REQUIRES*]->(p:Concept)
        RETURN DISTINCT p.name AS prerequisite
        """
        try:
            with self.driver.session(database=self.database) as session:
                result = session.run(query, concept=concept_name)
                return [record["prerequisite"] for record in result]
        except (ServiceUnavailable, AuthError) as e:
            raise Exception(f"Neo4j connection error: {e}")