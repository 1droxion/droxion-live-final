import replicate
import os
import sys

REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN")
replicate.Client(api_token=REPLICATE_API_TOKEN)

def generate_video_from_prompt(prompt):
    print(f"🎥 Generating video for: {prompt}")
    output = replicate.run(
        "piyushraj/video-crafter:1837d71b7eab8606c1a34d190a45e8353f36f7a6b2bb6f31e99d62c8b7b3b3a9",
        input={"prompt": prompt}
    )
    print("✅ Video URL:", output)
    return output

if __name__ == "__main__":
    user_prompt = sys.argv[1]
    video_url = generate_video_from_prompt(user_prompt)
    print(video_url)
