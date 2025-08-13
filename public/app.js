// Location-based recommendations (weather, transport)
async function fetchLocationRecs() {
    const recDiv = document.getElementById('locationRecs');
    if (!recDiv) return;
    recDiv.textContent = 'Fetching local recommendations...';
    if (!navigator.geolocation) {
        recDiv.textContent = 'Geolocation not supported.';
        return;
    }
    navigator.geolocation.getCurrentPosition(async pos => {
        const lat = pos.coords.latitude, lon = pos.coords.longitude;
        try {
            const res = await fetch('/api/location-recommendations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lat, lon })
            });
            const data = await res.json();
            let html = '';
            if (data.weather) {
                html += `<b>Weather:</b> ${data.weather.weather[0].description}, ${data.weather.main.temp}°C<br>`;
            }
            if (data.recommendations && data.recommendations.length) {
                html += data.recommendations.map(r => `<div>• ${r}</div>`).join('');
            }
            recDiv.innerHTML = html || 'No local recommendations.';
        } catch {
            recDiv.textContent = 'Could not fetch local recommendations.';
        }
    }, () => {
        recDiv.textContent = 'Location permission denied.';
    });
}

window.addEventListener('DOMContentLoaded', () => {
    fetchLocationRecs();
});
// Group/family join/create and leaderboard
async function updateGroupLeaderboard() {
    const res = await fetch('/api/group', { credentials: 'include' });
    const group = (await res.json()).group;
    const lbList = document.getElementById('groupLeaderboardList');
    if (lbList) {
        lbList.innerHTML = '';
        if (group && group.users) {
            group.users.sort((a, b) => (b.points || 0) - (a.points || 0));
            group.users.forEach(u => {
                const li = document.createElement('li');
                li.textContent = `${u.name || 'User'} — ${u.points} pts, Streak: ${u.streak}`;
                lbList.appendChild(li);
            });
        } else {
            lbList.innerHTML = '<li>No group members yet.</li>';
        }
    }
}

document.getElementById('joinGroupBtn').onclick = async () => {
    const groupName = document.getElementById('groupNameInput').value.trim();
    if (!groupName) {
        document.getElementById('groupStatus').textContent = 'Enter a group/family name.';
        return;
    }
    document.getElementById('groupStatus').textContent = 'Joining...';
    await fetch('/api/group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ groupId: groupName.toLowerCase().replace(/\s+/g, '-'), groupName })
    });
    document.getElementById('groupStatus').textContent = 'Joined group: ' + groupName;
    updateGroupLeaderboard();
};

window.addEventListener('DOMContentLoaded', () => {
    updateGroupLeaderboard();
});
// Gamification: Leaderboard, points, streaks
async function updateGamification() {
    // User points and streak
    const userRes = await fetch('/api/user', { credentials: 'include' });
    const user = (await userRes.json()).user;
    if (user) {
        document.getElementById('userPoints').textContent = 'Points: ' + (user.points || 0);
        document.getElementById('userStreak').textContent = 'Streak: ' + (user.streak || 0);
    }
    // Leaderboard
    const lbRes = await fetch('/api/leaderboard');
    const leaderboard = (await lbRes.json()).leaderboard;
    const lbList = document.getElementById('leaderboardList');
    if (lbList) {
        lbList.innerHTML = '';
        leaderboard.forEach((u, i) => {
            const li = document.createElement('li');
            li.textContent = `${u.name || 'User'} — ${u.points} pts, Streak: ${u.streak}`;
            if (user && u._id === user._id) li.style.fontWeight = 'bold';
            lbList.appendChild(li);
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    updateGamification();
});
// Interactive Dashboard Chart (weekly/monthly/yearly, category filters)
let dashboardChart = null;
async function renderDashboardChart() {
    const user = await (await fetch('/api/user', { credentials: 'include' })).json();
    if (!user || !user.user || !user.user.history) return;
    const history = user.user.history;
    const period = document.getElementById('dashboardPeriod').value;
    const category = document.getElementById('dashboardCategory').value;
    // Aggregate data
    let labels = [], data = [];
    if (period === 'week') {
        // Last 7 days
        const last7 = history.slice(-7);
        labels = last7.map(h => h.date.slice(5));
        if (category === 'all') data = last7.map(h => h.total);
        else data = last7.map(h => h.breakdown && h.breakdown[category] ? h.breakdown[category] : 0);
    } else if (period === 'month') {
        // Group by month
        const byMonth = {};
        history.forEach(h => {
            const m = h.date.slice(0,7);
            if (!byMonth[m]) byMonth[m] = [];
            byMonth[m].push(h);
        });
        labels = Object.keys(byMonth);
        data = labels.map(m => {
            const arr = byMonth[m];
            if (category === 'all') return arr.reduce((sum, h) => sum + (h.total||0), 0) / arr.length;
            return arr.reduce((sum, h) => sum + (h.breakdown && h.breakdown[category] ? h.breakdown[category] : 0), 0) / arr.length;
        });
    } else if (period === 'year') {
        // Group by year
        const byYear = {};
        history.forEach(h => {
            const y = h.date.slice(0,4);
            if (!byYear[y]) byYear[y] = [];
            byYear[y].push(h);
        });
        labels = Object.keys(byYear);
        data = labels.map(y => {
            const arr = byYear[y];
            if (category === 'all') return arr.reduce((sum, h) => sum + (h.total||0), 0) / arr.length;
            return arr.reduce((sum, h) => sum + (h.breakdown && h.breakdown[category] ? h.breakdown[category] : 0), 0) / arr.length;
        });
    }
    // Render chart
    const ctx = document.getElementById('dashboardChart').getContext('2d');
    if (dashboardChart) {
        dashboardChart.data.labels = labels;
        dashboardChart.data.datasets[0].data = data;
        dashboardChart.update();
    } else {
        dashboardChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'CO₂ (kg)',
                    data,
                    fill: true,
                    backgroundColor: 'rgba(67,233,123,0.15)',
                    borderColor: '#43e97b',
                    tension: 0.3,
                    pointRadius: 4,
                    pointBackgroundColor: '#388e3c',
                    borderWidth: 2
                }]
            },
            options: {
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { color: '#388e3c' }, grid: { color: '#e0e0e0' } },
                    x: { ticks: { color: '#388e3c' }, grid: { color: '#e0e0e0' } }
                }
            }
        });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const periodSel = document.getElementById('dashboardPeriod');
    const catSel = document.getElementById('dashboardCategory');
    if (periodSel && catSel) {
        periodSel.onchange = renderDashboardChart;
        catSel.onchange = renderDashboardChart;
        renderDashboardChart();
    }
});
// Fetch and display AI-driven recommendations and summaries
async function fetchAIInsights() {
    const user = await (await fetch('/api/user', { credentials: 'include' })).json();
    if (!user || !user.user || !user.user.history) return;
    const history = user.user.history;
    // Summary
    const summaryDiv = document.getElementById('aiSummary');
    if (summaryDiv) {
        summaryDiv.textContent = 'Loading summary...';
        try {
            const res = await fetch('/api/summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ history })
            });
            const data = await res.json();
            summaryDiv.textContent = data.summary;
        } catch {
            summaryDiv.textContent = 'Could not load summary.';
        }
    }
    // Recommendations
    const recDiv = document.getElementById('aiRecommendations');
    if (recDiv) {
        recDiv.textContent = 'Loading recommendations...';
        try {
            const res = await fetch('/api/recommendations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ history })
            });
            const data = await res.json();
            recDiv.textContent = data.recommendations;
        } catch {
            recDiv.textContent = 'Could not load recommendations.';
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    fetchAIInsights();
});
// Phase 11: Cloud sync and multi-device support
async function getUser() {
    try {
        const res = await fetch('/api/user', { credentials: 'include' });
        return (await res.json()).user;
    } catch { return null; }
}
async function saveCloudData() {
    const data = {
        formSubmissions: JSON.parse(localStorage.getItem('lastFormData') || '{}'),
        badges: JSON.parse(localStorage.getItem('earnedBadges') || '{}'),
        // Add more: goals, history, etc.
    };
    await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ data })
    });
}
async function loadCloudData() {
    const res = await fetch('/api/load', { credentials: 'include' });
    const { data } = await res.json();
    if (data && data.formSubmissions) {
        localStorage.setItem('lastFormData', JSON.stringify(data.formSubmissions));
        // Optionally update form fields immediately
        window.location.reload();
    }
    if (data && data.badges) {
        localStorage.setItem('earnedBadges', JSON.stringify(data.badges));
    }
}
document.getElementById('signInBtn').onclick = () => {
    window.location.href = '/auth/google';
};
document.getElementById('syncBtn').onclick = async () => {
    document.getElementById('syncStatus').textContent = 'Syncing...';
    await saveCloudData();
    document.getElementById('syncStatus').textContent = 'Synced!';
    setTimeout(() => document.getElementById('syncStatus').textContent = '', 2000);
};
window.addEventListener('DOMContentLoaded', async () => {
    const user = await getUser();
    if (user) {
        document.getElementById('signInBtn').style.display = 'none';
        document.getElementById('syncBtn').style.display = '';
        document.getElementById('syncStatus').textContent = 'Signed in as ' + (user.name || user.email);
        // Optionally auto-load cloud data
        // await loadCloudData();
    }
});
// Phase 8: Chart.js emissions breakdown chart
let emissionsChart = null;
function updateEmissionsChart(results) {
    const ctx = document.getElementById('emissionsChart').getContext('2d');
    const data = {
        labels: ['Travel', 'Diet', 'Shopping'],
        datasets: [{
            label: 'CO₂ (kg)',
            data: [results.travel, results.diet, results.shopping],
            backgroundColor: [
                'rgba(67, 233, 123, 0.7)',
                'rgba(56, 249, 215, 0.7)',
                'rgba(255, 202, 40, 0.7)'
            ],
            borderColor: [
                'rgba(67, 233, 123, 1)',
                'rgba(56, 249, 215, 1)',
                'rgba(255, 202, 40, 1)'
            ],
            borderWidth: 2,
            borderRadius: 8
        }]
    };
    if (emissionsChart) {
        emissionsChart.data = data;
        emissionsChart.update();
    } else {
        emissionsChart = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: {
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#388e3c', font: { weight: 'bold' } },
                        grid: { color: '#e0e0e0' }
                    },
                    x: {
                        ticks: { color: '#388e3c', font: { weight: 'bold' } },
                        grid: { color: '#e0e0e0' }
                    }
                }
            }
        });
    }
}
// Phase 7: What If? Simulation logic
function getCurrentInputs() {
    return {
        carKm: Number(document.getElementById('carKm').value) || 0,
        busKm: Number(document.getElementById('busKm').value) || 0,
        planeKm: Number(document.getElementById('planeKm').value) || 0,
        vegDays: Number(document.getElementById('vegDays').value) || 0,
        meatMeals: Number(document.getElementById('meatMeals').value) || 0,
        clothingItems: Number(document.getElementById('clothingItems').value) || 0,
        electronics: Number(document.getElementById('electronics').value) || 0
    };
}

document.getElementById('whatifSimulate').addEventListener('click', function() {
    const habit = document.getElementById('whatifHabit').value;
    const value = Number(document.getElementById('whatifValue').value);
    if (!habit || isNaN(value) || value < 1) {
        document.getElementById('whatifResult').textContent = 'Please enter a valid change.';
        return;
    }
    const baseInputs = getCurrentInputs();
    const baseResults = calculateCarbonFootprint(baseInputs);
    // Clone and simulate change
    const simInputs = { ...baseInputs };
    let label = '', before = 0, after = 0;
    if (habit === 'meatMeals') {
        before = simInputs.meatMeals;
        simInputs.meatMeals = Math.max(0, simInputs.meatMeals - value);
        label = `Reducing meat meals by ${value}`;
    } else if (habit === 'carKm') {
        before = simInputs.carKm;
        simInputs.carKm = Math.max(0, simInputs.carKm - value * 5); // Assume 5km per trip
        label = `Replacing ${value} short car trips (5km each) with walking`;
    } else if (habit === 'vegDays') {
        before = simInputs.vegDays;
        simInputs.vegDays = Math.min(7, simInputs.vegDays + value);
        label = `Adding ${value} vegetarian day(s) per week`;
    }
    const simResults = calculateCarbonFootprint(simInputs);
    const reduction = baseResults.total - simResults.total;
    const percent = baseResults.total > 0 ? (reduction / baseResults.total) * 100 : 0;
    document.getElementById('whatifResult').innerHTML = `
        <b>${label}:</b><br>
        <span style="color:#00897b; font-weight:bold;">CO₂ reduction: ${reduction.toFixed(1)} kg (${percent.toFixed(1)}%)</span><br>
        <span style="font-size:0.97em;">Projected new total: <b>${simResults.total.toFixed(1)} kg CO₂</b></span>
    `;
});
// Phase 4: Export to PDF using jsPDF
document.getElementById('exportPDF').addEventListener('click', async function() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    // Header & Branding
    doc.setFillColor(232, 245, 233);
    doc.rect(0, 0, 595, 70, 'F');
    doc.setFontSize(22);
    doc.setTextColor(46, 125, 50);
    doc.setFont('helvetica', 'bold');
    doc.text('Personal Carbon Footprint Tracker', 40, 45);
    // Date range
    const start = document.getElementById('pdfStartDate').value;
    const end = document.getElementById('pdfEndDate').value;
    let dateRange = '';
    if (start && end) dateRange = `Report: ${start} to ${end}`;
    else dateRange = 'Report Date: ' + new Date().toLocaleDateString();
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    doc.text(dateRange, 40, 62);

    // Chart image
    const chartCanvas = document.getElementById('emissionsChart');
    if (chartCanvas) {
        const chartImg = chartCanvas.toDataURL('image/png', 1.0);
        doc.addImage(chartImg, 'PNG', 320, 30, 220, 110, undefined, 'FAST');
    }

    // Results breakdown
    const results = document.getElementById('results').innerText;
    doc.setFontSize(14);
    doc.setTextColor(27, 94, 32);
    doc.setFont('helvetica', 'bold');
    doc.text('Emissions Breakdown', 40, 110);
    doc.setFontSize(11);
    doc.setTextColor(33, 33, 33);
    doc.setFont('helvetica', 'normal');
    doc.text(results, 40, 130, { maxWidth: 250 });

    // Badges
    let earned = JSON.parse(localStorage.getItem('earnedBadges') || '{}');
    const BADGES = [
        { id: 'travel_goal', icon: '🚗', title: 'Travel Saver' },
        { id: 'diet_goal', icon: '🥗', title: 'Green Eater' },
        { id: 'shopping_goal', icon: '🛍️', title: 'Conscious Shopper' },
        { id: 'eco_champion', icon: '🌎', title: 'Eco Champion' }
    ];
    doc.setFontSize(14);
    doc.setTextColor(46, 125, 50);
    doc.setFont('helvetica', 'bold');
    doc.text('Achievements', 40, 180);
    let badgeX = 40, badgeY = 200;
    BADGES.forEach(badge => {
        if (earned[badge.id]) {
            doc.setFontSize(24);
            doc.text(badge.icon, badgeX, badgeY);
            doc.setFontSize(10);
            doc.setTextColor(33, 33, 33);
            doc.text(badge.title, badgeX + 28, badgeY);
            badgeY += 28;
        }
    });
    if (!Object.values(earned).some(Boolean)) {
        doc.setFontSize(11);
        doc.setTextColor(120, 120, 120);
        doc.text('No badges earned yet.', 40, badgeY);
    }

    // Recommendations
    const recs = Array.from(document.querySelectorAll('.actions-list li')).map(li => li.textContent);
    doc.setFontSize(14);
    doc.setTextColor(33, 150, 243);
    doc.setFont('helvetica', 'bold');
    doc.text('Personalised Recommendations', 320, 180);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    let recY = 200;
    recs.forEach(rec => {
        doc.text('- ' + rec, 320, recY, { maxWidth: 220 });
        recY += 18;
    });

    // Footer
    doc.setDrawColor(67, 233, 123);
    doc.setLineWidth(1.2);
    doc.line(40, 800, 555, 800);
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text('Generated by Personal Carbon Footprint Tracker', 40, 815);

    doc.save('sustainability-report.pdf');
});
// Phase 2: Carbon calculation logic, validation, and dynamic result display
function calculateCarbonFootprint(inputs) {
    // Multipliers (kg CO2 per unit)
    const MULTIPLIERS = {
        carKm: 0.21,        // per km by car
        busKm: 0.09,        // per km by bus
        planeKm: 0.15,      // per km by plane
        vegDays: -0.5,      // negative: each veg day saves 0.5kg/week
        meatMeals: 1.8,     // per meat meal (avg)
        clothingItems: 25,  // per clothing item
        electronics: 200    // per electronic item
    };
    // Calculate travel
    const travel = (inputs.carKm * MULTIPLIERS.carKm) +
                   (inputs.busKm * MULTIPLIERS.busKm) +
                   (inputs.planeKm * MULTIPLIERS.planeKm);
    // Diet: vegDays is negative (saves CO2), meatMeals is positive
    const diet = (inputs.vegDays * MULTIPLIERS.vegDays) +
                 (inputs.meatMeals * MULTIPLIERS.meatMeals);
    // Shopping: clothing per month, electronics per year (convert to per month)
    const shopping = (inputs.clothingItems * MULTIPLIERS.clothingItems) +
                     ((inputs.electronics / 12) * MULTIPLIERS.electronics);
    // Total (per month)
    const total = travel + diet + shopping;
    return {
        travel: travel,
        diet: diet,
        shopping: shopping,
        total: total
    };
}

document.getElementById('carbonForm').addEventListener('submit', function(e) {
    e.preventDefault();
    // Get and validate inputs
    const carKm = Number(document.getElementById('carKm').value);
    const busKm = Number(document.getElementById('busKm').value);
    const planeKm = Number(document.getElementById('planeKm').value);
    const vegDays = Number(document.getElementById('vegDays').value);
    const meatMeals = Number(document.getElementById('meatMeals').value);
    const clothingItems = Number(document.getElementById('clothingItems').value);
    const electronics = Number(document.getElementById('electronics').value);

    // Simple validation
    if ([carKm, busKm, planeKm, vegDays, meatMeals, clothingItems, electronics].some(isNaN) || vegDays < 0 || vegDays > 7) {
        document.getElementById('results').textContent = 'Please enter valid values for all fields.';
        return;
    }

        // Phase 9: Persist last submitted form data for offline use
        localStorage.setItem('lastFormData', JSON.stringify({ carKm, busKm, planeKm, vegDays, meatMeals, clothingItems, electronics }));

        const results = calculateCarbonFootprint({ carKm, busKm, planeKm, vegDays, meatMeals, clothingItems, electronics });

    // Display results
    document.getElementById('results').innerHTML = `
        <strong>Estimated Monthly Carbon Footprint:</strong><br>
        <ul>
            <li><b>Travel:</b> ${results.travel.toFixed(1)} kg CO₂</li>
            <li><b>Diet:</b> ${results.diet.toFixed(1)} kg CO₂</li>
            <li><b>Shopping:</b> ${results.shopping.toFixed(1)} kg CO₂</li>
        </ul>
        <b>Total:</b> <span style=\"font-size:1.3em; color:#2e7d32;\">${results.total.toFixed(1)} kg CO₂</span>
    `;
    // Update emissions chart
    updateEmissionsChart(results);

    // --- Phase 3: Update Dashboard ---
    // Weekly goals (hardcoded)
    const goals = {
        travel: 100,   // kg CO2 per month
        diet: 30,
        shopping: 50
    };
    // Clamp and animate progress bars
    function animateBar(barId, value, goal) {
        const percent = Math.min(100, Math.round((value / goal) * 100));
        const bar = document.getElementById(barId);
        // Reset for smooth animation
        bar.style.transition = 'none';
        bar.style.width = '0%';
        setTimeout(() => {
            bar.style.transition = 'width 1.3s cubic-bezier(.4,2,.6,1)';
            bar.style.width = percent + '%';
        }, 50);
    }
    animateBar('travelBar', results.travel, goals.travel);
    animateBar('dietBar', results.diet, goals.diet);
    animateBar('shoppingBar', results.shopping, goals.shopping);

    // Phase 6: Badges/Achievements logic
    const BADGES = [
        {
            id: 'travel_goal',
            icon: '🚗',
            title: 'Travel Saver',
            desc: 'Kept travel emissions under 100 kg CO₂!'
        },
        {
            id: 'diet_goal',
            icon: '🥗',
            title: 'Green Eater',
            desc: 'Kept diet emissions under 30 kg CO₂!'
        },
        {
            id: 'shopping_goal',
            icon: '🛍️',
            title: 'Conscious Shopper',
            desc: 'Kept shopping emissions under 50 kg CO₂!'
        },
        {
            id: 'eco_champion',
            icon: '🌎',
            title: 'Eco Champion',
            desc: 'Total emissions under 120 kg CO₂!'
        }
    ];
    // Load earned badges from localStorage
    let earned = JSON.parse(localStorage.getItem('earnedBadges') || '{}');
    let newEarned = { ...earned };
    // Check for badge conditions
    if (results.travel <= goals.travel) newEarned['travel_goal'] = true;
    if (results.diet <= goals.diet) newEarned['diet_goal'] = true;
    if (results.shopping <= goals.shopping) newEarned['shopping_goal'] = true;
    if (results.total <= 120) newEarned['eco_champion'] = true;
    // Save if new badges earned
    if (JSON.stringify(newEarned) !== JSON.stringify(earned)) {
        localStorage.setItem('earnedBadges', JSON.stringify(newEarned));
    }
    // Render badges
    const badgesContainer = document.getElementById('badgesContainer');
    if (badgesContainer) {
        badgesContainer.innerHTML = '';
        BADGES.forEach(badge => {
            if (newEarned[badge.id]) {
                const card = document.createElement('div');
                card.className = 'badge-card';
                card.innerHTML = `
                    <div class="badge-icon">${badge.icon}</div>
                    <div class="badge-title">${badge.title}</div>
                    <div class="badge-desc">${badge.desc}</div>
                `;
                badgesContainer.appendChild(card);
                // Animate badge appearance
                setTimeout(() => card.classList.add('visible'), 100);
            }
        });
        if (!Object.values(newEarned).some(Boolean)) {
            badgesContainer.innerHTML = '<em>No badges earned yet. Meet your goals to unlock achievements!</em>';
        }
    }

    // Phase 5: Randomize Recommended Actions for realism
    const actions = [
        'Walk, cycle, or use public transport for short trips.',
        'Choose vegetarian meals more often.',
        'Buy fewer, higher-quality clothing items.',
        'Unplug electronics when not in use.',
        'Track your progress weekly and set new goals.'
    ];
    const shuffled = actions.sort(() => 0.5 - Math.random());
    const actionsList = document.querySelector('.actions-list');
    if (actionsList) {
        actionsList.innerHTML = '';
        shuffled.forEach(action => {
            const li = document.createElement('li');
            li.textContent = action;
            actionsList.appendChild(li);
        });
    }

    // Eco Rating (green/yellow/red)
    let eco = 'Green', ecoColor = '#43a047';
    if (results.total > 180) {
        eco = 'Red'; ecoColor = '#d32f2f';
    } else if (results.total > 120) {
        eco = 'Yellow'; ecoColor = '#fbc02d';
    }
    const ecoRating = document.getElementById('ecoRating');
    ecoRating.textContent = eco;
    ecoRating.style.background = ecoColor + '22';
    ecoRating.style.color = ecoColor;

    // Phase 10: AI-powered or rule-based personalised suggestions
    function getPersonalisedRecs(inputs, results) {
        const recs = {
            Travel: [],
            Diet: [],
            Shopping: []
        };
        // Travel
        if (results.travel > 100) {
            recs.Travel.push('Reduce car or plane travel. Try carpooling, public transport, or walking for short trips.');
        } else if (inputs.carKm > 0 && results.travel > 60) {
            recs.Travel.push('Replace some car trips with cycling or walking.');
        }
        if (inputs.planeKm > 0) {
            recs.Travel.push('Consider alternatives to flying, such as trains or video calls.');
        }
        // Diet
        if (results.diet > 30) {
            recs.Diet.push('Reduce meat meals and increase vegetarian days.');
        } else if (inputs.meatMeals > 3) {
            recs.Diet.push('Try a "Meatless Monday" or similar weekly challenge.');
        }
        if (inputs.vegDays < 3) {
            recs.Diet.push('Add more vegetarian days to your week.');
        }
        // Shopping
        if (results.shopping > 50) {
            recs.Shopping.push('Buy fewer new clothing or electronics items this month.');
        }
        if (inputs.clothingItems > 2) {
            recs.Shopping.push('Choose quality over quantity when shopping for clothes.');
        }
        if (inputs.electronics > 0) {
            recs.Shopping.push('Delay upgrading electronics unless necessary.');
        }
        // Prioritise by impact
        Object.keys(recs).forEach(cat => {
            recs[cat] = recs[cat].slice(0, 2);
        });
        return recs;
    }
    const inputs = { carKm, busKm, planeKm, vegDays, meatMeals, clothingItems, electronics };
    const aiRecs = getPersonalisedRecs(inputs, results);
    const aiRecsDiv = document.getElementById('aiRecs');
    if (aiRecsDiv) {
        aiRecsDiv.innerHTML = '';
        Object.entries(aiRecs).forEach(([cat, list]) => {
            if (list.length) {
                const catDiv = document.createElement('div');
                catDiv.className = 'ai-recs-category';
                catDiv.innerHTML = `<h3>${cat}</h3><ul class="ai-recs-list">${list.map(r => `<li>${r}</li>`).join('')}</ul>`;
                aiRecsDiv.appendChild(catDiv);
            }
        });
        if (!Object.values(aiRecs).some(arr => arr.length)) {
            aiRecsDiv.innerHTML = '<em>Great job! Your habits are already eco-friendly.</em>';
        }
    }
});

    // Phase 9: Auto-fill form on load if data exists
    window.addEventListener('DOMContentLoaded', () => {
        const data = localStorage.getItem('lastFormData');
        if (data) {
            try {
                const d = JSON.parse(data);
                if (typeof d === 'object') {
                    document.getElementById('carKm').value = d.carKm || 0;
                    document.getElementById('busKm').value = d.busKm || 0;
                    document.getElementById('planeKm').value = d.planeKm || 0;
                    document.getElementById('vegDays').value = d.vegDays || 0;
                    document.getElementById('meatMeals').value = d.meatMeals || 0;
                    document.getElementById('clothingItems').value = d.clothingItems || 0;
                    document.getElementById('electronics').value = d.electronics || 0;
                }
            } catch {}
        }
    });
