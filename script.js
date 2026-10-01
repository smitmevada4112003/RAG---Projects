// ==========================================================================
// AGENTIC RAG STUDIO — INTERACTIVE CLIENT SCRIPT
// ==========================================================================

const API_BASE = "http://127.0.0.1:8000";

// Active Knowledge Source State ('all' by default, or 'python', 'ml', 'java')
let currentSelectedPdf = "all";

const KB_SOURCE_CONFIG = {
    "all": {
        name: "All Documents",
        displayScope: "All Documents (Universal Mode — Any Topic)",
        pillText: "All PDFs (Universal)",
        toast: "Filter cleared: Answering from all reference documents"
    },
    "python": {
        name: "Python 100 Q&A",
        displayScope: "Python Reference Only (Interview Q&A)",
        pillText: "Python Scope (Filtered)",
        toast: "Filter applied: Python Reference only"
    },
    "ml": {
        name: "Machine Learning",
        displayScope: "Machine Learning Reference Only",
        pillText: "ML Scope (Filtered)",
        toast: "Filter applied: Machine Learning Reference only"
    },
    "java": {
        name: "Java Reference",
        displayScope: "Java Reference Only (Strict JVM/OOP Scope)",
        pillText: "Java Scope (Filtered)",
        toast: "Filter applied: Java Reference only (Only answers Java)"
    }
};

function selectKnowledgeSource(sourceKey) {
    if (!KB_SOURCE_CONFIG[sourceKey]) {
        sourceKey = "all";
    }

    // Toggle back to "all" if clicking the already selected specific item
    if (currentSelectedPdf === sourceKey && sourceKey !== "all") {
        sourceKey = "all";
    } else {
        currentSelectedPdf = sourceKey;
    }

    updateSourceSelectionUI();
    showToast(KB_SOURCE_CONFIG[currentSelectedPdf].toast);
}

function updateSourceSelectionUI() {
    const config = KB_SOURCE_CONFIG[currentSelectedPdf] || KB_SOURCE_CONFIG["all"];

    // 1. Update sidebar kb-items
    const items = document.querySelectorAll(".kb-item");
    items.forEach(item => {
        const src = item.getAttribute("data-source");
        const statusSpan = item.querySelector(".kb-status");
        if (src === currentSelectedPdf) {
            item.classList.add("active");
            if (statusSpan) statusSpan.textContent = "Active ✓";
        } else {
            item.classList.remove("active");
            if (statusSpan) statusSpan.textContent = (src === "all" ? "Open" : "Select");
        }
    });

    // 2. Update Header Pill
    const headerScopeText = document.getElementById("headerScopeText");
    if (headerScopeText) {
        headerScopeText.textContent = config.pillText;
    }
}

// Manage Session ID in LocalStorage
function getSessionId() {
    let sessionId = localStorage.getItem("rag_session_id");
    if (!sessionId) {
        sessionId = "session_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
        localStorage.setItem("rag_session_id", sessionId);
    }
    return sessionId;
}

// Start New Chat Session
function startNewChat() {
    const newSessionId = "session_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    localStorage.setItem("rag_session_id", newSessionId);

    const chatBox = document.getElementById("chatBox");
    chatBox.innerHTML = `
        <div class="welcome-hero" id="welcomeHero">
            <div class="hero-glow"></div>
            <div class="hero-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                New Session Started
            </div>
            <h2>How can I assist your study today?</h2>
            <p>Ask technical questions, definitions, or key points grounded in your uploaded reference books.</p>
        </div>
    `;

    showToast("Started fresh conversation session");
    
    // Close sidebar on mobile if open
    const sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.classList.remove("open");
}

// Clear Messages on current screen
function clearCurrentChat() {
    startNewChat();
}

// Quick Ask from Chips & Hero Cards
function quickAsk(text) {
    const inputElement = document.getElementById("question");
    if (inputElement) {
        inputElement.value = text;
        autoResizeTextarea(inputElement);
        sendQuestion();
    }
}

// Show Toast Message
function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => {
        toast.classList.remove("show");
    }, 2400);
}

// Copy Text to Clipboard
async function copyToClipboard(text, btnElement) {
    try {
        await navigator.clipboard.writeText(text);
        if (btnElement) {
            const originalHTML = btnElement.innerHTML;
            btnElement.classList.add("copied");
            btnElement.innerHTML = `
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                Copied!
            `;
            setTimeout(() => {
                btnElement.classList.remove("copied");
                btnElement.innerHTML = originalHTML;
            }, 2000);
        }
        showToast("Copied to clipboard!");
    } catch (err) {
        console.error("Clipboard copy failed:", err);
    }
}

// Format Markdown with code blocks and styling
function formatMarkdown(text) {
    if (!text) return "";
    
    // Use marked library if loaded
    if (typeof marked !== "undefined" && typeof marked.parse === "function") {
        try {
            let html = marked.parse(text);
            // Enhance code blocks with header and copy button
            html = html.replace(/<pre><code class="language-([a-zA-Z0-9_-]+)">([\s\S]*?)<\/code><\/pre>/g, (match, lang, code) => {
                return `
                    <div class="code-block-wrapper">
                        <div class="code-header">
                            <span>${lang.toUpperCase()}</span>
                            <button class="copy-code-btn" onclick="copyCodeSnippet(this)">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                Copy
                            </button>
                        </div>
                        <pre><code>${code}</code></pre>
                    </div>
                `;
            });
            return html;
        } catch (e) {
            console.warn("marked.js parse fallback:", e);
        }
    }

    // Built-in Lightweight Markdown Formatter
    let escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Code blocks
    escaped = escaped.replace(/```([a-zA-Z0-9_]*)\n([\s\S]*?)```/g, (match, lang, code) => {
        return `
            <div class="code-block-wrapper">
                <div class="code-header">
                    <span>${(lang || 'CODE').toUpperCase()}</span>
                    <button class="copy-code-btn" onclick="copyCodeSnippet(this)">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        Copy
                    </button>
                </div>
                <pre><code>${code}</code></pre>
            </div>
        `;
    });

    // Inline code
    escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headers
    escaped = escaped.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    escaped = escaped.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    escaped = escaped.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold & Italics
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Lists
    escaped = escaped.replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>');
    escaped = escaped.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
    escaped = escaped.replace(/<\/ul>\s*<ul>/g, '');

    // Line breaks
    escaped = escaped.replace(/\n\n/g, '<p></p>');
    escaped = escaped.replace(/\n/g, '<br>');

    return escaped;
}

// Copy code from code block header
function copyCodeSnippet(button) {
    const codeBlock = button.closest('.code-block-wrapper').querySelector('code');
    if (codeBlock) {
        copyToClipboard(codeBlock.innerText, button);
    }
}

// Auto-resize input textarea
function autoResizeTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + "px";
}

// Format current time HH:MM
function getFormattedTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Main Function: Send Question to RAG Backend
async function sendQuestion() {
    const inputElement = document.getElementById("question");
    const question = inputElement.value.trim();

    if (!question) return;

    const chatBox = document.getElementById("chatBox");
    const sessionId = getSessionId();

    // Remove welcome hero on first message
    const welcomeHero = document.getElementById("welcomeHero");
    if (welcomeHero) {
        welcomeHero.remove();
    }

    const timeStr = getFormattedTime();

    // 1. Render User Message
    const userRow = document.createElement("div");
    userRow.className = "message-row user";
    userRow.innerHTML = `
        <div class="message-content-wrap">
            <div class="user-bubble">${escapeHtml(question)}</div>
            ${currentSelectedPdf !== 'all' ? `<div class="user-scope-indicator">Filtered: ${escapeHtml(KB_SOURCE_CONFIG[currentSelectedPdf]?.name || currentSelectedPdf)}</div>` : ''}
        </div>
        <div class="message-avatar user-avatar" title="You">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        </div>
    `;
    chatBox.appendChild(userRow);

    // Reset input
    inputElement.value = "";
    inputElement.style.height = "auto";
    chatBox.scrollTop = chatBox.scrollHeight;

    // 2. Render Loading/Thinking row
    const loadingId = "loading-" + Date.now();
    const loadingRow = document.createElement("div");
    loadingRow.className = "message-row bot";
    loadingRow.id = loadingId;
    loadingRow.innerHTML = `
        <div class="message-avatar bot-avatar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2a10 10 0 1 0 10 10H12V2z"></path><path d="M12 2a10 10 0 0 1 10 10"></path></svg>
        </div>
        <div class="message-content-wrap">
            <div class="loading-row">
                <div class="thinking-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <span class="thinking-text">${currentSelectedPdf !== 'all' ? `Searching in ${escapeHtml(KB_SOURCE_CONFIG[currentSelectedPdf]?.name || currentSelectedPdf)}...` : 'Searching all documents & synthesizing...'}</span>
            </div>
        </div>
    `;
    chatBox.appendChild(loadingRow);
    chatBox.scrollTop = chatBox.scrollHeight;

    // 3. Make API Call to FastAPI RAG backend with selected_pdf
    try {
        const response = await fetch(`${API_BASE}/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                question: question,
                session_id: sessionId,
                selected_pdf: currentSelectedPdf
            })
        });

        if (!response.ok) {
            throw new Error(`Server returned HTTP ${response.status}`);
        }

        const data = await response.json();

        // Remove loading state
        const loadingElem = document.getElementById(loadingId);
        if (loadingElem) loadingElem.remove();

        const answerText = data.answer || "No response received.";

        // 4. Render Bot Answer
        const botRow = document.createElement("div");
        botRow.className = "message-row bot";
        
        // Escape raw text for the data attribute copy
        const safeAnswer = escapeHtml(answerText);
        const activeScopeName = currentSelectedPdf !== 'all' ? (KB_SOURCE_CONFIG[currentSelectedPdf]?.name || 'Filtered') : 'Universal Grounded';

        botRow.innerHTML = `
            <div class="message-avatar bot-avatar" title="RAG Assistant">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2a10 10 0 1 0 10 10H12V2z"></path><path d="M12 2a10 10 0 0 1 10 10"></path></svg>
            </div>
            <div class="message-content-wrap">
                <div class="message-meta">
                    <span class="meta-author">RAG Studio</span>
                    <span class="meta-badge">${escapeHtml(activeScopeName)}</span>
                    <span class="meta-time">${timeStr}</span>
                </div>
                <div class="bot-bubble markdown-body">
                    ${formatMarkdown(answerText)}
                </div>
                <div class="bot-actions-toolbar">
                    <button class="copy-answer-btn" onclick="copyAnswerText(this)">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        Copy Answer
                    </button>
                </div>
            </div>
        `;

        chatBox.appendChild(botRow);

    } catch (error) {
        console.error("API Call Error:", error);
        const loadingElem = document.getElementById(loadingId);
        if (loadingElem) {
            loadingElem.innerHTML = `
                <div class="message-avatar bot-avatar">⚠️</div>
                <div class="message-content-wrap">
                    <div class="bot-bubble error-bubble">
                        <strong>Connection Error:</strong> Unable to connect to backend server at <code>${API_BASE}</code>.<br>
                        Make sure the backend is running with: <code>python api.py</code>
                    </div>
                </div>
            `;
        }
    }

    chatBox.scrollTop = chatBox.scrollHeight;
}

// Helper to copy text from bubble
function copyAnswerText(button) {
    const bubble = button.closest('.message-content-wrap').querySelector('.bot-bubble');
    if (bubble) {
        copyToClipboard(bubble.innerText, button);
    }
}

// Escape HTML utility
function escapeHtml(string) {
    const entityMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return String(string).replace(/[&<>"']/g, s => entityMap[s]);
}

// Event Listeners initialization
document.addEventListener("DOMContentLoaded", () => {
    // Initialize knowledge source UI state
    updateSourceSelectionUI();

    const inputElement = document.getElementById("question");
    
    if (inputElement) {
        // Auto-expand textarea
        inputElement.addEventListener("input", () => {
            autoResizeTextarea(inputElement);
        });

        // Enter key to send, Shift+Enter for newline
        inputElement.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendQuestion();
            }
        });
    }

    // Ctrl + K shortcut for New Chat
    document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            startNewChat();
        }
    });

    // Mobile Sidebar Toggle
    const openSidebarBtn = document.getElementById("openSidebarBtn");
    const closeSidebarBtn = document.getElementById("closeSidebarBtn");
    const sidebar = document.getElementById("sidebar");

    if (openSidebarBtn && sidebar) {
        openSidebarBtn.addEventListener("click", () => {
            sidebar.classList.add("open");
        });
    }

    if (closeSidebarBtn && sidebar) {
        closeSidebarBtn.addEventListener("click", () => {
            sidebar.classList.remove("open");
        });
    }
});
