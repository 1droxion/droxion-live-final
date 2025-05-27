from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import base64
from datetime import datetime

app = Flask(__name__)

# ✅ Properly enable CORS for all origins and preflight requests
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

UPLOAD_FOLDER = "uploads"
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@app.route("/transform", methods=["POST"])
def transform_image():
    try:
        data = request.json
        image_data = data.get("image")
        style = data.get("style")

        if not image_data or not style:
            return jsonify({"error": "Missing image or style"}), 400

        # Decode base64 image
        image_bytes = base64.b64decode(image_data.split(",")[-1])

        # Save uploaded image with timestamp
        filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{style}.png"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        with open(filepath, "wb") as f:
            f.write(image_bytes)

        # Placeholder result URL (in real use, this should be the output image from the AI model)
        result_url = f"http://localhost:5000/uploads/{filename}"

        return jsonify({"result": result_url})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/uploads/<filename>")
def serve_uploaded_image(filename):
    return app.send_static_file(os.path.join("uploads", filename))

if __name__ == "__main__":
    app.run(debug=True, port=5000)
