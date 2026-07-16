const API_BASE = "https://rag-knowledge-base-ecjf.onrender.com";
const LEVEL_NAMES = { 1: "Staff", 2: "Manager", 3: "Admin" };

const loginScreen = document.getElementById("login-screen");
const chatScreen = document.getElementById("chat-screen");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");
const questionInput = document.getElementById("question");
const askBtn = document.getElementById("ask-btn");
const messages = document.getElementById("messages");
const usernameDisplay = document.getElementById("username-display");
const levelDisplay = document.getElementById("level-display");
const headerSub = document.getElementById("header-sub");

function getTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

document.getElementById("welcome-time").textContent = getTime();

function showChat(session) {
  loginScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  usernameDisplay.textContent = session.username;
  levelDisplay.textContent = LEVEL_NAMES[session.clearance_level] || "Staff";
  headerSub.textContent = `Signed in as ${session.username}`;
  renderHistory(session.username);
}

function showLogin() {
  chatScreen.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  messages.innerHTML = `
    <div class="divider">Today</div>
    <div class="msg bot">
      <div class="bot-label">
        <div class="bot-avatar">✦</div>
        <span class="bot-name">Hera Assistant</span>
      </div>
      <div class="bubble">Hi! Ask me anything about company policies, SOPs, or internal documents.</div>
      <div class="time">${getTime()}</div>
    </div>
  `;
}

const session = JSON.parse(localStorage.getItem("rag_session") || "null");
if (session && session.token) {
  showChat(session);
} else {
  showLogin();
}

loginBtn.addEventListener("click", async () => {
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();
  if (!username || !password) return;
  loginBtn.textContent = "Signing in...";
  loginError.classList.add("hidden");
  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    if (response.status === 401) {
      loginError.classList.remove("hidden");
      loginBtn.textContent = "Sign in";
      return;
    }
    const data = await response.json();
    const session = { token: data.token, username: data.username, clearance_level: data.clearance_level };
    localStorage.setItem("rag_session", JSON.stringify(session));
    loginBtn.textContent = "Sign in";
    showChat(session);
  } catch (err) {
    loginError.textContent = "Could not connect. Try again.";
    loginError.classList.remove("hidden");
    loginBtn.textContent = "Sign in";
  }
});

passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loginBtn.click();
});

logoutBtn.addEventListener("click", async () => {
  const session = JSON.parse(localStorage.getItem("rag_session") || "null");
  if (session) {
    await fetch(`${API_BASE}/logout`, {
      method: "POST",
      headers: { "x-session-token": session.token }
    }).catch(() => {});
  }
  localStorage.removeItem("rag_session");
  showLogin();
});

function historyKey(username) {
  return `rag_chat_history_${username}`;
}

function saveHistory(username, history) {
  localStorage.setItem(historyKey(username), JSON.stringify(history));
}

function loadHistory(username) {
  const raw = localStorage.getItem(historyKey(username));
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

function renderHistory(username) {
  const history = loadHistory(username);
  if (history.length === 0) return;
  const divider = document.createElement("div");
  divider.className = "divider";
  divider.textContent = "Previous conversation";
  messages.appendChild(divider);
  history.forEach(item => addMessageToDOM(item.text, item.type, item.sources, item.time));
  const todayDivider = document.createElement("div");
  todayDivider.className = "divider";
  todayDivider.textContent = "Today";
  messages.appendChild(todayDivider);
}

askBtn.addEventListener("click", sendQuestion);
questionInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendQuestion();
  }
});

async function sendQuestion() {
  const question = questionInput.value.trim();
  const session = JSON.parse(localStorage.getItem("rag_session") || "null");
  if (!question || !session) return;
  const time = getTime();
  addMessageToDOM(question, "user", null, time);
  questionInput.value = "";
  const history = loadHistory(session.username);
  history.push({ text: question, type: "user", sources: null, time });
  saveHistory(session.username, history);
  const loader = addLoading();
  try {
    const response = await fetch(`${API_BASE}/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": session.token
      },
      body: JSON.stringify({ question })
    });
    loader.remove();
    if (response.status === 401) {
      localStorage.removeItem("rag_session");
      showLogin();
      return;
    }
    const data = await response.json();
    const answerTime = getTime();
    addMessageToDOM(data.answer, "bot", data.sources, answerTime);
    history.push({ text: data.answer, type: "bot", sources: data.sources, time: answerTime });
    saveHistory(session.username, history);
  } catch (err) {
    loader.remove();
    addMessageToDOM("Could not connect to the knowledge base. Try again.", "bot");
  }
}
