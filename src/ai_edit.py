from flask import Flask, request, jsonify
from flask_cors import CORS
from moviepy.editor import VideoFileClip, AudioFileClip, concatenate_videoclips
import os
import uuid

app = Flask(__name__)
CORS(app)

UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

@app.route("/generate-edit", methods=["POST"])
def generate_edit():
    video_files = request.files.getlist("videos")
    image_files = request.files.getlist("images")
    audio_files = request.files.getlist("audios")

    video_paths = []
    for f in video_files:
        path = os.path.join(UPLOAD_DIR, f.filename)
        f.save(path)
        video_paths.append(path)

    audio_path = None
    if audio_files:
        audio_file = audio_files[0]
        audio_path = os.path.join(UPLOAD_DIR, audio_file.filename)
        audio_file.save(audio_path)

    if not video_paths:
        return jsonify({"error": "No videos uploaded"}), 400

    # Merge video clips
    try:
        clips = [VideoFileClip(v).subclip(0, min(5, VideoFileClip(v).duration)) for v in video_paths]
        final = concatenate_videoclips(clips, method="compose")

        if audio_path:
            final_audio = AudioFileClip(audio_path).subclip(0, final.duration)
            final = final.set_audio(final_audio)

        output_file = f"{uuid.uuid4().hex}.mp4"
        output_path = os.path.join(OUTPUT_DIR, output_file)
        final.write_videofile(output_path, fps=24)

        return jsonify({
            "video_url": f"http://localhost:5001/outputs/{output_file}"
        })

    except Exception as e:
        print("❌ Video generation error:", e)
        return jsonify({"error": str(e)}), 500

@app.route("/outputs/<filename>")
def serve_output(filename):
    return app.send_from_directory(OUTPUT_DIR, filename)

if __name__ == "__main__":
    app.run(port=5001)
