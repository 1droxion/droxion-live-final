import openai
import time
import os

openai.api_key = os.getenv("OPENAI_API_KEY")
STORY_FILE = "engine/story_feed.txt"

def get_last_days(n=3):
    if not os.path.exists(STORY_FILE):
        return []
    with open(STORY_FILE, "r", encoding="utf-8") as f:
        lines = [line.strip() for line in f if line.strip()]
        return lines[-n:]

def write_day(entry):
    with open(STORY_FILE, "a", encoding="utf-8") as f:
        f.write(entry + "\n")

def generate_next_day():
    history = get_last_days()
    prompt = "This is an AI-generated real-time evolving world. Here are the last few days of its history:\n\n"
    prompt += "\n".join(history)
    prompt += "\n\nWrite the next realistic Day as a continuation. Format: [Day 123]: ..."

    try:
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are generating a timeline of a real AI-powered civilization on a simulated Earth. Keep it realistic, evolving, not fantasy."},
                {"role": "user", "content": prompt}
            ]
        )
        reply = response["choices"][0]["message"]["content"].strip()
        return reply
    except Exception as e:
        print("Error:", e)
        return None

def run_forever():
    day_count = 1
    while True:
        print(f"🌀 Generating Day {day_count}...")
        entry = generate_next_day()
        if entry:
            write_day(entry)
            print("✅", entry)
        else:
            print("❌ Skipped due to error")
        day_count += 1
        time.sleep(10)

if __name__ == "__main__":
    run_forever()
