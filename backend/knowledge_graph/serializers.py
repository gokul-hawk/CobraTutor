from rest_framework import serializers

class TopicSerializer(serializers.Serializer):
    """
    Serializer for a single Topic node.
    We use a base Serializer because neomodel objects aren't Django models.
    """
    name = serializers.CharField(max_length=100)
    definition = serializers.CharField()

class PrerequisiteQuizRequestSerializer(serializers.Serializer):
    """
    Serializer to validate the request for starting a prerequisite quiz.
    """
    target_topic_name = serializers.CharField(max_length=100)