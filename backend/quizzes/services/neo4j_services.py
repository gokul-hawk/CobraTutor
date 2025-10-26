from neo4j import GraphDatabase
from django.conf import settings

class Neo4jService:
    def __init__(self, database=None):
        """
        database: Optional[str] → specify Neo4j database name. 
        If None, uses default database.
        """
        self.driver = GraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
        )
        self.database = "dsa"  # e.g., "concepts_db"

    def close(self):
        self.driver.close()

    def get_direct_prerequisites(self, concept_name):
        query = """
        MATCH (c:Concept {name:$concept})-[:REQUIRES]->(p)
        RETURN p.name AS prerequisite
        """
        with self.driver.session(database=self.database) as session:
            result = session.run(query, concept=concept_name)
            return [record["prerequisite"] for record in result]

    def get_all_prerequisites(self, concept_name):
        query = """
        MATCH (c:Concept {name:$concept})-[:REQUIRES*]->(p)
        RETURN DISTINCT p.name AS prerequisite
        """
        with self.driver.session(database=self.database) as session:
            result = session.run(query, concept=concept_name)
            return [record["prerequisite"] for record in result]
