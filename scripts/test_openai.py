import os
from openai import OpenAI


def main():
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise RuntimeError("OPENAI_API_KEY missing in environment")
    client = OpenAI(api_key=key)
    r = client.chat.completions.create(
        model="gpt-5.1", messages=[{"role": "user", "content": "Say OK"}]
    )
    print(r.choices[0].message.content)


if __name__ == "__main__":
    main()
