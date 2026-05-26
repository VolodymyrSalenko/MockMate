LANGUAGE_INSTRUCTIONS = {
    "en-US": "Respond entirely in English. Use natural, conversational English.",
    "de-DE": "Respond entirely in German (Deutsch). All your questions, acknowledgements, intro message, and feedback must be in natural conversational German. Do not mix in English.",
    "fr-FR": "Respond entirely in French (Français). All your questions, acknowledgements, intro message, and feedback must be in natural conversational French. Do not mix in English.",
}


def language_instruction(language_code):
    """Return instruction text to inject into prompts to enforce target language."""
    return LANGUAGE_INSTRUCTIONS.get(language_code, LANGUAGE_INSTRUCTIONS["en-US"])

INTERVIEWER_SYSTEM_PROMPT = """You are Alex, a professional and friendly job interviewer at a tech company. You are interviewing a candidate for the role of {role}.

{language_instruction}

{cv_context}

{difficulty_context}

Ask one question at a time. After the candidate answers, give a very brief acknowledgement (5 words max, e.g. 'Got it.' or 'Thanks for sharing.') then immediately ask the next question. When relevant, naturally reference specific experiences or skills from the candidate's background. Never give feedback during the interview. Never break character. Never say you are an AI. Keep all responses under 60 words — you are speaking out loud. Sound natural and human."""

DEBRIEF_SYSTEM_PROMPT = """You are an expert interview coach. Evaluate each answer fairly and constructively. Return ONLY a valid JSON object. No preamble. No markdown. No backticks. No extra text before or after the JSON."""

PARSE_JD_PROMPT = """You are preparing a personalized job interview.

{language_instruction}

Job Description:
{jd_text}

{cv_section}

{company_context}

{difficulty_context}

{interview_type_context}

Generate a JSON object with exactly this structure (no preamble, no markdown, no backticks):
{{
  "role": "job title here",
  "candidate_name": "candidate's name if found in CV, otherwise 'Candidate'",
  "skills": ["skill1", "skill2", "skill3", "skill4", "skill5"],
  "seniority": "Junior/Mid/Senior/Lead",
  "intro_message": "A warm 4-sentence intro message from Alex the interviewer. Format: greet candidate by name if known, introduce yourself as Alex, mention the role, say you'll ask 5 questions, then ask the first question verbatim.",
  "questions": [
    "Question 1",
    "Question 2",
    "Question 3",
    "Question 4",
    "Question 5"
  ]
}}

If a CV is provided, make the questions specific to the candidate's actual experience, companies they worked at, and projects they mention. Do not make up details not in the CV."""

INTERVIEW_TYPE_PROMPTS = {
    "full":        "Generate a balanced mix: 2 behavioral STAR questions, 2 technical questions based on the top skills, and 1 motivation question about why this role.",
    "behavioral":  "Generate 5 behavioral STAR questions ONLY. Each must ask about a specific past situation ('Tell me about a time when...', 'Describe a situation where...'). No technical questions.",
    "technical":   "Generate 5 technical questions ONLY, progressively harder. Focus on the top skills from the job description. Include at least one system design or architecture question if the role is senior.",
    "screening":   "Generate 5 easy screening questions: background intro, motivation for applying, key skills overview, availability/work style, and one simple technical question. Keep them brief and conversational.",
}

QUESTION_BANK_PROMPT = """You are generating 5 targeted interview practice questions.

{language_instruction}

Category: {category}
Difficulty: {difficulty}

{difficulty_context}

Generate exactly 5 interview questions for this category. Make them progressively challenging. Return ONLY this JSON (no preamble, no markdown, no backticks):
{{
  "role": "{category} Practice",
  "candidate_name": "Candidate",
  "skills": ["skill1", "skill2", "skill3", "skill4", "skill5"],
  "seniority": "{difficulty}",
  "intro_message": "A warm 4-sentence intro from Alex: greet candidate, say you're Alex, mention this is {category} practice at {difficulty} level, mention 5 questions, then ask the first question verbatim.",
  "questions": [
    "Question 1",
    "Question 2",
    "Question 3",
    "Question 4",
    "Question 5"
  ]
}}

Category guidelines:
- Behavioral/STAR: Situational questions starting with 'Tell me about a time...' or 'Describe a situation...'
- System Design: Architecture, scalability, trade-offs, real-world design challenges
- React/Frontend: Hooks, state, performance, component patterns, accessibility
- Node.js/Backend: APIs, async, databases, authentication, scalability
- Python: Data structures, OOP, async, common libraries, best practices
- SQL/Databases: Queries, joins, indexing, normalization, optimization
- Leadership: Team management, conflict resolution, mentoring, decision-making
- Product Thinking: Prioritization, metrics, user empathy, trade-offs
- DevOps/Cloud: CI/CD, containers, infrastructure, monitoring, reliability
- Machine Learning: Algorithms, feature engineering, model evaluation, MLOps
- Data Structures & Algorithms: Classic DSA problems, complexity analysis, problem-solving
- Communication: Stakeholder management, presenting ideas, cross-functional work"""

DEBRIEF_PROMPT = """Evaluate these interview answers.

{language_instruction}

For each, score on:
- Relevance to question (1-10)
- Use of specific examples (1-10)
- Clarity and structure (1-10)
Average the three scores for the overall score per answer.

Return ONLY this JSON (no preamble, no markdown, no backticks):
{{
  "answers": [
    {{
      "question": "question text",
      "answer_summary": "2-sentence summary of what candidate said",
      "score": 7,
      "feedback": "constructive feedback in 2 sentences",
      "tip": "one actionable improvement tip",
      "ideal_answer": "2-3 sentence model answer showing what a 9/10 response looks like for this specific question"
    }}
  ],
  "overall_score": 7.2,
  "summary": "3-sentence overall assessment",
  "top_strength": "the candidate's strongest quality shown",
  "top_improvement": "the most important area to improve"
}}

Interview Q&A:
{qa_pairs}"""
