from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import os
import requests
import re
import sys
import logging
from werkzeug.utils import secure_filename
import time

# ✅ Logging for Render
logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)

# ✅ Load environment variables
load_dotenv()

app = Flask(__name__)

# ✅ Allow only Droxion domains
allowed_origin_regex = re.compile(
    r"^https:\/\/(www\.)?droxion\.com$|"
    r"^https:\/\/droxion(-live-final)?(-[a-z0-9]+)?\.vercel\.app$"
)
CORS(app, supports_credentials=True, origins=allowed_origin_regex)

# ✅ Public & Upload Folder setup
PUBLIC_FOLDER = os.path.join(os.getcwd(), "public")
AVATAR_FOLDER = os.path.join(PUBLIC_FOLDER, "avatars")
os.makedirs(AVATAR_FOLDER, exist_ok=True)

@app.route("/")
def home():
    return "✅ Droxion API is live."

@app.route("/user-stats", methods=["GET"])
def user_stats():
    try:
        plan = {
            "name": "Starter",
            "videoLimit": 5,
            "imageLimit": 20,
            "autoLimit": 10
        }

        videos = [f for f in os.listdir(PUBLIC_FOLDER) if f.endswith(".mp4")]
        images = [f for f in os.listdir(PUBLIC_FOLDER) if f.endswith(".png") and "styled" in f]
        auto_generates = 6

        stats = {
            "credits": 18,
            "videosThisMonth": len(videos),
            "imagesThisMonth": len(images),
            "autoGenerates": auto_generates,
            "plan": plan
        }

        return jsonify(stats)
    except Exception as e:
        print("❌ Stats Error:", e)
        return jsonify({"error": "Could not fetch stats"}), 500

# ✅ AI Image Generation (unchanged)
@app.route("/generate-image", methods=["POST"])
def generate_image():
    try:
        data = request.json
        prompt = data.get("prompt", "").strip()
        if not prompt:
            return jsonify({"error": "Prompt is required."}), 400

        print("🖼️ Prompt received:", prompt)

        headers = {
            "Authorization": f"Token {os.getenv('REPLICATE_API_TOKEN')}",
            "Content-Type": "application/json"
        }

        payload = {
            "version": "7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
            "input": {
                "prompt": prompt,
                "width": 1024,
                "height": 1024,
                "num_inference_steps": 30,
                "refine": "expert_ensemble_refiner",
                "apply_watermark": False
            }
        }

        create = requests.post("https://api.replicate.com/v1/predictions", headers=headers, json=payload)
        if create.status_code != 201:
            return jsonify({"error": "Failed to create prediction", "details": create.json()}), 500

        prediction = create.json()
        get_url = prediction.get("urls", {}).get("get")

        # Polling until done
        while True:
            poll = requests.get(get_url, headers=headers)
            poll_result = poll.json()
            if poll_result.get("status") == "succeeded":
                return jsonify({"image_url": poll_result.get("output")})
            elif poll_result.get("status") == "failed":
                return jsonify({"error": "Prediction failed"}), 500
            time.sleep(1)

    except Exception as e:
        print("❌ Image Generation Error:", e)
        return jsonify({"error": str(e)}), 500

# ✅ AI Chat (unchanged)
@app.route("/chat", methods=["POST", "OPTIONS"])
def chat():
    if request.method == "OPTIONS":
        return '', 200

    try:
        data = request.json
        prompt = data.get("prompt", "").strip()
        if not prompt:
            return jsonify({"error": "Prompt is required."}), 400

        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            return jsonify({"error": "API key missing"}), 500

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": "openai/gpt-3.5-turbo",
            "messages": [
                {"role": "system", "content": "You are an assistant powered by Droxion."},
                {"role": "user", "content": prompt}
            ]
        }

        response = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)
        result = response.json()

        if response.status_code != 200:
            return jsonify({"reply": f"❌ OpenRouter Error: {result.get('message', 'Unknown error')}"}), 400

        if "choices" in result and result["choices"]:
            return jsonify({"reply": result["choices"][0]["message"]["content"]})
        else:
            return jsonify({"reply": "⚠️ No reply from model."})

    except Exception as e:
        print("❌ Chat Exception:", e)
        return jsonify({"reply": f"Error: {str(e)}"}), 500

# ✅ Avatar Upload Route
@app.route("/upload-avatar", methods=["POST"])
def upload_avatar():
    if "avatar" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["avatar"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(AVATAR_FOLDER, filename)
    file.save(filepath)

    return jsonify({"url": f"/public/avatars/{filename}"})

# ✅ Serve public files (avatar/images)
@app.route("/public/<path:filename>")
def serve_public_file(filename):
    return send_from_directory(PUBLIC_FOLDER, filename)
