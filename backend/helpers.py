import io
import json
import re


def extract_json(text: str) -> dict:
    # Remove possible Markdown code fences before parsing model output as JSON.
    cleaned = re.sub(r"```(?:json)?", "", text).replace("```", "").strip()
    return json.loads(cleaned)


def trim_history(history, max_messages: int = 6):
    # Keep only the latest messages to avoid sending too much context to the LLM.
    return history[-max_messages:]


def trim_to_words(text: str, max_words: int) -> str:
    # Limit long CV/JD text before sending it to the model.
    words = text.split()

    if len(words) <= max_words:
        return text

    return " ".join(words[:max_words]) + "..."


def chat(client, model: str, messages: list, max_tokens: int) -> str:
    # Centralized LLM call helper.
    # This keeps OpenRouter/OpenAI SDK calls out of endpoint functions.
    response = client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        messages=messages,
    )

    return response.choices[0].message.content


def extract_text_from_pdf(file_bytes: bytes) -> str:
    # Extract readable text from PDF files.
    # Note: scanned/image-only PDFs may return empty text.
    import pdfplumber

    text_parts = []

    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()

            if text:
                text_parts.append(text)

    return "\n".join(text_parts)


def extract_text_from_docx(file_bytes: bytes) -> str:
    # Extract readable paragraph text from DOCX files.
    from docx import Document

    document = Document(io.BytesIO(file_bytes))

    return "\n".join(
        paragraph.text
        for paragraph in document.paragraphs
        if paragraph.text.strip()
    )