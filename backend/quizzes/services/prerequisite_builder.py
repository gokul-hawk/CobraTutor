# services/prerequisite_builder.py

from .neo4j_services import Neo4jService
from .gemini_service import GeminiService

class PrerequisiteBuilder:
    def __init__(self, neo4j_db="dsa"):
        self.neo4j = Neo4jService(database=neo4j_db)
        self.gemini = GeminiService()
        self.visited = set()

    def fetch_prerequisites(self, concept):
        """Fetch prerequisites from Neo4j, fallback to Gemini if not in graph"""
        prereqs = self.neo4j.get_direct_prerequisites(concept)
        if not prereqs:  # fallback
            prereqs = self.gemini.get_prerequisites(concept)
        return prereqs

    def build_chain(self, concept):
        """Recursively expand prerequisites"""
        if concept in self.visited:
            return []
        self.visited.add(concept)

        prereqs = self.fetch_prerequisites(concept)
        chain = []

        for p in prereqs:
            chain.extend(self.build_chain(p))  # expand deeper
            chain.append(p)  # add prereq itself

        return chain
