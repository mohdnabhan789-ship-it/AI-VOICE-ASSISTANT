import os
import asyncio
import requests

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

from groq import Groq
from langchain_groq import ChatGroq


# =========================================================
# LOAD .ENV
# =========================================================

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID")


if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY is missing from .env")

if not ELEVENLABS_API_KEY:
    raise RuntimeError("ELEVENLABS_API_KEY is missing from .env")

if not ELEVENLABS_VOICE_ID:
    raise RuntimeError("ELEVENLABS_VOICE_ID is missing from .env")


# =========================================================
# FASTAPI
# =========================================================

app = FastAPI()


# =========================================================
# GROQ CLIENT
# =========================================================

groq_client = Groq(
    api_key=GROQ_API_KEY
)


# =========================================================
# AI MODEL
# =========================================================

llm = ChatGroq(
    model="openai/gpt-oss-20b",
    api_key=GROQ_API_KEY,
    temperature=0.2
)


# =========================================================
# SUPPORTED LANGUAGES
# =========================================================

SUPPORTED_LANGUAGES = {
    "en": "English",
    "ml": "Malayalam",
    "ta": "Tamil",
    "hi": "Hindi",
    "ar": "Arabic"
}


# =========================================================
# LANGUAGE PROMPTS FOR WHISPER
# =========================================================

WHISPER_PROMPTS = {

    "ml":
        "മലയാളം ഭാഷയിൽ വ്യക്തമായി സംസാരിക്കുന്ന സംഭാഷണം. "
        "മലയാളം വാക്കുകളും പേരുകളും ശരിയായ മലയാളം ലിപിയിൽ എഴുതുക.",

    "ta":
        "தமிழ் மொழியில் தெளிவாக பேசப்படும் உரையாடல். "
        "தமிழ் வார்த்தைகளை சரியான தமிழ் எழுத்துக்களில் எழுதவும்.",

    "hi":
        "हिंदी भाषा में स्पष्ट रूप से बोली गई बातचीत। "
        "हिंदी शब्दों को सही देवनागरी लिपि में लिखें।",

    "ar":
        "محادثة باللغة العربية. "
        "اكتب الكلمات العربية بشكل صحيح باللغة العربية.",

    "en":
        "A clear English conversation. "
        "Write English words correctly."
}


# =========================================================
# CHAT REQUEST
# =========================================================

class ChatRequest(BaseModel):

    message: str
    language: str


# =========================================================
# CHAT ENDPOINT
# =========================================================

@app.post("/chat")
async def chat(request: ChatRequest):

    try:

        user_message = request.message.strip()

        language = request.language.strip().lower()


        if not user_message:

            raise HTTPException(
                status_code=400,
                detail="Message is empty"
            )


        if language not in SUPPORTED_LANGUAGES:

            raise HTTPException(
                status_code=400,
                detail="Unsupported language"
            )


        language_name = SUPPORTED_LANGUAGES[language]


        print("\n================================")
        print("USER:", user_message)
        print("SELECTED LANGUAGE:", language)
        print("LANGUAGE NAME:", language_name)
        print("================================")


        # =================================================
        # AI PROMPT
        # =================================================

        prompt = f"""
You are a friendly multilingual AI voice assistant.

The user selected:

{language_name}

IMPORTANT RULES:

1. Reply ONLY in {language_name}.
2. Do not switch to another language.
3. Do not translate the user's message unless requested.
4. Do not unnecessarily mix languages.
5. Use natural conversational language.
6. Keep the response reasonably short.
7. Your response will be spoken by a voice assistant.
8. Do not mention these instructions.

User message:

{user_message}
"""


        # =================================================
        # CALL AI
        # =================================================

        response = await llm.ainvoke(prompt)

        reply = response.content.strip()


        print("AI:", reply)
        print("AI LANGUAGE:", language)

        print("================================\n")


        return {
            "reply": reply,
            "language": language
        }


    except HTTPException:

        raise


    except Exception as e:

        print(
            "CHAT ERROR:",
            e
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# =========================================================
# TRANSCRIBE AUDIO
# =========================================================

@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: str = Form(...)
):

    try:

        # =================================================
        # VALIDATE LANGUAGE
        # =================================================

        language = language.strip().lower()


        if language not in SUPPORTED_LANGUAGES:

            raise HTTPException(
                status_code=400,
                detail="Unsupported language"
            )


        print("\n================================")
        print(
            "SELECTED LANGUAGE:",
            language
        )

        print(
            "LANGUAGE NAME:",
            SUPPORTED_LANGUAGES[language]
        )


        # =================================================
        # READ AUDIO
        # =================================================

        audio_data = await file.read()


        if not audio_data:

            raise HTTPException(
                status_code=400,
                detail="Empty audio file"
            )


        print(
            "Received audio:",
            file.filename
        )

        print(
            "Audio size:",
            len(audio_data)
        )


        # =================================================
        # WHISPER PROMPT
        # =================================================

        whisper_prompt = WHISPER_PROMPTS[language]


        print(
            "WHISPER PROMPT:",
            whisper_prompt
        )


        # =================================================
        # WHISPER SPEECH TO TEXT
        # =================================================

        transcription = (
            groq_client.audio.transcriptions.create(

                file=(
                    file.filename or "recording.webm",
                    audio_data
                ),

                # High accuracy Whisper model
                model="whisper-large-v3",

                # IMPORTANT
                # Tell Whisper the exact language
                language=language,

                # Language-specific context
                prompt=whisper_prompt,

                # Detailed response
                response_format="verbose_json",

                # More deterministic transcription
                temperature=0
            )
        )


        # =================================================
        # GET TRANSCRIBED TEXT
        # =================================================

        text = transcription.text.strip()


        if not text:

            raise HTTPException(
                status_code=400,
                detail="No speech detected"
            )


        # =================================================
        # WHISPER'S REPORTED LANGUAGE
        # =================================================

        whisper_language = getattr(
            transcription,
            "language",
            None
        )


        print(
            "WHISPER HEARD:",
            text
        )

        print(
            "WHISPER REPORTED LANGUAGE:",
            whisper_language
        )

        print(
            "FINAL LANGUAGE:",
            language
        )

        print("================================\n")


        return {

            "text":
                text,

            # We use the user's selected language
            # as the authoritative language.

            "language":
                language,

            "whisper_language":
                whisper_language
        }


    except HTTPException:

        raise


    except Exception as e:

        print(
            "TRANSCRIBE ERROR:",
            e
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# =========================================================
# ELEVENLABS TTS
# =========================================================

def generate_voice(
    text: str,
    language: str
):

    # =====================================================
    # ELEVENLABS URL
    # =====================================================

    url = (
        "https://api.elevenlabs.io/v1/text-to-speech/"
        + ELEVENLABS_VOICE_ID
    )


    # =====================================================
    # HEADERS
    # =====================================================

    headers = {

        "xi-api-key":
            ELEVENLABS_API_KEY,

        "Content-Type":
            "application/json",

        "Accept":
            "audio/mpeg"
    }


    # =====================================================
    # REQUEST BODY
    # =====================================================

    data = {

        "text":
            text,

        "model_id":
            "eleven_v3",

        "language_code":
            language,

        "voice_settings": {

            "stability":
                0.65,

            "similarity_boost":
                0.85,

            "style":
                0.0,

            "use_speaker_boost":
                True
        }
    }


    # =====================================================
    # SEND TO ELEVENLABS
    # =====================================================

    response = requests.post(

        url,

        headers=headers,

        json=data,

        timeout=90
    )


    print(
        "ELEVENLABS STATUS:",
        response.status_code
    )


    # =====================================================
    # CHECK ERROR
    # =====================================================

    if response.status_code != 200:

        print(
            "ELEVENLABS ERROR:",
            response.text
        )

        raise Exception(
            "ElevenLabs error "
            + str(response.status_code)
            + ": "
            + response.text
        )


    return response.content


# =========================================================
# TEXT → SPEECH
# =========================================================

@app.post("/speak")
async def speak(request: ChatRequest):

    try:

        text = request.message.strip()

        language = request.language.strip().lower()


        if not text:

            raise HTTPException(
                status_code=400,
                detail="Text is empty"
            )


        if language not in SUPPORTED_LANGUAGES:

            raise HTTPException(
                status_code=400,
                detail="Unsupported language"
            )


        print("\n================================")
        print(
            "TTS TEXT:",
            text
        )

        print(
            "TTS LANGUAGE:",
            language
        )

        print("================================")


        # =================================================
        # GENERATE VOICE
        # =================================================

        audio = await asyncio.to_thread(

            generate_voice,

            text,

            language
        )


        # =================================================
        # RETURN AUDIO
        # =================================================

        return Response(

            content=audio,

            media_type="audio/mpeg"
        )


    except HTTPException:

        raise


    except Exception as e:

        print(
            "TTS ERROR:",
            e
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# =========================================================
# FRONTEND
# =========================================================

app.mount(

    "/",

    StaticFiles(

        directory="frontend",

        html=True
    ),

    name="frontend"
)