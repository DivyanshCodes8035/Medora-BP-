# Medora BP Notes

## Start the website

Double-click **Open Medora BP Notes.bat**. It starts the website on this computer and opens it in your browser. Node.js must be installed for the local AI connection. On the first launch, the folder creates a private `.env` settings file from `.env.example`.

## Connect Gemini or Groq

1. Open the `.env` file in this folder with Notepad.
2. Set `MEDORA_PROVIDER=gemini` or `MEDORA_PROVIDER=groq`.
3. Paste the matching key into `GEMINI_API_KEY` or `GROQ_API_KEY`. Leave the other provider key blank.
4. Save `.env`, close the website, and double-click the launcher again.

The API key stays in the local settings file and is used by the local server; it is never placed in website code. Do not share `.env` or put a real key in `.env.example`. If no key is configured, the built-in BP guide remains available.

## Privacy and health limits

When AI is connected, the text of your BP Guide chat is sent to the selected Gemini or Groq service to generate replies. The website does not send the saved BP journal or store chat history on its server. Chat context stays temporarily in the open browser tab. Avoid entering names or other identifying details. Check the provider's terms and privacy settings before using real health information.

This is a classroom prototype for general education, not a medical device. It does not measure BP, detect disease, diagnose, or recommend treatment. Follow a clinician's instructions for your own care. The local guide is available if AI is not configured or cannot be reached.

The website lets a patient manually enter readings from an existing monitor, medicine details, symptoms, and questions, then review an editable weekly summary. Entries remain in browser storage on the device.
