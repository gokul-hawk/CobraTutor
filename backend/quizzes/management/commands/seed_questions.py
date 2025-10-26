from django.core.management.base import BaseCommand
from quizzes.models import Question, Choice

class Command(BaseCommand):
    help = 'Seeds the MongoDB database with initial quiz questions.'

    def handle(self, *args, **kwargs):
        self.stdout.write('Seeding quiz questions...')

        # Clear existing data
        Question.objects.all().delete()
        self.stdout.write(self.style.WARNING('Cleared all existing questions.'))

        # --- Questions for "Variables" ---
        Question(
            topic_name="Variables",
            question_text="Which of the following is a valid variable name in Python?",
            choices=[
                Choice(text="1variable", is_correct='False'),
                Choice(text="variable_1", is_correct='True'),
                Choice(text="variable-1", is_correct='False'),
                Choice(text="for", is_correct='False')
            ]
        ).save()

        Question(
            topic_name="Variables",
            question_text="What is the primary purpose of a variable in Python?",
            choices=[
                Choice(text="To perform calculations", is_correct='False'),
                Choice(text="To store a value in memory with a name", is_correct='True'),
                Choice(text="To stop the program", is_correct='False'),
            ]
        ).save()
        
        # --- Questions for "Data Types" ---
        Question(
            topic_name="Data Types",
            question_text="What is the data type of the value `10.5`?",
            choices=[
                Choice(text="int", is_correct='False'),
                Choice(text="str", is_correct='False'),
                Choice(text="float", is_correct='True'),
                Choice(text="bool", is_correct='False')
            ]
        ).save()

        # --- Questions for "Lists" ---
        Question(
            topic_name="Lists",
            question_text="Which method is used to add an item to the end of a list?",
            choices=[
                Choice(text="list.add()", is_correct='False'),
                Choice(text="list.push()", is_correct='False'),
                Choice(text="list.append()", is_correct='True'),
                Choice(text="list.insert()", is_correct='False')
            ]
        ).save()

        self.stdout.write(self.style.SUCCESS('Successfully seeded quiz questions!'))