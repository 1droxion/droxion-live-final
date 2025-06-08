from flask import Flask, request, jsonify
import os
import requests
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)

REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN")

@app.route("/generate-image", methods=["POST"])
def generate_image():
    try:
        data = request.get_json()
        prompt = data.get("prompt", "").strip()

        if not prompt:
            return jsonify({"error": "Prompt is required."}), 400

        headers = {
            "Authorization": f"Token {REPLICATE_API_TOKEN}",
            "Content-Type": "application/json",
        }

        payload = {
            "version": "7762fd07cf82c940853e41f637fd685e20b063e7e0496e0eed46de929f9bdc",  # SDXL model
            "input": {
                "prompt": prompt,
                "width": 1024,
                "height": 1024,
                "num_inference_steps": 30,
                "refine": "expert_ensemble_refiner",
                "apply_watermark": False
            }
        }

        response = requests.post(
            "https://api.replicate.com/v1/predictions",
            headers=headers,
            json=payload
        )

        if response.status_code != 201:
            print("❌ Replicate error:", response.text)
            return jsonify({"error": "Replicate API failed"}), 500

        result = response.json()
        # You can return the 'web' link to preview the result live
        image_url = result.get("urls", {}).get("web")

        if not image_url:
            return jsonify({"error": "No image URL returned"}), 500

        return jsonify({
            "status": "success",
            "image_url": image_url
        })

    except Exception as e:
        print("🔥 Internal server error:", e)
        return jsonify({"error": str(e)}), 500
