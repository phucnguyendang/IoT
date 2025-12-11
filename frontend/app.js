/**
 * IoT Smart Light - Frontend Application (Clean Version)
 * ======================================
 */

// ============ Configuration ============
const CONFIG = {
    API_URL: 'http://127.0.0.1:8000',
    POLL_INTERVAL: 3000, // Cập nhật trạng thái mỗi 3 giây
    CHART_REFRESH_INTERVAL: 30000, // Cập nhật biểu đồ mỗi 30 giây
};

// ============ State Management ============
const state = {
    token: null,
    isConnected: false,
    deviceStatus: {
        is_on: false,
        brightness: 0,
        sensor_value: 0,
        is_auto_mode: false,
    },
    pollInterval: null,
    chartInstance: null,
};

// ============ DOM Elements ============
const elements = {
    // Screens
    loginScreen: document.getElementById('login-screen'),
    dashboardScreen: document.getElementById('dashboard-screen'),
    
    // Login Form
    loginForm: document.getElementById('login-form'),
    usernameInput: document.getElementById('username'),
    passwordInput: document.getElementById('password'),
    loginError: document.getElementById('login-error'),
    loginBtn: document.getElementById('login-btn'),
    
    // Header
    connectionStatus: document.getElementById('connection-status'),
    logoutBtn: document.getElementById('logout-btn'),
    
    // Dashboard Display Info
    lightVisual: document.getElementById('light-visual'),
    brightnessDisplay: document.getElementById('brightness-display'),
    powerStatus: document.getElementById('power-status'),
    modeStatus: document.getElementById('mode-status'),
    sensorStatus: document.getElementById('sensor-status'),
    lastUpdated: document.getElementById('last-updated'),
    
    // Controls (Các nút điều khiển chính)
    powerToggle: document.getElementById('power-toggle'),
    brightnessSlider: document.getElementById('brightness-slider'),
    brightnessLabel: document.getElementById('brightness-label'),
    sliderFill: document.getElementById('slider-fill'),
    autoToggle: document.getElementById('auto-toggle'),
    
    // Chart Elements
    chartHours: document.getElementById('chart-hours'),
    refreshChartBtn: document.getElementById('refresh-chart-btn'),
    sensorChart: document.getElementById('sensor-chart'),
    
    // Toast Notification
    toastContainer: document.getElementById('toast-container'),
};

// ============ API Functions ============
async function apiRequest(endpoint, options = {}) {
    const url = `${CONFIG.API_URL}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    
    if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
    }
    
    try {
        const response = await fetch(url, {
            ...options,
            headers,
        });
        
        if (response.status === 401) {
            logout();
            throw new Error('Phiên đăng nhập đã hết hạn');
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.detail || 'Có lỗi xảy ra');
        }
        
        return data;
    } catch (error) {
        if (error.name === 'TypeError') {
            setConnectionStatus(false);
            throw new Error('Không thể kết nối đến server');
        }
        throw error;
    }
}

async function login(username, password) {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    
    const response = await fetch(`${CONFIG.API_URL}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Đăng nhập thất bại');
    return data;
}

async function verifyToken(token) {
    try {
        const response = await fetch(`${CONFIG.API_URL}/api/device/status`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        return response.ok;
    } catch {
        return false;
    }
}

async function getDeviceStatus() {
    return await apiRequest('/api/device/status');
}

async function controlDevice(action, options = {}) {
    return await apiRequest('/api/device/control', {
        method: 'POST',
        body: JSON.stringify({
            action,
            ...options,
        }),
    });
}

// Đã XÓA hàm getSettings và updateSettings vì không còn dùng nữa

async function getSensorHistory(hours = 24) {
    return await apiRequest(`/api/device/history?hours=${hours}&limit=500`);
}

// ============ UI Update Functions ============
function showScreen(screenName) {
    if (screenName === 'login') {
        elements.loginScreen.style.display = 'flex';
        elements.loginScreen.classList.remove('hidden');
        elements.dashboardScreen.style.display = 'none';
        elements.dashboardScreen.classList.add('hidden');
    } else if (screenName === 'dashboard') {
        elements.loginScreen.style.display = 'none';
        elements.loginScreen.classList.add('hidden');
        elements.dashboardScreen.style.display = 'block';
        elements.dashboardScreen.classList.remove('hidden');
    }
}

function setConnectionStatus(connected) {
    state.isConnected = connected;
    elements.connectionStatus.classList.toggle('online', connected);
    elements.connectionStatus.classList.toggle('offline', !connected);
    elements.connectionStatus.querySelector('.status-text').textContent = 
        connected ? 'Đã kết nối' : 'Mất kết nối';
}

function updateDeviceUI() {
    const { is_on, brightness, sensor_value, is_auto_mode } = state.deviceStatus;
    
    // Light visual
    elements.lightVisual.classList.toggle('on', is_on);
    elements.brightnessDisplay.textContent = brightness;
    
    // Power status
    elements.powerStatus.textContent = is_on ? 'Đang bật' : 'Đang tắt';
    elements.powerStatus.className = `info-value ${is_on ? 'on' : 'off'}`;
    
    // Mode status
    elements.modeStatus.textContent = is_auto_mode ? 'Tự động' : 'Thủ công';
    elements.modeStatus.className = `info-value ${is_auto_mode ? 'auto' : 'manual'}`;
    
    // Sensor value
    elements.sensorStatus.textContent = sensor_value;
    
    // Power button
    elements.powerToggle.classList.toggle('on', is_on);
    
    // Brightness slider (Cập nhật vị trí slider theo thực tế)
    elements.brightnessSlider.value = brightness;
    elements.brightnessLabel.textContent = `${brightness}%`;
    elements.sliderFill.style.width = `${brightness}%`;
    
    // Auto toggle
    elements.autoToggle.checked = is_auto_mode;
    
    // Đã XÓA: updateSensorIndicator (vì không còn thanh ngưỡng)
}

function updateLastUpdated() {
    const now = new Date();
    elements.lastUpdated.textContent = now.toLocaleTimeString('vi-VN');
}

// ============ Chart Functions (Giữ nguyên để xem lịch sử) ============
function initChart() {
    if (state.chartInstance) {
        state.chartInstance.destroy();
    }
    
    const ctx = elements.sensorChart.getContext('2d');
    
    state.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'Cảm biến ánh sáng',
                    data: [],
                    borderColor: '#00d4ff',
                    backgroundColor: 'rgba(0, 212, 255, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    borderWidth: 2,
                },
                {
                    label: 'Độ sáng đèn (%)',
                    data: [],
                    borderColor: '#ffaa00',
                    backgroundColor: 'rgba(255, 170, 0, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    borderWidth: 2,
                    yAxisID: 'y1',
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', labels: { color: '#8888a0' } },
            },
            scales: {
                x: { ticks: { color: '#555566' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { 
                    type: 'linear', position: 'left', ticks: { color: '#00d4ff' },
                    title: { display: true, text: 'Cảm biến', color: '#00d4ff' }
                },
                y1: { 
                    type: 'linear', position: 'right', min: 0, max: 100, ticks: { color: '#ffaa00' },
                    title: { display: true, text: 'Độ sáng (%)', color: '#ffaa00' }
                },
            },
        },
    });
}

async function refreshChart() {
    try {
        const hours = parseInt(elements.chartHours.value);
        const response = await getSensorHistory(hours);
        
        if (response.data && response.data.length > 0) {
            const labels = response.data.map(item => {
                const date = new Date(item.timestamp);
                return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            });
            state.chartInstance.data.labels = labels;
            state.chartInstance.data.datasets[0].data = response.data.map(i => i.sensor_value);
            state.chartInstance.data.datasets[1].data = response.data.map(i => i.brightness);
            state.chartInstance.update('none');
        }
    } catch (error) { console.error('Error refreshing chart:', error); }
}

// ============ Toast Notifications ============
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`; // Simplified structure
    elements.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============ Polling Functions ============
function startPolling() {
    if (state.pollInterval) clearInterval(state.pollInterval);
    fetchStatus();
    refreshChart();
    state.pollInterval = setInterval(async () => { await fetchStatus(); }, CONFIG.POLL_INTERVAL);
}

function stopPolling() {
    if (state.pollInterval) {
        clearInterval(state.pollInterval);
        state.pollInterval = null;
    }
}

async function fetchStatus() {
    try {
        const status = await getDeviceStatus();
        state.deviceStatus = status;
        setConnectionStatus(true);
        updateDeviceUI();
        updateLastUpdated();
    } catch (error) {
        console.error('Error fetching status:', error);
        setConnectionStatus(false);
    }
}

// ============ Auth Functions ============
function logout() {
    state.token = null;
    localStorage.removeItem('access_token');
    stopPolling();
    showScreen('login');
    elements.loginError.classList.remove('show');
    elements.usernameInput.value = '';
    elements.passwordInput.value = '';
}

async function tryAutoLogin() {
    const savedToken = localStorage.getItem('access_token');
    if (!savedToken) { showScreen('login'); return; }
    
    const isValid = await verifyToken(savedToken);
    if (isValid) {
        state.token = savedToken;
        showScreen('dashboard');
        initChart();
        startPolling();
    } else {
        localStorage.removeItem('access_token');
        showScreen('login');
    }
}

// ============ Event Handlers ============
function setupEventListeners() {
    // Login
    elements.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = elements.usernameInput.value.trim();
        const password = elements.passwordInput.value;
        if (!username || !password) return; // Basic validation
        
        elements.loginBtn.disabled = true;
        try {
            const data = await login(username, password);
            state.token = data.access_token;
            localStorage.setItem('access_token', data.access_token);
            showScreen('dashboard');
            initChart();
            startPolling();
            showToast('Đăng nhập thành công!', 'success');
        } catch (error) {
            elements.loginError.textContent = error.message;
            elements.loginError.classList.add('show');
        } finally {
            elements.loginBtn.disabled = false;
        }
    });
    
    // Logout
    elements.logoutBtn.addEventListener('click', () => { logout(); showToast('Đã đăng xuất', 'info'); });
    
    // Power Toggle
    elements.powerToggle.addEventListener('click', async () => {
        if (!state.token) return;
        try {
            const newState = !state.deviceStatus.is_on;
            await controlDevice('TOGGLE_POWER', { state: newState });
            showToast(newState ? 'Đã bật đèn' : 'Đã tắt đèn', 'success');
            // Cập nhật UI ngay lập tức cho mượt
            state.deviceStatus.is_on = newState;
            updateDeviceUI();
        } catch (error) { showToast(error.message, 'error'); }
    });
    
    // Brightness Slider
    let brightnessTimeout;
    elements.brightnessSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        elements.brightnessLabel.textContent = `${value}%`;
        elements.sliderFill.style.width = `${value}%`;
        
        if (!state.token) return;
        
        clearTimeout(brightnessTimeout);
        brightnessTimeout = setTimeout(async () => {
            try {
                await controlDevice('SET_BRIGHTNESS', { value });
                showToast(`Độ sáng: ${value}%`, 'success');
            } catch (error) { showToast(error.message, 'error'); }
        }, 300);
    });
    
    // Auto Toggle (Đơn giản hóa: Chỉ bật/tắt)
    elements.autoToggle.addEventListener('change', async (e) => {
        if (!state.token) { e.target.checked = !e.target.checked; return; }
        try {
            const enable = e.target.checked;
            await controlDevice('SET_AUTO', { enable });
            showToast(enable ? 'Đã bật chế độ tự động' : 'Đã tắt chế độ tự động', 'success');
        } catch (error) {
            showToast(error.message, 'error');
            e.target.checked = !e.target.checked;
        }
    });
    
    // Chart Controls
    elements.chartHours.addEventListener('change', () => { if (state.token) refreshChart(); });
    elements.refreshChartBtn.addEventListener('click', () => { if (state.token) refreshChart(); });
}

// ============ Initialization ============
async function init() {
    elements.dashboardScreen.style.display = 'none';
    elements.dashboardScreen.classList.add('hidden');
    elements.loginScreen.style.display = 'flex';
    elements.loginScreen.classList.remove('hidden');
    
    setupEventListeners();
    await tryAutoLogin();
}

document.addEventListener('DOMContentLoaded', init);