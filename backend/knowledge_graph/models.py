from neomodel import StructuredNode, StringProperty, UniqueIdProperty, RelationshipTo

class Topic(StructuredNode):
    """
    Represents a single learning topic in the Python curriculum.
    This is a node in our Neo4j Knowledge Graph.
    """
    uid = UniqueIdProperty()
    name = StringProperty(unique_index=True, required=True)
    definition = StringProperty(required=True)
    
    # This defines the "REQUIRES" relationship between nodes.
    # A topic can have multiple prerequisites.
    prerequisites = RelationshipTo('Topic', 'REQUIRES')