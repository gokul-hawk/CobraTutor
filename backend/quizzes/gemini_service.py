import os
import google.generativeai as genai
import json
from .models import Question, Choice

def configure_gemini():
    """Configures the Gemini client with the API key from environment variables."""
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        raise ValueError("GEMINI_API_KEY not found in environment variables.")
    genai.configure(api_key=api_key)

def generate_questions_from_gemini(topic_name: str, num_questions: int = 2) -> list:
    """
    Calls the Gemini API to generate quiz questions for a given topic.
    Parses the response and saves the questions to the database.
    """
    try:
        configure_gemini()
        model = genai.GenerativeModel('gemini-2.5-flash')

        # The prompt is the same as before. It's a high-quality prompt.
        prompt = f"""
        You are an expert Python programming quiz generator.
        Generate {num_questions} unique, multiple-choice quiz questions for the Python topic: "{topic_name}".

        The questions should be at a beginner to intermediate level.
        Each question must have exactly 4 choices.
        Exactly one of the choices must be correct.

        Provide the output in a single, valid JSON array. Each object in the array should follow this exact structure:
        {{
          "question_text": "The text of the question",
          "choices": [
            {{ "text": "Text for choice 1", "is_correct": "False" }},
            {{ "text": "Text for choice 2", "is_correct": "False" }},
            {{ "text": "Text for choice 3", "is_correct": "True" }},
            {{ "text": "Text for choice 4", "is_correct": "False" }}
          ]
        }}
        """

        response = model.generate_content(prompt)
        # Clean up the response to extract only the JSON part
        json_response_text = response.text.strip().replace("```json", "").replace("```", "").strip()
        
        generated_questions_data = json.loads(json_response_text)
        
        newly_created_questions = []
        for q_data in generated_questions_data:
            # Create Choice objects
            choices_list = [Choice(text=c['text'], is_correct=c['is_correct']) for c in q_data['choices']]
            
            # Create and save the Question object
            new_question = Question(
                topic_name=topic_name,
                question_text=q_data['question_text'],
                choices=choices_list,
                question_type="multiple-choice"
            )
            new_question.save()
            newly_created_questions.append(new_question)
            
        return newly_created_questions

    except (json.JSONDecodeError, KeyError) as e:
        print(f"Error parsing Gemini response: {e}")
        # In case of an error, check the raw response to debug the prompt/model output
        if 'response' in locals():
            print(f"Raw response was: {response.text}")
        return []
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return []