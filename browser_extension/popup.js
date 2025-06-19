document.addEventListener("DOMContentLoaded", () => {
  const chatBox = document.getElementById("chatBox");
  const userInput = document.getElementById("userInput");
  const sendBtn = document.getElementById("sendBtn");

  sendBtn.addEventListener("click", async () => {
    const input = userInput.value.trim();
    if (!input) return;

    appendMessage("You", input);
    userInput.value = "";
    scrollChatToBottom();

    appendMessage("Bot", "Thinking...");

    try {
      const botResponse = await getOpenRouterResponse(input);
      replaceLastBotMessage(botResponse);
    } catch (err) {
      replaceLastBotMessage("Sorry, something went wrong. Please try again.");
      console.error(err);
    }

    scrollChatToBottom();
  });

  function appendMessage(sender, message) {
    const p = document.createElement("p");
    p.innerHTML = `<b>${sender}:</b> ${message}`;
    chatBox.appendChild(p);
  }

  function replaceLastBotMessage(message) {
    const paragraphs = chatBox.querySelectorAll("p");
    for (let i = paragraphs.length - 1; i >= 0; i--) {
      if (paragraphs[i].innerHTML.startsWith("<b>Bot:</b>")) {
        paragraphs[i].innerHTML = `<b>Bot:</b> ${message}`;
        break;
      }
    }
  }

  function scrollChatToBottom() {
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  // Updated API call for OpenRouter
  async function getOpenRouterResponse(prompt) {
    const response = await fetch("http://localhost:5001/openai-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openrouter-gpt4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a phishing and cybersecurity assistant. Only answer phishing-related questions."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.6,
        max_tokens: 150
      })
    });

    if (!response.ok) {
      throw new Error(`Proxy API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();
  }
});
