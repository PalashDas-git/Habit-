document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let habits = JSON.parse(localStorage.getItem('habitTrackerData')) || [];
    let currentDate = new Date();
    let currentMonth = currentDate.getMonth();
    let currentYear = currentDate.getFullYear();
    let deletedHabitCache = null; // For Undo functionality

    // --- DOM ELEMENTS ---
    const themeToggle = document.getElementById('themeToggle');
    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');
    const currentMonthYearLabel = document.getElementById('currentMonthYear');
    const habitTable = document.getElementById('habitTable');
    const dateHeaders = document.getElementById('dateHeaders');
    const habitBody = document.getElementById('habitBody');
    const addHabitBtn = document.getElementById('addHabitBtn');
    const habitModal = document.getElementById('habitModal');
    const closeModalBtn = document.querySelector('.close-modal');
    const habitForm = document.getElementById('habitForm');
    const searchHabit = document.getElementById('searchHabit');
    const toast = document.getElementById('toast');
    const undoBtn = document.getElementById('undoBtn');
    
    // Charts instance variables
    let weeklyChartInstance = null;
    let monthlyChartInstance = null;

    // --- INITIALIZATION ---
    initTheme();
    renderApp();
    setupKeyboardShortcuts();

    // --- THEME LOGIC ---
    function initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);

        themeToggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const target = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', target);
            localStorage.setItem('theme', target);
            updateThemeIcon(target);
            renderCharts(); // Re-render to match theme colors
        });
    }

    function updateThemeIcon(theme) {
        themeToggle.innerHTML = theme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    }

    // --- CORE RENDER FUNCTION ---
    function renderApp() {
        updateMonthLabel();
        renderDashboard();
        renderGrid();
        renderCharts();
    }

    // --- MONTH NAVIGATION ---
    prevMonthBtn.addEventListener('click', () => {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        renderApp();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        renderApp();
    });

    function updateMonthLabel() {
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        currentMonthYearLabel.textContent = `${months[currentMonth]} ${currentYear}`;
    }

    // --- GRID GENERATION ---
    function getDaysInMonth(month, year) {
        return new Date(year, month + 1, 0).getDate();
    }

    function renderGrid() {
        const days = getDaysInMonth(currentMonth, currentYear);
        const searchQuery = searchHabit.value.toLowerCase();
        
        // Render Headers
        let headerHTML = `<th class="sticky-col">Habit</th>`;
        for (let i = 1; i <= days; i++) {
            const isToday = (i === currentDate.getDate() && currentMonth === currentDate.getMonth() && currentYear === currentDate.getFullYear());
            headerHTML += `<th style="${isToday ? 'color: var(--c-blue); font-weight: 700;' : ''}">${i}</th>`;
        }
        headerHTML += `<th>%</th><th>Action</th>`;
        dateHeaders.innerHTML = headerHTML;

        // Render Body
        habitBody.innerHTML = '';
        
        const filteredHabits = habits.filter(h => h.name.toLowerCase().includes(searchQuery));

        if (filteredHabits.length === 0) {
            habitBody.innerHTML = `<tr><td colspan="${days + 3}" style="padding: 2rem; color: var(--text-muted);">No habits found. Add one to get started!</td></tr>`;
            return;
        }

        filteredHabits.forEach(habit => {
            const tr = document.createElement('tr');
            
            // First Column: Info
            let rowHTML = `
                <td class="sticky-col">
                    <div class="habit-info">
                        <div class="habit-color-dot" style="background: ${habit.color}"></div>
                        <div class="habit-details">
                            <span class="habit-name">${habit.name}</span>
                            <span class="habit-category">${habit.category}</span>
                        </div>
                    </div>
                </td>
            `;

            // Days Columns
            let completedDays = 0;
            for (let i = 1; i <= days; i++) {
                const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                const isCompleted = habit.history && habit.history[dateKey];
                if (isCompleted) completedDays++;

                rowHTML += `
                    <td>
                        <label class="checkbox-container" style="--habit-color: ${habit.color}">
                            <input type="checkbox" 
                                onchange="toggleHabit('${habit.id}', '${dateKey}', this.checked)" 
                                ${isCompleted ? 'checked' : ''}>
                            <span class="checkmark"></span>
                        </label>
                    </td>
                `;
            }

            // Stats & Action Columns
            const completionRate = Math.round((completedDays / days) * 100);
            rowHTML += `
                <td style="font-weight: 600; color: ${completionRate >= 80 ? 'var(--c-emerald)' : 'var(--text-main)'}">${completionRate}%</td>
                <td>
                    <button class="icon-btn" onclick="deleteHabit('${habit.id}')" style="width:30px; height:30px; color: var(--text-muted);">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            `;

            tr.innerHTML = rowHTML;
            habitBody.appendChild(tr);
        });
    }

    // --- HABIT ACTIONS ---
    window.toggleHabit = function(habitId, dateKey, isChecked) {
        const habit = habits.find(h => h.id === habitId);
        if (!habit) return;

        if (!habit.history) habit.history = {};
        habit.history[dateKey] = isChecked;
        
        saveData();
        renderDashboard();
        renderCharts();

        // Check for daily completion confetti
        const todayKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
        if (dateKey === todayKey && isChecked) {
            checkAllCompletedToday(todayKey);
        }
    };

    function checkAllCompletedToday(todayKey) {
        if (habits.length === 0) return;
        const allCompleted = habits.every(h => h.history && h.history[todayKey] === true);
        if (allCompleted) {
            triggerConfetti();
            showToast('All habits completed for today! 🎉');
        }
    }

    // --- MODAL & FORM LOGIC ---
    addHabitBtn.addEventListener('click', () => {
        document.getElementById('habitId').value = '';
        habitForm.reset();
        document.getElementById('modalTitle').textContent = 'Add New Habit';
        habitModal.classList.add('active');
    });

    closeModalBtn.addEventListener('click', () => habitModal.classList.remove('active'));

    habitForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('habitId').value || 'habit_' + Date.now();
        const name = document.getElementById('habitNameInput').value;
        const category = document.getElementById('habitCategory').value;
        const color = document.querySelector('input[name="habitColor"]:checked').value;

        const existingIndex = habits.findIndex(h => h.id === id);
        
        const newHabit = {
            id,
            name,
            category,
            color,
            history: existingIndex >= 0 ? habits[existingIndex].history : {},
            createdAt: Date.now()
        };

        if (existingIndex >= 0) {
            habits[existingIndex] = newHabit;
            showToast('Habit updated');
        } else {
            habits.push(newHabit);
            showToast('Habit added');
        }

        saveData();
        renderApp();
        habitModal.classList.remove('active');
    });

    window.deleteHabit = function(id) {
        const index = habits.findIndex(h => h.id === id);
        if (index > -1) {
            deletedHabitCache = habits[index]; // Save for undo
            habits.splice(index, 1);
            saveData();
            renderApp();
            showToast('Habit deleted', true); // true = show undo
        }
    };

    // --- SEARCH ---
    searchHabit.addEventListener('input', renderGrid);

    // --- DASHBOARD LOGIC ---
    function renderDashboard() {
        document.getElementById('totalHabits').textContent = habits.length;

        const todayKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
        const completedToday = habits.filter(h => h.history && h.history[todayKey]).length;
        document.getElementById('completedToday').textContent = completedToday;

        // Calculate Global Current Streak
        let currentStreak = 0;
        let d = new Date(currentDate);
        
        // Simplify streak: global streak means completing AT LEAST ONE habit consecutively.
        // For a stricter approach, it could be completing ALL habits. We'll use "at least one" for motivation.
        while (true) {
            const checkKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const activityOnDay = habits.some(h => h.history && h.history[checkKey]);
            
            // Don't break streak if today isn't done yet, but yesterday was
            if (!activityOnDay && checkKey !== todayKey) break;
            if (activityOnDay) currentStreak++;
            
            d.setDate(d.getDate() - 1);
        }
        document.getElementById('currentStreak').textContent = `${currentStreak} Days`;

        // Success Rate (Overall all time)
        let totalPossible = 0;
        let totalCompleted = 0;
        
        habits.forEach(habit => {
            const historyKeys = habit.history ? Object.keys(habit.history) : [];
            totalPossible += historyKeys.length; // Approximate based on days interacted
            totalCompleted += historyKeys.filter(k => habit.history[k]).length;
        });

        const rate = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;
        document.getElementById('successRate').textContent = `${rate}%`;
    }

    // --- CHART.JS LOGIC ---
    function renderCharts() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#94a3b8' : '#64748b';
        const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

        // 1. Weekly Chart Data
        const last7Days = [];
        const completionData = [];
        for(let i=6; i>=0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            last7Days.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
            
            const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const count = habits.filter(h => h.history && h.history[dateKey]).length;
            completionData.push(count);
        }

        if(weeklyChartInstance) weeklyChartInstance.destroy();
        const ctxWeekly = document.getElementById('weeklyChart').getContext('2d');
        weeklyChartInstance = new Chart(ctxWeekly, {
            type: 'line',
            data: {
                labels: last7Days,
                datasets: [{
                    label: 'Habits Completed',
                    data: completionData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: textColor }, grid: { color: gridColor } },
                    y: { ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor }, beginAtZero: true }
                }
            }
        });

        // 2. Monthly Category Chart
        const categories = {};
        habits.forEach(h => {
            categories[h.category] = (categories[h.category] || 0) + 1;
        });

        if(monthlyChartInstance) monthlyChartInstance.destroy();
        const ctxMonthly = document.getElementById('monthlyChart').getContext('2d');
        monthlyChartInstance = new Chart(ctxMonthly, {
            type: 'doughnut',
            data: {
                labels: Object.keys(categories),
                datasets: [{
                    data: Object.values(categories),
                    backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'right', labels: { color: textColor } } }
            }
        });
    }

    // --- UTILS & DATA PERSISTENCE ---
    function saveData() {
        localStorage.setItem('habitTrackerData', JSON.stringify(habits));
    }

    // Export/Import
    document.getElementById('exportData').addEventListener('click', (e) => {
        e.preventDefault();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(habits));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "habitify_backup.json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        showToast('Data exported successfully');
    });

    document.getElementById('importFile').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const imported = JSON.parse(e.target.result);
                    if (Array.isArray(imported)) {
                        habits = imported;
                        saveData();
                        renderApp();
                        showToast('Data imported successfully');
                    }
                } catch (err) {
                    showToast('Invalid JSON file');
                }
            };
            reader.readAsText(file);
        }
    });

    // Toast UI
    let toastTimeout;
    function showToast(msg, showUndo = false) {
        document.getElementById('toastMessage').textContent = msg;
        toast.classList.add('show');
        
        undoBtn.classList.toggle('hidden', !showUndo);
        
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }

    undoBtn.addEventListener('click', () => {
        if (deletedHabitCache) {
            habits.push(deletedHabitCache);
            deletedHabitCache = null;
            saveData();
            renderApp();
            toast.classList.remove('show');
            // Show secondary toast confirming undo without recursion
            setTimeout(() => showToast('Action reversed'), 300);
        }
    });

    // Confetti
    function triggerConfetti() {
        var duration = 3 * 1000;
        var animationEnd = Date.now() + duration;
        var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

        function randomInRange(min, max) {
            return Math.random() * (max - min) + min;
        }

        var interval = setInterval(function() {
            var timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return clearInterval(interval);
            var particleCount = 50 * (timeLeft / duration);
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
        }, 250);
    }

    // Keyboard Shortcuts
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // CMD/CTRL + N to add habit
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                addHabitBtn.click();
            }
            // ESC to close modal
            if (e.key === 'Escape' && habitModal.classList.contains('active')) {
                closeModalBtn.click();
            }
            // CTRL + F to search
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                searchHabit.focus();
            }
        });
    }
});
