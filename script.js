// === NICOTINE CONTROL DASHBOARD - JAVASCRIPT ===

/* ================================================
   COOKIE MANAGEMENT UTILITIES
   ================================================ */

// Set a cookie that persists across browser sessions
function setCookie(name, value, daysToExpire = 365) {
    const date = new Date();
    date.setTime(date.getTime() + (daysToExpire * 24 * 60 * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + encodeURIComponent(JSON.stringify(value)) + ";" + expires + ";path=/;SameSite=Lax";
}

// Get cookie value
function getCookie(name) {
    const nameEQ = name + "=";
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.indexOf(nameEQ) === 0) {
            try {
                return JSON.parse(decodeURIComponent(cookie.substring(nameEQ.length)));
            } catch (e) {
                return null;
            }
        }
    }
    return null;
}

// Delete a cookie
function deleteCookie(name) {
    setCookie(name, "", -1);
}

/* ================================================
   DATA STRUCTURE & INITIALIZATION
   ================================================ */

// Game state object - stores all data for the current day
let gameState = {
    date: null,              // Today's date as string (YYYY-MM-DD)
    cigarettes: 0,           // Count of cigarettes smoked today
    joints: 0,               // Count of joints smoked today
    dailyLimit: 5,           // User's daily limit
    timerInterval: 60,       // Minimum minutes between cigarettes
    lastCigaretteTime: null, // Timestamp of last cigarette
    cravings: {
        total: 0,           // Total times user pressed craving button
        resisted: 0         // Times user resisted (felt craving but didn't smoke)
    },
    physicalState: {
        headache: 'none',
        energy: 'medium',
        mood: 'neutral',
        exercise: 'no'
    },
    history: []             // Last 7 days of data: [{date, cigarettes, joints}, ...]
};

// Timer reference for countdown
let timerInterval = null;

// Craving messages for encouragement
const cravingMessages = [
    "This will pass",
    "Delay, don't deny",
    "You are in control",
    "Breathe through it",
    "This urge is temporary",
    "You've got this! 💪",
    "Every moment counts",
    "Be stronger than your cravings",
    "This feeling will fade",
    "You're protecting your health"
];

/* ================================================
   INITIALIZATION ON PAGE LOAD
   ================================================ */

document.addEventListener('DOMContentLoaded', function() {
    loadData();
    setupEventListeners();
    updateAllUI();
    startTimerIfNeeded();
    checkAndResetIfNewDay();
});

/* ================================================
   DATA MANAGEMENT - LocalStorage & Daily Reset
   ================================================ */

// Load data from cookies
function loadData() {
    const today = getTodayDateString();
    const savedData = getCookie('nicotineControlData');
    
    if (savedData) {
        const saved = savedData;
        
        // If it's a new day, archive yesterday and start fresh
        if (saved.date !== today) {
            archiveDay(saved);
            gameState.date = today;
            gameState.cigarettes = 0;
            gameState.joints = 0;
            gameState.lastCigaretteTime = null;
            gameState.cravings = { total: 0, resisted: 0 };
            gameState.physicalState = {
                headache: 'none',
                energy: 'medium',
                mood: 'neutral',
                exercise: 'no'
            };
        } else {
            // Same day - restore data
            Object.assign(gameState, saved);
        }
    } else {
        // First time - initialize
        gameState.date = today;
    }
    
    // Always load history from cookies
    const savedHistory = getCookie('nicotineControlHistory');
    if (savedHistory) {
        gameState.history = savedHistory;
    }
    
    saveData();
}

// Get today's date as YYYY-MM-DD string
function getTodayDateString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Archive today's data when a new day starts
function archiveDay(todayData) {
    const archiveEntry = {
        date: todayData.date,
        cigarettes: todayData.cigarettes,
        joints: todayData.joints
    };
    
    // Keep only last 7 days
    gameState.history.unshift(archiveEntry);
    if (gameState.history.length > 7) {
        gameState.history.pop();
    }
}

// Save game state to cookies (persists across browser sessions)
function saveData() {
    setCookie('nicotineControlData', gameState, 365);
    setCookie('nicotineControlHistory', gameState.history, 365);
}

// Check if it's a new day every second (for edge cases)
function checkAndResetIfNewDay() {
    setInterval(() => {
        if (gameState.date !== getTodayDateString()) {
            location.reload();
        }
    }, 60000); // Check every minute
}

/* ================================================
   CIGARETTE LOGGING
   ================================================ */

function addCigarette() {
    const now = Date.now();

    // Check if timer is still active
    if (gameState.lastCigaretteTime) {
        const timeSinceLastCig = now - gameState.lastCigaretteTime;
        const requiredWait = gameState.timerInterval * 60 * 1000;
        
        if (timeSinceLastCig < requiredWait) {
            // Timer is still active - this is a craving, not a needs
            const shortWait = Math.ceil((requiredWait - timeSinceLastCig) / 1000);
            showWarning(`⚠️ This is a craving, not a need! Wait ${formatSeconds(shortWait)}`);
            return;
        }
    }

    // Add the cigarette
    gameState.cigarettes++;
    gameState.lastCigaretteTime = now;
    
    // Reset the craving counter (user resisted before smoking)
    gameState.cravings.resisted = Math.max(0, gameState.cravings.total - 1);
    
    saveData();
    updateAllUI();
    startTimerIfNeeded();
}

// Show warning message temporarily
function showWarning(message) {
    const btn = document.getElementById('addCigaretteBtn');
    const originalText = btn.textContent;
    btn.textContent = message;
    btn.disabled = true;
    
    setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
    }, 3000);
}

/* ================================================
   TIMER LOGIC
   ================================================ */

function startTimerIfNeeded() {
    // Clear any existing timer
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    // If no cigarette has been smoked yet, don't start timer
    if (!gameState.lastCigaretteTime) {
        updateTimerDisplay();
        return;
    }
    
    // Update display every second
    timerInterval = setInterval(updateTimerDisplay, 1000);
    updateTimerDisplay(); // Immediate update
}

function updateTimerDisplay() {
    const statusEl = document.getElementById('timerStatus');
    const countdownEl = document.getElementById('timerCountdown');
    
    if (!gameState.lastCigaretteTime) {
        statusEl.style.display = 'block';
        statusEl.textContent = '✓ Ready to use';
        countdownEl.style.display = 'none';
        return;
    }
    
    const now = Date.now();
    const timeSinceLastCig = now - gameState.lastCigaretteTime;
    const requiredWait = gameState.timerInterval * 60 * 1000;
    
    if (timeSinceLastCig >= requiredWait) {
        // Timer is done
        statusEl.style.display = 'block';
        statusEl.textContent = '✓ Ready to use';
        countdownEl.style.display = 'none';
    } else {
        // Timer is running
        statusEl.style.display = 'none';
        countdownEl.style.display = 'flex';
        
        const remainingMs = requiredWait - timeSinceLastCig;
        const totalSeconds = Math.ceil(remainingMs / 1000);
        
        document.getElementById('timerValue').textContent = formatTime(totalSeconds);
    }
}

// Format seconds to MM:SS
function formatSeconds(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
}

// Format seconds to MM:SS for display
function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/* ================================================
   CRAVING LOGIC & BREATHING EXERCISE
   ================================================ */

function triggerCraving() {
    gameState.cravings.total++;
    saveData();
    
    showBreathingExercise();
}

function showBreathingExercise() {
    const exerciseEl = document.getElementById('breathingExercise');
    const messageEl = document.getElementById('cravingMessage');
    const textEl = document.getElementById('breathingText');
    const breathingCircle = document.getElementById('breathingCircle');
    
    // Show the breathing exercise
    exerciseEl.style.display = 'block';
    
    // Pick random encouragement message
    const message = cravingMessages[Math.floor(Math.random() * cravingMessages.length)];
    messageEl.textContent = `"${message}"`;
    
    // Reset breathing animation
    breathingCircle.style.animation = 'none';
    setTimeout(() => {
        breathingCircle.style.animation = 'breathe 8s infinite';
    }, 10);
    
    // Run breathing text cycle for 60 seconds
    let cycleCount = 0;
    const breathingCycle = setInterval(() => {
        const stages = ['Breathe in...', 'Hold...', 'Breathe out...', 'Hold...'];
        textEl.textContent = stages[cycleCount % 4];
        cycleCount++;
        
        // After 60 seconds, stop
        if (cycleCount >= 15) { // ~60 seconds for 4-second cycles
            clearInterval(breathingCycle);
            gameState.cravings.resisted++;
            saveData();
            hideBreathingExercise();
            showBreathingComplete();
        }
    }, 4000);
    
    // Store interval ID for skip button
    window.currentBreathingInterval = breathingCycle;
}

function skipBreathing() {
    if (window.currentBreathingInterval) {
        clearInterval(window.currentBreathingInterval);
    }
    gameState.cravings.resisted++;
    saveData();
    hideBreathingExercise();
}

function hideBreathingExercise() {
    document.getElementById('breathingExercise').style.display = 'none';
}

function showBreathingComplete() {
    const messageEl = document.getElementById('cravingMessage');
    messageEl.textContent = '✓ You resisted! Great job!';
    setTimeout(() => {
        messageEl.textContent = '';
    }, 2000);
}

/* ================================================
   STATE TRACKING
   ================================================ */

function updatePhysicalState(state, value) {
    gameState.physicalState[state] = value;
    saveData();
    updateSummary();
}

/* ================================================
   UI UPDATE FUNCTIONS
   ================================================ */

function updateAllUI() {
    updateTrackerUI();
    updateTimerDisplay();
    updateSummary();
    updateChart();
    updateStateButtons();
}

// Update cigarette tracker display
function updateTrackerUI() {
    document.getElementById('cigaretteCount').textContent = gameState.cigarettes;
    document.getElementById('jointCount').textContent = gameState.joints;
    
    const daily = gameState.dailyLimit;
    const remaining = Math.max(0, daily - gameState.cigarettes);
    
    document.getElementById('remaining').textContent = remaining;
    document.getElementById('progressText').textContent = `${gameState.cigarettes} / ${daily}`;
    
    // Update progress bar
    const percentage = Math.min(100, (gameState.cigarettes / daily) * 100);
    const fill = document.getElementById('progressFill');
    fill.style.width = percentage + '%';
    
    // Color code based on status
    fill.classList.remove('warning', 'danger');
    if (percentage > 100) {
        fill.classList.add('danger');
    } else if (percentage > 80) {
        fill.classList.add('warning');
    }
}

// Update summary display
function updateSummary() {
    document.getElementById('summaryTotal').textContent = gameState.cigarettes;
    document.getElementById('summaryCravings').textContent = gameState.cravings.resisted;
    document.getElementById('summaryJoints').textContent = gameState.joints;
    
    // Calculate average time between cigarettes
    const avgTime = calculateAverageTimeBetween();
    document.getElementById('summaryAvgTime').textContent = avgTime;
    
    // Show encouragement message
    const messageEl = document.getElementById('summaryMessage');
    if (gameState.cigarettes <= gameState.dailyLimit * 0.5) {
        messageEl.textContent = '✨ Excellent control today! Keep it up!';
    } else if (gameState.cigarettes <= gameState.dailyLimit) {
        messageEl.textContent = '👍 Good control today!';
    } else {
        messageEl.textContent = '💪 Try to space them more tomorrow';
    }
    
    // Update streak
    updateStreakDisplay();
}

// Calculate average minutes between cigarettes
function calculateAverageTimeBetween() {
    if (gameState.cigarettes <= 1) return '--';
    
    const now = Date.now();
    const dayStart = new Date().setHours(0, 0, 0, 0);
    
    // Rough estimate: assume cigarettes are spread throughout the day
    const hoursAwake = 16; // Assume 16 waking hours
    const minutesAvailable = hoursAwake * 60;
    const avgMinutes = Math.floor(minutesAvailable / gameState.cigarettes);
    
    return `${avgMinutes}m`;
}

// Update streak display (days under limit)
function updateStreakDisplay() {
    let streak = 0;
    
    // Check each day in history, starting with today
    if (gameState.cigarettes <= gameState.dailyLimit) {
        streak = 1;
    }
    
    // Check previous days
    for (let entry of gameState.history) {
        if (entry.cigarettes <= gameState.dailyLimit) {
            streak++;
        } else {
            break; // Streak broken
        }
    }
    
    document.getElementById('streakDays').textContent = streak;
    
    // Highlight if streak is active
    const streakBox = document.getElementById('streakBox');
    if (gameState.cigarettes <= gameState.dailyLimit) {
        streakBox.style.opacity = '1';
    } else {
        streakBox.style.opacity = '0.6';
    }
}

// Update state toggle buttons
function updateStateButtons() {
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        const state = btn.dataset.state;
        const value = btn.dataset.value;
        
        if (gameState.physicalState[state] === value) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Update 7-day chart
function updateChart() {
    const bars = document.querySelectorAll('.chart-bar');
    
    // Map history (with today at the end)
    const chartData = [];
    
    // Add 6 days of history (in reverse order)
    for (let i = Math.min(5, gameState.history.length - 1); i >= 0; i--) {
        chartData.push(gameState.history[i].cigarettes);
    }
    
    // Pad with zeros if needed
    while (chartData.length < 6) {
        chartData.unshift(0);
    }
    
    // Add today
    chartData.push(gameState.cigarettes);
    
    // Find max for scaling
    const max = Math.max(...chartData, gameState.dailyLimit * 1.5);
    
    // Update bars
    bars.forEach((bar, index) => {
        const value = chartData[index];
        const height = (value / max) * 100;
        bar.style.height = height + '%';
        bar.title = value;
    });
}

/* ================================================
   EVENT LISTENERS
   ================================================ */

function setupEventListeners() {
    // Cigarette tracker
    document.getElementById('addCigaretteBtn').addEventListener('click', addCigarette);
    document.getElementById('dailyLimit').addEventListener('change', function() {
        gameState.dailyLimit = parseInt(this.value) || 5;
        saveData();
        updateAllUI();
    });
    
    // Timer
    document.getElementById('timerInterval').addEventListener('change', function() {
        gameState.timerInterval = parseInt(this.value) || 60;
        saveData();
        startTimerIfNeeded();
    });
    
    document.getElementById('updateIntervalBtn').addEventListener('click', function() {
        gameState.timerInterval = parseInt(document.getElementById('timerInterval').value) || 60;
        saveData();
        startTimerIfNeeded();
    });
    
    // Craving button
    document.getElementById('cravingBtn').addEventListener('click', triggerCraving);
    document.getElementById('skipBreathingBtn').addEventListener('click', skipBreathing);
    
    // Physical state buttons
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const state = this.dataset.state;
            const value = this.dataset.value;
            updatePhysicalState(state, value);
            updateStateButtons();
        });
    });
    
    // Joint tracker
    document.getElementById('addJointBtn').addEventListener('click', function() {
        gameState.joints++;
        saveData();
        updateTrackerUI();
        updateSummary();
        updateChart();
    });
    
    // Action buttons
    document.getElementById('resetDayBtn').addEventListener('click', function() {
        if (confirm('Reset today\'s data? This cannot be undone.')) {
            gameState.cigarettes = 0;
            gameState.joints = 0;
            gameState.lastCigaretteTime = null;
            gameState.cravings = { total: 0, resisted: 0 };
            saveData();
            updateAllUI();
            startTimerIfNeeded();
        }
    });
    
    document.getElementById('clearAllBtn').addEventListener('click', function() {
        if (confirm('Clear ALL data including history? This cannot be undone.')) {
            deleteCookie('nicotineControlData');
            deleteCookie('nicotineControlHistory');
            location.reload();
        }
    });
    
    document.getElementById('exportBtn').addEventListener('click', function() {
        const data = {
            today: gameState,
            history: gameState.history,
            exportDate: new Date().toISOString()
        };
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nicotine-control-${getTodayDateString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });
}

/* ================================================
   UTILITY: Handle "Copy to Clipboard" for data
   ================================================ */

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        console.log('Data copied to clipboard');
    });
}
