# quiz/services/neo4j_service.py
from neo4j import GraphDatabase
from neo4j.exceptions import ServiceUnavailable, AuthError, ClientError
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
        self.database = "dsa"

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
        except (ServiceUnavailable, AuthError, ClientError) as e:
            # ClientError covers "label does not exist" warnings.
            print(f"Neo4j Warning/Error: {e}")
            return []
        except Exception as e:
            print(f"Neo4j Unexpected Error: {e}")
            return []

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