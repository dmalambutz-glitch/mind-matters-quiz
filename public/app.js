/**
 * Mind Matters Quiz - Client Application
 * Plain JavaScript, Mobile-first, Accessibility-focused
 */

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const screens = {
    menu: document.getElementById("screen-main-menu"),
    register: document.getElementById("screen-register"),
    rules: document.getElementById("screen-rules"),
    leaderboard: document.getElementById("screen-leaderboard"),
    quiz: document.getElementById("screen-quiz"),
    result: document.getElementById("screen-result")
  };

  const navContainer = document.getElementById("nav-container");
  const btnBackToMenu = document.getElementById("btn-back-to-menu");

  // Menu Buttons
  const btnMenuRegister = document.getElementById("btn-menu-register");
  const btnMenuRules = document.getElementById("btn-menu-rules");
  const btnMenuLeaderboard = document.getElementById("btn-menu-leaderboard");

  // Register Elements
  const registerForm = document.getElementById("register-form");
  const regEmailInput = document.getElementById("reg-email");
  const regIcInput = document.getElementById("reg-ic");
  const regAgreeCheckbox = document.getElementById("reg-agree");
  const registerErrorBox = document.getElementById("register-error");
  const postRegisterActions = document.getElementById("post-register-actions");
  const btnStartQuizNow = document.getElementById("btn-start-quiz-now");

  // Leaderboard Elements
  const leaderboardUpdatedTime = document.getElementById("leaderboard-updated-time");
  const leaderboardLoading = document.getElementById("leaderboard-loading");
  const leaderboardEmpty = document.getElementById("leaderboard-empty");
  const leaderboardTableWrapper = document.getElementById("leaderboard-table-wrapper");
  const leaderboardBody = document.getElementById("leaderboard-body");

  // Quiz Elements
  const quizQuestionCounter = document.getElementById("quiz-question-counter");
  const quizScoreTracker = document.getElementById("quiz-score-tracker");
  const timerSecondsText = document.getElementById("timer-seconds-text");
  const timerBar = document.getElementById("timer-bar");
  const quizQuestionText = document.getElementById("quiz-question-text");
  const quizChoicesGroup = document.getElementById("quiz-choices-group");
  const choiceBtns = document.querySelectorAll(".choice-btn");

  // Result Elements
  const resultScoreNum = document.getElementById("result-score-num");
  const resultEncouragement = document.getElementById("result-encouragement");
  const btnResultLeaderboard = document.getElementById("btn-result-leaderboard");
  const btnResultMenu = document.getElementById("btn-result-menu");

  // Application State
  let currentToken = sessionStorage.getItem("mind_matters_token") || null;
  let activeScreenName = "menu";
  let leaderboardInterval = null;
  let quizTimerInterval = null;
  let currentQuestionIndex = 1;
  let isAnswerSubmitting = false;

  // Initialize App
  init();

  function init() {
    setupEventListeners();
    checkExistingAttempt();
  }

  function setupEventListeners() {
    // Navigation
    btnBackToMenu.addEventListener("click", () => showScreen("menu"));

    btnMenuRegister.addEventListener("click", () => {
      if (currentToken) {
        // If user already registered in this session, check attempt status
        verifyTokenAndResume();
      } else {
        showScreen("register");
      }
    });

    btnMenuRules.addEventListener("click", () => showScreen("rules"));
    btnMenuLeaderboard.addEventListener("click", () => showScreen("leaderboard"));

    // Form formatting: strip spaces/dashes on IC input automatically
    regIcInput.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/[^\d- ]/g, "");
    });

    registerForm.addEventListener("submit", handleRegisterSubmit);
    btnStartQuizNow.addEventListener("click", () => startQuiz());

    // Choice Selection
    choiceBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const selectedChoice = parseInt(btn.getAttribute("data-choice"), 10);
        handleAnswerSubmission(selectedChoice, btn);
      });
    });

    // Result actions
    btnResultLeaderboard.addEventListener("click", () => showScreen("leaderboard"));
    btnResultMenu.addEventListener("click", () => showScreen("menu"));
  }

  // --------------------------------------------------------------------------
  // Screen Management
  // --------------------------------------------------------------------------
  function showScreen(screenName) {
    // Clear leaderboard polling if leaving leaderboard
    if (activeScreenName === "leaderboard" && screenName !== "leaderboard") {
      stopLeaderboardPolling();
    }

    // Clear unload warning if leaving quiz
    if (activeScreenName === "quiz" && screenName !== "quiz") {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearInterval(quizTimerInterval);
    }

    activeScreenName = screenName;

    // Toggle screen visibility
    Object.keys(screens).forEach((key) => {
      if (key === screenName) {
        screens[key].classList.remove("hidden");
        screens[key].classList.add("active");
      } else {
        screens[key].classList.add("hidden");
        screens[key].classList.remove("active");
      }
    });

    // Toggle Back to Menu button (Hidden during quiz screen)
    if (screenName === "quiz") {
      navContainer.classList.add("hidden");
      window.addEventListener("beforeunload", handleBeforeUnload);
    } else {
      navContainer.classList.remove("hidden");
    }

    // Screen specific triggers
    if (screenName === "leaderboard") {
      fetchLeaderboard();
      startLeaderboardPolling();
    } else if (screenName === "quiz") {
      fetchNextQuestion();
    }
  }

  function handleBeforeUnload(e) {
    e.preventDefault();
    e.returnValue = "Are you sure you want to leave the quiz? Your quiz timer will continue running!";
    return e.returnValue;
  }

  // --------------------------------------------------------------------------
  // Resume / Token Verification
  // --------------------------------------------------------------------------
  async function checkExistingAttempt() {
    if (!currentToken) return;

    try {
      const res = await fetch(`/api/question?token=${encodeURIComponent(currentToken)}`);
      const data = await res.json();

      if (data.status === "in_progress") {
        // Automatically resume attempt
        showScreen("quiz");
      }
    } catch (err) {
      console.warn("Could not check existing attempt on load:", err);
    }
  }

  async function verifyTokenAndResume() {
    try {
      const res = await fetch(`/api/question?token=${encodeURIComponent(currentToken)}`);
      const data = await res.json();

      if (data.status === "in_progress") {
        showScreen("quiz");
      } else if (data.status === "completed") {
        showResult(data.score);
      } else {
        showScreen("register");
      }
    } catch (err) {
      showScreen("register");
    }
  }

  // --------------------------------------------------------------------------
  // Screen 2: Registration Logic
  // --------------------------------------------------------------------------
  async function handleRegisterSubmit(e) {
    e.preventDefault();
    hideRegisterError();

    const email = regEmailInput.value.trim();
    const rawIc = regIcInput.value.trim();
    const isAgreed = regAgreeCheckbox.checked;

    // Validation
    if (!email || !rawIc) {
      showRegisterError("Please fill in both Email Address and IC Number.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showRegisterError("Please enter a valid email address.");
      return;
    }

    const cleanIc = rawIc.replace(/[\s-]/g, "");
    if (!/^\d{12}$/.test(cleanIc)) {
      showRegisterError("IC Number must be exactly 12 numeric digits.");
      return;
    }

    if (!isAgreed) {
      showRegisterError("You must agree to the privacy statement to participate.");
      return;
    }

    const btnSubmit = document.getElementById("btn-submit-register");
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Verifying...";

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ic: cleanIc })
      });

      const data = await response.json();

      if (response.status === 409) {
        // Show exact required duplicate message
        showRegisterError("You have already participated. Any participation after your first attempt will not be counted and is forfeited.");
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Register & Proceed";
        return;
      }

      if (!response.ok) {
        showRegisterError(data.error || "Registration failed. Please check your details and try again.");
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Register & Proceed";
        return;
      }

      // Successful Registration
      currentToken = data.token;
      sessionStorage.setItem("mind_matters_token", currentToken);

      // Hide form and show Start Quiz button
      registerForm.classList.add("hidden");
      postRegisterActions.classList.remove("hidden");
    } catch (err) {
      showRegisterError("Network or server connection error. Please try again.");
      btnSubmit.disabled = false;
      btnSubmit.textContent = "Register & Proceed";
    }
  }

  function showRegisterError(msg) {
    registerErrorBox.textContent = msg;
    registerErrorBox.classList.remove("hidden");
  }

  function hideRegisterError() {
    registerErrorBox.textContent = "";
    registerErrorBox.classList.add("hidden");
  }

  function startQuiz() {
    if (!currentToken) {
      showScreen("register");
      return;
    }
    showScreen("quiz");
  }

  // --------------------------------------------------------------------------
  // Screen 4: Live Leaderboard Logic
  // --------------------------------------------------------------------------
  async function fetchLeaderboard() {
    try {
      const res = await fetch("/api/leaderboard");
      if (!res.ok) throw new Error("Failed to fetch leaderboard.");

      const data = await res.json();
      renderLeaderboard(data.leaderboard || []);

      const now = new Date();
      leaderboardUpdatedTime.textContent = `Updated: ${now.toLocaleTimeString()}`;
    } catch (err) {
      console.error("Leaderboard fetch error:", err);
    }
  }

  function renderLeaderboard(list) {
    leaderboardLoading.classList.add("hidden");

    if (!list || list.length === 0) {
      leaderboardEmpty.classList.remove("hidden");
      leaderboardTableWrapper.classList.add("hidden");
      return;
    }

    leaderboardEmpty.classList.add("hidden");
    leaderboardTableWrapper.classList.remove("hidden");

    leaderboardBody.innerHTML = "";

    list.forEach((item) => {
      const tr = document.createElement("tr");

      let rankDisplay = item.rank;
      if (item.rank === 1) rankDisplay = `<span class="rank-badge rank-1" title="1st Place">🥇</span>`;
      else if (item.rank === 2) rankDisplay = `<span class="rank-badge rank-2" title="2nd Place">🥈</span>`;
      else if (item.rank === 3) rankDisplay = `<span class="rank-badge rank-3" title="3rd Place">🥉</span>`;

      tr.innerHTML = `
        <td>${rankDisplay}</td>
        <td><strong>${escapeHtml(item.maskedEmail)}</strong></td>
        <td>${item.score} / 25</td>
      `;

      leaderboardBody.appendChild(tr);
    });
  }

  function startLeaderboardPolling() {
    stopLeaderboardPolling();
    leaderboardInterval = setInterval(fetchLeaderboard, 5000);
  }

  function stopLeaderboardPolling() {
    if (leaderboardInterval) {
      clearInterval(leaderboardInterval);
      leaderboardInterval = null;
    }
  }

  // --------------------------------------------------------------------------
  // Screen 5: Quiz Logic
  // --------------------------------------------------------------------------
  async function fetchNextQuestion() {
    if (!currentToken) {
      showScreen("register");
      return;
    }

    clearInterval(quizTimerInterval);
    isAnswerSubmitting = false;
    resetChoiceButtonsState();

    try {
      const res = await fetch(`/api/question?token=${encodeURIComponent(currentToken)}`);
      const data = await res.json();

      if (data.status === "completed" || data.completed) {
        showResult(data.score || 0);
        return;
      }

      if (!res.ok) {
        alert("Error loading question: " + (data.error || "Please try again."));
        showScreen("menu");
        return;
      }

      currentQuestionIndex = data.questionIndex;
      quizQuestionCounter.textContent = `Question ${data.questionIndex} of ${data.totalQuestions}`;
      quizScoreTracker.textContent = `Score: ${data.score}`;
      quizQuestionText.textContent = data.questionText;

      // Populate Choices
      choiceBtns.forEach((btn, idx) => {
        const choiceTextSpan = btn.querySelector(".choice-text");
        if (choiceTextSpan && data.choices[idx]) {
          choiceTextSpan.textContent = data.choices[idx];
        }
      });

      // Start 15s Timer
      startCountdownTimer(data.timeRemainingMs || 15000);
    } catch (err) {
      alert("Failed to load question due to a connection issue.");
    }
  }

  function startCountdownTimer(initialTimeMs) {
    clearInterval(quizTimerInterval);

    const startTime = Date.now();
    const duration = Math.min(15000, initialTimeMs);

    function updateTimerUI() {
      const elapsed = Date.now() - startTime;
      const remainingMs = Math.max(0, duration - elapsed);
      const secondsLeft = Math.ceil(remainingMs / 1000);

      timerSecondsText.textContent = `${secondsLeft}s`;

      const pct = (remainingMs / 15000) * 100;
      timerBar.style.width = `${Math.max(0, pct)}%`;

      // Color transitions: Green -> Amber -> Red
      timerBar.className = "timer-bar";
      if (pct > 50) {
        timerBar.classList.add("timer-green");
      } else if (pct > 20) {
        timerBar.classList.add("timer-amber");
      } else {
        timerBar.classList.add("timer-red");
      }

      if (remainingMs <= 0) {
        clearInterval(quizTimerInterval);
        handleTimeout();
      }
    }

    updateTimerUI();
    quizTimerInterval = setInterval(updateTimerUI, 100);
  }

  async function handleTimeout() {
    if (isAnswerSubmitting) return;
    isAnswerSubmitting = true;
    disableChoiceButtons();

    try {
      const res = await fetch("/api/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: currentToken,
          choice: "timeout",
          questionIndex: currentQuestionIndex
        })
      });

      const data = await res.json();
      if (data.completed || data.status === "completed") {
        showResult(data.score);
      } else {
        fetchNextQuestion();
      }
    } catch (err) {
      fetchNextQuestion();
    }
  }

  async function handleAnswerSubmission(selectedChoice, selectedBtn) {
    if (isAnswerSubmitting) return;
    isAnswerSubmitting = true;

    clearInterval(quizTimerInterval);
    disableChoiceButtons();
    selectedBtn.classList.add("selected");

    // Short delay for tactile feel before advancing
    setTimeout(async () => {
      try {
        const res = await fetch("/api/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: currentToken,
            choice: selectedChoice,
            questionIndex: currentQuestionIndex
          })
        });

        const data = await res.json();

        if (!res.ok) {
          alert("Error submitting answer: " + (data.error || "Retrying..."));
          fetchNextQuestion();
          return;
        }

        if (data.completed || data.status === "completed") {
          showResult(data.score);
        } else {
          fetchNextQuestion();
        }
      } catch (err) {
        alert("Failed to submit answer due to network error. Retrying...");
        fetchNextQuestion();
      }
    }, 400);
  }

  function disableChoiceButtons() {
    choiceBtns.forEach((btn) => (btn.disabled = true));
  }

  function resetChoiceButtonsState() {
    choiceBtns.forEach((btn) => {
      btn.disabled = false;
      btn.classList.remove("selected");
    });
  }

  // --------------------------------------------------------------------------
  // Screen 6: Result Logic
  // --------------------------------------------------------------------------
  function showResult(finalScore) {
    resultScoreNum.textContent = finalScore;

    if (finalScore >= 20) {
      resultEncouragement.textContent = "Outstanding! You have an incredible understanding of mental health awareness!";
    } else if (finalScore >= 12) {
      resultEncouragement.textContent = "Well done! Thank you for taking the time to learn and engage with World Mental Health Day.";
    } else {
      resultEncouragement.textContent = "Thank you for participating! Every step toward understanding mental health brings us closer together.";
    }

    showScreen("result");
  }

  // Helper Utility
  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
});
