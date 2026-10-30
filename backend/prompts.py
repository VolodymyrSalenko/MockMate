LANGUAGE_INSTRUCTIONS = {
    "en-US": "Respond entirely in English. Use natural, conversational English.",
    "de-DE": "Respond entirely in German (Deutsch). All your questions, acknowledgements, intro message, and feedback must be in natural conversational German. Do not mix in English.",
    "fr-FR": "Respond entirely in French (Français). All your questions, acknowledgements, intro message, and feedback must be in natural conversational French. Do not mix in English.",
}


def language_instruction(language_code):
    """Return instruction text to inject into prompts to enforce target language."""
    return LANGUAGE_INSTRUCTIONS.get(language_code, LANGUAGE_INSTRUCTIONS["en-US"])

INTERVIEWER_SYSTEM_PROMPT = """You are {interviewer_name}, a professional and friendly job interviewer at a tech company. You are interviewing a candidate for the role of {role}.

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

First, think like a recruiter: find the 4-8 most important requirements of this job and mark each as "must" (essential) or "nice" (nice to have). If a CV is provided, check how well the CV proves each requirement: "strong" (clear evidence), "weak" (only mentioned or indirectly related) or "none" (not in the CV). Without a CV, use "unknown".

Then write the questions. A good interview question tests one important requirement or competency, so the interviewer learns something real about the candidate.

Generate a JSON object with exactly this structure (no preamble, no markdown, no backticks):
{{
  "role": "job title here",
  "candidate_name": "candidate's name if found in CV, otherwise 'Candidate'",
  "seniority": "Junior/Mid/Senior/Lead",
  "requirements": [
    {{"name": "short requirement, e.g. 'PostgreSQL' or 'Stakeholder communication'", "priority": "must", "cv_evidence": "strong"}}
  ],
  "intro_message": "A warm 4-sentence intro message from {interviewer_name} the interviewer. Format: greet candidate by name if known, introduce yourself as {interviewer_name}, mention the role, say you'll ask {question_count} question(s), then ask the first question verbatim.",
  "questions": [
    {{
      "question": "the question the interviewer asks out loud",
      "competency": "what this question tests, 2-6 words",
      "strong_answer": "one sentence: what a strong answer must contain for this role and level",
      "red_flags": "one sentence: what a weak answer looks like"
    }}
  ]
}}

Important question rules:
- The "questions" list must contain exactly {question_count} question(s).
- Every question must be one concise sentence about ONE thing — no multi-part questions, no "and how/what/why…" add-ons, no long preambles. Spoken questions with two parts confuse candidates; the interviewer can follow up later.
  Bad: "Walk me through your API project — what did you build, and how did you structure the database?"
  Good: "Walk me through the REST API you built for your library project."
- Focus on "must" requirements first. Do not waste questions on minor details.
- If a CV is provided, make questions specific to the candidate's actual experience, companies, and projects. Do not make up details not in the CV.
- If a CV is provided and there are 3 or more questions, at least one question must probe a "must" requirement with "weak" or "none" CV evidence — fairly, e.g. ask about related experience or how they would approach it. This is what real recruiters do.
- "competency", "strong_answer" and "red_flags" are hidden notes for the evaluator; write them in English. Only "question" and "intro_message" follow the language instruction above."""

INTERVIEW_TYPE_PROMPTS = {
    "full":        "Generate exactly {n} question(s). Start with a warmup question — 'Tell me about yourself and your background.' or a natural variant. Then mix a follow-up on the candidate's most recent or most relevant experience, behavioral STAR questions ('Tell me about a time when...') and technical questions based on the top skills, in roughly equal parts. If there are 4 or more questions, end with one motivation question about why they want this role. Keep every question one concise, direct sentence — no multi-part questions.",
    "behavioral":  "Generate exactly {n} behavioral STAR question(s) ONLY. Each must ask about a specific past situation ('Tell me about a time when...', 'Describe a situation where...'). No technical questions.",
    "technical":   "Generate exactly {n} technical question(s) ONLY, progressively harder. Focus on the top skills from the job description. Include at least one system design or architecture question if the role is senior.",
    "screening":   "Generate exactly {n} easy screening question(s), chosen in this order of priority: background intro, motivation for applying, key skills overview, availability/work style, simple technical questions. Keep them brief and conversational.",
}

QUESTION_BANK_PROMPT = """You are generating {question_count} targeted interview practice question(s).

{language_instruction}

Category: {category}
Difficulty: {difficulty}

{difficulty_context}

Generate exactly {question_count} interview question(s) for this category. Make them progressively challenging. Return ONLY this JSON (no preamble, no markdown, no backticks):
{{
  "role": "{category} Practice",
  "candidate_name": "Candidate",
  "seniority": "{difficulty}",
  "intro_message": "A warm 4-sentence intro from {interviewer_name}: greet candidate, say you're {interviewer_name}, mention this is {category} practice at {difficulty} level, mention {question_count} question(s), then ask the first question verbatim.",
  "questions": [
    {{
      "question": "the question the interviewer asks out loud",
      "competency": "what this question tests, 2-6 words",
      "strong_answer": "one sentence: what a strong answer must contain at this level",
      "red_flags": "one sentence: what a weak answer looks like"
    }}
  ]
}}

"competency", "strong_answer" and "red_flags" are hidden notes for the evaluator; write them in English. Only "question" and "intro_message" follow the language instruction above.

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

CV_PARSE_PROMPT = """You are a CV/resume parser. Extract structured information from the following CV text.

Return ONLY valid JSON matching this exact structure (no preamble, no markdown, no backticks):
{{
  "name": "full name or null",
  "title": "current job title or professional title or null",
  "profile": "professional summary paragraph if present verbatim, or null",
  "contact": {{
    "email": "email address or null",
    "phone": "phone number or null",
    "linkedin": "linkedin URL or username or null",
    "location": "city and country or null"
  }},
  "skills": ["skill1", "skill2"],
  "experience": [
    {{
      "title": "job title",
      "company": "company name",
      "duration": "date range e.g. Jan 2020 – Mar 2023",
      "bullets": ["key responsibility or achievement (include metrics if present)"]
    }}
  ],
  "education": [
    {{
      "degree": "degree name and field of study",
      "institution": "university or school name",
      "year": "graduation year or date range",
      "grade": "GPA or grade classification if mentioned, otherwise null"
    }}
  ],
  "languages": ["English (Native)", "French (Conversational)"],
  "certifications": ["certification name and issuer"]
}}

CV text:
{cv_text}

Rules:
- Include ALL experience and education entries found
- Keep bullet points concise but preserve any metrics or achievements
- If a section is absent, use null for strings or [] for arrays
- Do not invent or assume any information not present in the CV"""


# Filled with str.replace() (not .format) so braces in candidate answers are safe —
# that's why the JSON below uses single braces.
DEBRIEF_PROMPT = """Evaluate this practice job interview.

{language_instruction}

Interview context:
- Role: {role}
- Level: {difficulty}
- Interview type: {interview_type}
{requirements}
{cv_summary}

Level expectations: {level_expectations}

The answers are automatic speech-to-text transcripts of spoken answers. Ignore filler words, grammar mistakes, missing punctuation and obvious transcription errors. Many candidates are not native speakers. Judge the content and structure, never the wording.

Some questions come with hidden evaluator notes: what the question tests and what a strong answer contains. Use them as your rubric.

Score every answer on three criteria, each from 1 to 10:
- relevance: answers the actual question and shows the competency being tested
- examples: concrete, specific examples from real experience, with numbers or results
- clarity: clear structure, easy to follow

Use this scale for every criterion:
- 1-3: does not answer the question, or off-topic
- 4-5: generic statements, no concrete example
- 6-7: relevant and concrete, but something important is missing (the result, their personal role, depth)
- 8-9: complete and specific: clear situation, own actions ("I", not only "we"), measurable result
- 10: exceptional for this level
Be honest and calibrated: an average answer gets 5-6, not 8. Do not reward length for its own sake.

STAR check: for questions about past experience, mark which parts are clearly present: situation, task, action, result. For purely technical, knowledge or motivation questions, set "star" to null.

Follow-ups: if the interviewer asked a follow-up, evaluate the whole exchange (first answer + answer after the follow-up). If key details only came after the follow-up, say so in the feedback.

"improved_answer": rewrite the candidate's OWN answer as a 9/10 version in 3-5 sentences, first person, keeping their real experience and facts. Never invent employers, projects, tools, numbers or results they did not mention: every missing detail must be a placeholder in square brackets, e.g. [X hours], [your result], [the tool you used]. This also applies to short answers. Only if the answer was empty or completely off-topic, write a short model answer instead.

Write "feedback", "tip", "summary", "top_strength" and "top_improvement" addressed directly to the candidate ("you", "your"), in a warm, honest coaching tone. Never refer to the candidate by name or as "he", "she" or "the candidate" in these fields.

"hiring_decision": would a real interviewer invite this candidate to the next round for this role and level? "yes", "maybe" or "no", with a one-sentence reason.

Return ONLY this JSON (no preamble, no markdown, no backticks), with one entry in "answers" per question, in order:
{
  "answers": [
    {
      "question": "question text",
      "answer_summary": "2-sentence summary of what the candidate said",
      "scores": {"relevance": 6, "examples": 5, "clarity": 7},
      "star": {"situation": true, "task": true, "action": true, "result": false},
      "feedback": "2 sentences: what worked, and what was missing for this role",
      "tip": "one concrete, actionable improvement tip",
      "improved_answer": "the candidate's answer, rewritten as a 9/10 version"
    }
  ],
  "summary": "3-sentence overall assessment for this role and level, addressed to \"you\"",
  "top_strength": "your strongest quality shown, addressed to \"you\"",
  "top_improvement": "the most important area for you to improve, addressed to \"you\"",
  "hiring_decision": {"decision": "maybe", "reason": "one sentence"}
}

Interview Q&A:
{qa_pairs}"""

LEVEL_EXPECTATIONS = {
    "Junior": "Junior candidates may use examples from studies, personal projects or internships. Reward clear thinking, honesty and willingness to learn; do not expect leadership or large-scale impact.",
    "Mid":    "Mid-level candidates should give concrete work examples with reasonable technical depth and clear personal ownership.",
    "Senior": "Senior candidates should show ownership, measurable impact, trade-off reasoning and influence on others; generic answers are a red flag at this level.",
}

RESPOND_DECISION_PROMPT = """[Candidate answer to question {number} of {total}]: {answer}

[Question]: {question}
{rubric}
[Instruction]: Decide like a real interviewer whether to ask ONE short follow-up before moving on.
Ask a follow-up only if something important is clearly missing: no concrete example, no result or outcome, unclear personal role (only "we"), or the answer is vague or off-topic. Do NOT ask a follow-up if the answer is reasonably complete — it does not need to be perfect.{short_note}
- If you ask a follow-up: one short, specific question that targets exactly what is missing (e.g. "What was the result, in numbers?" or "What did you personally do?"). Do not repeat the original question.
- If you move on: {move_on}

Return ONLY this JSON: {{"followup": true or false, "reply": "what the interviewer says out loud"}}"""

CV_ANALYSIS_PROMPT = """You are a professional career coach and ATS (Applicant Tracking System) expert. Analyse the following CV and return ONLY a valid JSON object — no preamble, no markdown, no backticks.

CV Text:
{cv_text}

Return this exact JSON structure:
{{
  "overall_score": <integer 1-10>,
  "ats_score": <integer 1-100, ATS compatibility score>,
  "verdict": "<one sentence summary of the CV quality>",
  "section_scores": {{
    "summary": <integer 1-10 or null if section missing>,
    "experience": <integer 1-10 or null if section missing>,
    "skills": <integer 1-10 or null if section missing>,
    "education": <integer 1-10 or null if section missing>
  }},
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvements": ["<improvement 1>", "<improvement 2>", "<improvement 3>"],
  "missing_keywords": ["<keyword 1>", "<keyword 2>", "<keyword 3>", "<keyword 4>", "<keyword 5>"]
}}"""
