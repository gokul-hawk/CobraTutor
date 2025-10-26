# quiz/services/quiz_utils.py
import re

def normalize_text(s: str) -> str:
    """
    Normalize a text for comparison:
    - lowercase
    - strip whitespace and surrounding quotes
    - remove leading option labels like "A)", "a.", "Option A:", "B -", etc.
    - collapse whitespace
    """
    if s is None:
        return ""
    s = str(s).strip()
    # remove surrounding quotes
    s = re.sub(r'^["\']|["\']$', '', s)
    s = s.lower()
    # remove leading "option" + letter patterns, or letter + punctuation
    s = re.sub(r'^(?:option\s*)?[a-z]\s*[\)\.\:\-]?\s*', '', s)
    # also cover forms like "(A) text" or "A) text"
    s = re.sub(r'^\(?[a-z]\)?\s*[\)\.\:\-]?\s*', '', s)
    # collapse whitespace
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def is_answer_correct(submitted: str, correct: str, options: list) -> bool:
    """
    Robust check whether the submitted answer corresponds to the correct answer.
    - `submitted` is value posted by frontend
    - `correct` is Question.correct_answer from DB (free text from Gemini usually)
    - `options` is list of option strings
    We compare normalized texts and intelligently handle labels (A, B, etc).
    """
    sub = normalize_text(submitted)
    cor = normalize_text(correct)

    # Direct normalized equality
    if sub == cor:
        return True

    # Build normalized map of options -> original
    norm_opts = {normalize_text(opt): opt for opt in options}

    # If submitted matches an option text
    if sub in norm_opts:
        return sub == cor

    # If submitted is a single letter (A/B/C or a/b)
    m = re.match(r'^[\s]*([a-zA-Z])[\s]*$', submitted or "")
    if m:
        label = m.group(1).lower()
        # Try to map label to an option by checking leading letters in options
        for opt in options:
            # If option itself contains a label like "A) Paris" or "B. Paris", extract it
            mm = re.match(r'^\s*([a-zA-Z])[\)\.\:\-]?\s*(.*)$', opt)
            if mm and mm.group(1).lower() == label:
                opt_text = normalize_text(mm.group(2))
                return opt_text == cor
        # else maybe "A" means first option
        if len(options) >= 1:
            try:
                idx = ord(label) - ord('a')
                if 0 <= idx < len(options):
                    return normalize_text(options[idx]) == cor
            except Exception:
                pass

    # If correct is labeled but options are plain (e.g., correct stored "B) Paris" while options ["Paris", ...])
    # Compare normalized correct against normalized options:
    for norm_opt in norm_opts:
        if norm_opt == cor:
            # if submitted equals that option (normalized), we already returned earlier
            if sub == norm_opt:
                return True

    # Fallback: if submitted string contains the correct string
    if cor and cor in sub:
        return True

    return False
