import os
from openai import OpenAI

def main():
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise RuntimeError("OPENAI_API_KEY missing in environment")
    client = OpenAI(api_key=key)
    r = client.responses.create(model="gpt-5.1", input="Say OK")
    print(r.output_text)

if __name__ == "__main__":
    main()