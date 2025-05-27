import requests
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# 🧠 Replace this with your actual D-ID API Key
DID_API_KEY = os.getenv("DID_API_KEY")  # or paste directly here as string

@app.route("/avatar-reel", methods=["POST"])
def avatar_reel():
    data = request.json
    script = data.get("script", "")
    if not script:
        return jsonify({"error": "No script provided"}), 400

    try:
        response = requests.post(
            "https://api.d-id.com/talks",
            headers={
                "Authorization": f"Bearer {DID_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "script": {
                    "type": "text",
                    "input": script,
                    "provider": {
                        "type": "microsoft",
                        "voice_id": "en-US-JennyNeural"
                    }
                },
                "source_url": "https://i.imgur.com/DPVM1Pw.png",  # You can change this face
                "config": {
                    "fluent": True,
                    "pad_audio": 0.0
                }
            }
        )

        if response.status_code != 200:
            return jsonify({"error": "Failed to create video", "details": response.text}), 500

        talk_id = response.json().get("id")

        # Get video URL
        video_url = f"https://talks.d-id.com/{talk_id}.mp4"

        return jsonify({"status": "success", "video_url": video_url})

    except Exception as e:
        print("❌ D-ID API Error:", e)
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(port=5001)
