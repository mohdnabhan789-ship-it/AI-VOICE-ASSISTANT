// =========================================================
// ELEMENTS
// =========================================================

const micButton = document.getElementById("micButton");
const status = document.getElementById("status");
const subStatus = document.getElementById("subStatus");
const conversation = document.getElementById("conversation");
const languageSelect = document.getElementById("languageSelect");
const aiOrb = document.getElementById("aiOrb");


// =========================================================
// VARIABLES
// =========================================================

let mediaRecorder = null;

let audioChunks = [];

let isRecording = false;


// =========================================================
// MICROPHONE BUTTON
// =========================================================

micButton.addEventListener(
    "click",
    async function () {

        if (!isRecording) {

            await startRecording();

        } else {

            stopRecording();

        }

    }
);


// =========================================================
// START RECORDING
// =========================================================

async function startRecording() {

    try {

        // -------------------------------------------------
        // GET MICROPHONE
        // -------------------------------------------------

        const stream =
            await navigator.mediaDevices.getUserMedia({
                audio: true
            });


        // -------------------------------------------------
        // RESET AUDIO CHUNKS
        // -------------------------------------------------

        audioChunks = [];


        // -------------------------------------------------
        // CREATE RECORDER
        // -------------------------------------------------

        mediaRecorder =
            new MediaRecorder(stream);


        // -------------------------------------------------
        // RECEIVE AUDIO DATA
        // -------------------------------------------------

        mediaRecorder.ondataavailable =
            function (event) {

                if (event.data.size > 0) {

                    audioChunks.push(
                        event.data
                    );

                }

            };


        // -------------------------------------------------
        // WHEN RECORDING STOPS
        // -------------------------------------------------

        mediaRecorder.onstop =
            async function () {

                // Stop microphone tracks

                stream
                    .getTracks()
                    .forEach(
                        function (track) {

                            track.stop();

                        }
                    );


                // Create audio blob

                const audioBlob =
                    new Blob(
                        audioChunks,
                        {
                            type:
                                mediaRecorder.mimeType
                        }
                    );


                console.log(
                    "AUDIO MIME TYPE:",
                    audioBlob.type
                );

                console.log(
                    "AUDIO SIZE:",
                    audioBlob.size
                );


                // Send audio to backend

                await transcribeAudio(
                    audioBlob
                );

            };


        // -------------------------------------------------
        // START
        // -------------------------------------------------

        mediaRecorder.start();


        isRecording = true;


        // -------------------------------------------------
        // UI
        // -------------------------------------------------

        micButton.innerText = "⏹️";

        micButton.classList.add(
            "recording"
        );


        aiOrb.classList.add(
            "listening"
        );


        status.innerText =
            "Listening...";


        subStatus.innerText =
            "I'm listening to you";


    }
    catch (error) {

        console.error(
            "MICROPHONE ERROR:",
            error
        );


        status.innerText =
            "Microphone error";


        subStatus.innerText =
            "Please allow microphone permission";


    }

}


// =========================================================
// STOP RECORDING
// =========================================================

function stopRecording() {

    if (
        mediaRecorder &&
        mediaRecorder.state === "recording"
    ) {

        mediaRecorder.stop();

    }


    isRecording = false;


    // -----------------------------------------------------
    // UI
    // -----------------------------------------------------

    micButton.innerText = "🎙️";

    micButton.classList.remove(
        "recording"
    );


    aiOrb.classList.remove(
        "listening"
    );


    status.innerText =
        "Understanding...";


    subStatus.innerText =
        "Processing your voice";

}


// =========================================================
// TRANSCRIBE AUDIO
// =========================================================

async function transcribeAudio(
    audioBlob
) {

    try {

        // -------------------------------------------------
        // CREATE FORM DATA
        // -------------------------------------------------

        const formData =
            new FormData();


        formData.append(
            "file",
            audioBlob,
            "recording.webm"
        );


        // -------------------------------------------------
        // GET SELECTED LANGUAGE
        // -------------------------------------------------

        const selectedLanguage =
            languageSelect.value;


        console.log(
            "SELECTED LANGUAGE:",
            selectedLanguage
        );


        // -------------------------------------------------
        // SEND LANGUAGE
        // -------------------------------------------------

        formData.append(
            "language",
            selectedLanguage
        );


        // -------------------------------------------------
        // UPDATE UI
        // -------------------------------------------------

        status.innerText =
            "Transcribing...";


        subStatus.innerText =
            "Understanding your speech";


        // -------------------------------------------------
        // SEND TO BACKEND
        // -------------------------------------------------

        const response =
            await fetch(
                "/transcribe",
                {
                    method: "POST",

                    body: formData
                }
            );


        // -------------------------------------------------
        // READ RESPONSE
        // -------------------------------------------------

        const data =
            await response.json();


        // -------------------------------------------------
        // CHECK ERROR
        // -------------------------------------------------

        if (!response.ok) {

            throw new Error(
                data.detail ||
                "Transcription failed"
            );

        }


        // -------------------------------------------------
        // DEBUG
        // -------------------------------------------------

        console.log(
            "WHISPER HEARD:",
            data.text
        );


        console.log(
            "FINAL LANGUAGE:",
            data.language
        );


        console.log(
            "WHISPER LANGUAGE:",
            data.whisper_language
        );


        // -------------------------------------------------
        // EMPTY TEXT
        // -------------------------------------------------

        if (
            !data.text ||
            data.text.trim() === ""
        ) {

            status.innerText =
                "No speech detected";


            subStatus.innerText =
                "Please try speaking again";


            return;

        }


        // -------------------------------------------------
        // SHOW USER MESSAGE
        // -------------------------------------------------

        addMessage(
            "You",
            data.text
        );


        // -------------------------------------------------
        // AI THINKING
        // -------------------------------------------------

        status.innerText =
            "Thinking...";


        subStatus.innerText =
            "Understanding your request";


        // -------------------------------------------------
        // SEND TO AI
        // -------------------------------------------------

        await sendToAI(
            data.text,
            data.language
        );


    }
    catch (error) {

        console.error(
            "TRANSCRIPTION ERROR:",
            error
        );


        status.innerText =
            "Speech recognition failed";


        subStatus.innerText =
            error.message;

    }

}


// =========================================================
// SEND MESSAGE TO AI
// =========================================================

async function sendToAI(
    text,
    language
) {

    try {

        // -------------------------------------------------
        // SEND REQUEST
        // -------------------------------------------------

        const response =
            await fetch(
                "/chat",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            message:
                                text,

                            language:
                                language

                        })
                }
            );


        // -------------------------------------------------
        // READ RESPONSE
        // -------------------------------------------------

        const data =
            await response.json();


        // -------------------------------------------------
        // CHECK ERROR
        // -------------------------------------------------

        if (!response.ok) {

            throw new Error(
                data.detail ||
                "AI request failed"
            );

        }


        // -------------------------------------------------
        // DEBUG
        // -------------------------------------------------

        console.log(
            "AI RESPONSE:",
            data.reply
        );


        console.log(
            "AI LANGUAGE:",
            data.language
        );


        // -------------------------------------------------
        // SHOW AI MESSAGE
        // -------------------------------------------------

        addMessage(
            "AI",
            data.reply
        );


        // -------------------------------------------------
        // PREPARE VOICE
        // -------------------------------------------------

        status.innerText =
            "Preparing voice...";


        subStatus.innerText =
            "Creating your response";


        // -------------------------------------------------
        // SEND TO TTS
        // -------------------------------------------------

        await speakResponse(
            data.reply,
            language
        );


    }
    catch (error) {

        console.error(
            "AI ERROR:",
            error
        );


        status.innerText =
            "AI response failed";


        subStatus.innerText =
            error.message;

    }

}


// =========================================================
// TEXT → SPEECH
// =========================================================

async function speakResponse(
    text,
    language
) {

    try {

        // -------------------------------------------------
        // UPDATE UI
        // -------------------------------------------------

        status.innerText =
            "Preparing voice...";


        subStatus.innerText =
            "AI is creating your voice response";


        // -------------------------------------------------
        // SEND TO BACKEND
        // -------------------------------------------------

        const response =
            await fetch(
                "/speak",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            message:
                                text,

                            language:
                                language

                        })
                }
            );


        // -------------------------------------------------
        // CHECK RESPONSE
        // -------------------------------------------------

        if (!response.ok) {

            let errorMessage =
                "Voice generation failed";


            try {

                const errorData =
                    await response.json();


                errorMessage =
                    errorData.detail ||
                    errorMessage;

            }
            catch {

                // Ignore JSON parsing error

            }


            throw new Error(
                errorMessage
            );

        }


        // -------------------------------------------------
        // GET AUDIO
        // -------------------------------------------------

        const audioBlob =
            await response.blob();


        console.log(
            "TTS AUDIO SIZE:",
            audioBlob.size
        );


        // -------------------------------------------------
        // CREATE AUDIO URL
        // -------------------------------------------------

        const audioURL =
            URL.createObjectURL(
                audioBlob
            );


        // -------------------------------------------------
        // CREATE AUDIO PLAYER
        // -------------------------------------------------

        const audio =
            new Audio(audioURL);


        audio.volume = 1.0;


        // -------------------------------------------------
        // AUDIO START
        // -------------------------------------------------

        audio.onplay =
            function () {

                status.innerText =
                    "Speaking...";


                subStatus.innerText =
                    "AI is responding";


                aiOrb.classList.add(
                    "listening"
                );

            };


        // -------------------------------------------------
        // AUDIO END
        // -------------------------------------------------

        audio.onended =
            function () {

                URL.revokeObjectURL(
                    audioURL
                );


                aiOrb.classList.remove(
                    "listening"
                );


                status.innerText =
                    "Ready to listen";


                subStatus.innerText =
                    "Choose your language and start speaking";

            };


        // -------------------------------------------------
        // AUDIO ERROR
        // -------------------------------------------------

        audio.onerror =
            function (error) {

                console.error(
                    "AUDIO PLAY ERROR:",
                    error
                );


                URL.revokeObjectURL(
                    audioURL
                );


                aiOrb.classList.remove(
                    "listening"
                );


                status.innerText =
                    "Could not play audio";


                subStatus.innerText =
                    "Please try again";

            };


        // -------------------------------------------------
        // PLAY
        // -------------------------------------------------

        await audio.play();


    }
    catch (error) {

        console.error(
            "TTS ERROR:",
            error
        );


        aiOrb.classList.remove(
            "listening"
        );


        status.innerText =
            "Voice generation failed";


        subStatus.innerText =
            error.message;

    }

}


// =========================================================
// ADD CHAT MESSAGE
// =========================================================

function addMessage(
    sender,
    message
) {

    // -----------------------------------------------------
    // CREATE ELEMENT
    // -----------------------------------------------------

    const element =
        document.createElement(
            "div"
        );


    element.classList.add(
        "message"
    );


    // -----------------------------------------------------
    // USER MESSAGE
    // -----------------------------------------------------

    if (sender === "You") {

        element.classList.add(
            "user-message"
        );


        element.innerHTML =
            "<strong>🧑 You</strong><br>" +
            escapeHtml(message);

    }


    // -----------------------------------------------------
    // AI MESSAGE
    // -----------------------------------------------------

    else {

        element.classList.add(
            "ai-message"
        );


        element.innerHTML =
            "<strong>✦ Nova AI</strong><br>" +
            escapeHtml(message);

    }


    // -----------------------------------------------------
    // ADD TO CONVERSATION
    // -----------------------------------------------------

    conversation.appendChild(
        element
    );


    // -----------------------------------------------------
    // AUTO SCROLL
    // -----------------------------------------------------

    conversation.scrollTop =
        conversation.scrollHeight;

}


// =========================================================
// ESCAPE HTML
// =========================================================

function escapeHtml(
    text
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        text;


    return div.innerHTML;

}


// =========================================================
// LANGUAGE CHANGE
// =========================================================

languageSelect.addEventListener(
    "change",
    function () {

        const language =
            languageSelect.value;


        console.log(
            "LANGUAGE CHANGED:",
            language
        );


        // Clear old conversation
        conversation.innerHTML = "";


        // Reset UI

        status.innerText =
            "Ready to listen";


        subStatus.innerText =
            "Language selected. Start speaking";


        aiOrb.classList.remove(
            "listening"
        );

    }
);


// =========================================================
// INITIAL STATE
// =========================================================

status.innerText =
    "Ready to listen";


subStatus.innerText =
    "Choose your language and start speaking";