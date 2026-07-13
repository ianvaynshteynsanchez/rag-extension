const API_URL = "https://rag-knowledge-base-ecjf.onrender.com/ask";

const LEVEL_NAMES = {
  "staff-key-123": "Staff",
  "manager-key-456": "Manager",
  "admin-key-789": "Admin"
};

const apiKeyInput = document.getElementById("api-key");
const saveKeyBtn = document.getElementById("save-key-btn");
const questionInput = document.getElementById("question");
const askBtn = document.getElementById("ask-btn");
const messages = document.getElementById("messages");
const keyDisplay = document.getElementById("key-display");
const keyLevel = document.getElementById("key-level");
const keyInputRow = document.getElementById("key-input-row");

function getTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

document.getElementById("welcome-time").textContent = getTime();

function updateKeyDisplay(key) {
  if (key) {
    keyDisplay.textContent = key;
    keyLevel.textContent = LEVEL_NAMES[key] || "Unknown";
    keyInputRow.style.display = "none";
  } else {
    keyDisplay.textContent = "No key saved";
    keyLevel.textContent = "—";
    keyInputRow.style.display = "flex";
  }
}

const savedKey = localStorage.getItem("rag_api_key");
updateKeyDisplay(savedKey);

saveKeyBtn.addEventListener("click", () => {
  const key = apiKeyInput.value.trim();
  if (key) {
    localStorage.setItem("rag_api_key", key);
    updateKeyDisplay(key);
    saveKeyBtn.textContent = "Saved!";
    setTimeout(() => saveKeyBtn.textContent = "Save", 1500);
  }
});

function saveHistory(history) {
  localStorage.setItem("rag_chat_history", JSON.stringify(history));
}

function loadHistory() {
  const raw = localStorage.getItem("rag_chat_history");
  return raw ? JSON.parse(raw) : [];
}

function addMessageToDOM(text, type, sources, time) {
  const msg = document.createElement("div");
  msg.className = `msg ${type}`;

  if (type === "bot") {
    const label = document.createElement("div");
    label.className = "bot-label";
    label.innerHTML = `<div class="bot-avatar">✦</div><span class="bot-name">Hera Assistant</span>`;
    msg.appendChild(label);
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  msg.appendChild(bubble);

  if (sources && sources.length > 0) {
    const sourcesDiv = document.createElement("div");
    sourcesDiv.className = "sources";
    sources.forEach(s => {
      const tag = document.createElement("div");
      tag.className = "source-tag";
      tag.textContent = "📄 " + s;
      sourcesDiv.appendChild(tag);
    });
    msg.appendChild(sourcesDiv);
  }

  const timeDiv = document.createElement("div");
  timeDiv.className = "time";
  timeDiv.textContent = time || getTime();
  msg.appendChild(timeDiv);

  messages.appendChild(msg);
  messages.scrollTop = messages.scrollHeight;
}

function addLoading() {
  const msg = document.createElement("div");
  msg.className = "msg bot loading";
  msg.innerHTML = `
    <div class="bot-label">
      <div class="bot-avatar">✦</div>
      <span class="bot-name">Hera Assistant</span>
    </div>
    <div class="bubble">Searching knowledge base...</div>
  `;
  messages.appendChild(msg);
  messages.scrollTop = messages.scrollHeight;
  return msg;
}

function renderHistory() {
  const history = loadHistory();
  if (history.length === 0) return;
  const divider = document.createElement("div");
  divider.className = "divider";
  divider.textContent = "Previous conversation";
  messages.appendChild(divider);
  history.forEach(item => {
    addMessageToDOM(item.text, item.type, item.sources, item.time);
  });
  const todayDivider = document.createElement("div");
  todayDivider.className = "divider";
  todayDivider.textContent = "Today";
  messages.appendChild(todayDivider);
}

renderHistory();

askBtn.addEventListener("click", sendQuestion);
questionInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendQuestion();
  }
});

async function sendQuestion() {
  const question = questionInput.value.trim();
  const apiKey = localStorage.getItem("rag_api_key");

  if (!question) return;

  if (!apiKey) {
    addMessageToDOM("Please save your API key first.", "bot");
    return;
  }

  const time = getTime();
  addMessageToDOM(question, "user", null, time);
  questionInput.value = "";

  const history = loadHistory();
  history.push({ text: question, type: "user", sources: null, time });
  saveHistory(history);

  const loader = addLoading();

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify({ question })
    });

    loader.remove();

    if (response.status === 401) {
      addMessageToDOM("Invalid API key. Please check and try again.", "bot");
      return;
    }

    const data = await response.json();
    const answerTime = getTime();
    addMessageToDOM(data.answer, "bot", data.sources, answerTime);

    history.push({ text: data.answer, type: "bot", sources: data.sources, time: answerTime });
    saveHistory(history);

  } catch (err) {
    loader.remove();
    addMessageToDOM("Could not connect to the knowledge base. Try again.", "bot");
  }
}
