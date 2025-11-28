/**
 * IoT Smart Light - Frontend Application
 * ======================================
 */

// ============ Configuration ============
const CONFIG = {
    API_URL: 'http://127.0.0.1:8000',
    POLL_INTERVAL: 3000, // Poll status every 3 seconds
    CHART_REFRESH_INTERVAL: 30000, // Refresh chart every 30 seconds
};

// ============ State Management ============
const state = {
    token: null, // Will be loaded from localStorage after validation
    isConnected: false,
    deviceStatus: {
        is_on: false,
        brightness: 0,
        sensor_value: 0,
        is_auto_mode: false,
    },
    settings: {
        light_threshold_low: 300,
        light_threshold_high: 700,
        auto_brightness: 80,
    },
    pollInterval: null,
    chartInstance: null,
};

// ============ DOM Elements ============
const elements = {
    // Screens
    loginScreen: document.getElementById('login-screen'),
    dashboardScreen: document.getElementById('dashboard-screen'),
    
    // Login
    loginForm: document.getElementById('login-form'),
    usernameInput: document.getElementById('username'),
    passwordInput: document.getElementById('password'),
    loginError: document.getElementById('login-error'),
    loginBtn: document.getElementById('login-btn'),
    
    // Header
    connectionStatus: document.getElementById('connection-status'),
    logoutBtn: document.getElementById('logout-btn'),
    
    // Status
    lightVisual: document.getElementById('light-visual'),
    brightnessDisplay: document.getElementById('brightness-display'),
    powerStatus: document.getElementById('power-status'),
    modeStatus: document.getElementById('mode-status'),
    sensorStatus: document.getElementById('sensor-status'),
    lastUpdated: document.getElementById('last-updated'),
    
    // Controls
    powerToggle: document.getElementById('power-toggle'),
    brightnessSlider: document.getElementById('brightness-slider'),
    brightnessLabel: document.getElementById('brightness-label'),
    sliderFill: document.getElementById('slider-fill'),
    autoToggle: document.getElementById('auto-toggle'),
    
    // Settings
    thresholdLow: document.getElementById('threshold-low'),
    thresholdHigh: document.getElementById('threshold-high'),
    autoBrightness: document.getElementById('auto-brightness'),
    thresholdLowLabel: document.getElementById('threshold-low-label'),
    thresholdHighLabel: document.getElementById('threshold-high-label'),
    autoBrightnessLabel: document.getElementById('auto-brightness-label'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),
    zoneDark: document.getElementById('zone-dark'),
    zoneNormal: document.getElementById('zone-normal'),
    zoneBright: document.getElementById('zone-bright'),
    sensorIndicator: document.getElementById('sensor-indicator'),
    thresholdLowMark: document.getElementById('threshold-low-mark'),
    thresholdHighMark: document.getElementById('threshold-high-mark'),
    
    // Chart
    chartHours: document.getElementById('chart-hours'),
    refreshChartBtn: document.getElementById('refresh-chart-btn'),
    sensorChart: document.getElementById('sensor-chart'),
    
    // Toast
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
            // Token expired or invalid
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
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.detail || 'Đăng nhập thất bại');
    }
    
    return data;
}

async function verifyToken(token) {
    // Try to fetch device status to verify token is valid
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

async function getSettings() {
    return await apiRequest('/api/device/settings');
}

async function updateSettings(settings) {
    return await apiRequest('/api/device/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
    });
}

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
    
    // Brightness slider
    elements.brightnessSlider.value = brightness;
    elements.brightnessLabel.textContent = `${brightness}%`;
    elements.sliderFill.style.width = `${brightness}%`;
    
    // Auto toggle
    elements.autoToggle.checked = is_auto_mode;
    
    // Update sensor indicator in threshold visual
    updateSensorIndicator(sensor_value);
}

function updateSettingsUI() {
    const { light_threshold_low, light_threshold_high, auto_brightness } = state.settings;
    
    elements.thresholdLow.value = light_threshold_low;
    elements.thresholdHigh.value = light_threshold_high;
    elements.autoBrightness.value = auto_brightness;
    
    elements.thresholdLowLabel.textContent = light_threshold_low;
    elements.thresholdHighLabel.textContent = light_threshold_high;
    elements.autoBrightnessLabel.textContent = `${auto_brightness}%`;
    
    elements.thresholdLowMark.textContent = light_threshold_low;
    elements.thresholdHighMark.textContent = light_threshold_high;
    
    // Update threshold zones
    updateThresholdZones();
}

function updateThresholdZones() {
    const { light_threshold_low, light_threshold_high } = state.settings;
    const total = 1000;
    
    const lowPercent = (light_threshold_low / total) * 100;
    const highPercent = (light_threshold_high / total) * 100;
    
    elements.zoneDark.style.width = `${lowPercent}%`;
    elements.zoneNormal.style.width = `${highPercent - lowPercent}%`;
    elements.zoneBright.style.width = `${100 - highPercent}%`;
}

function updateSensorIndicator(sensorValue) {
    const percent = Math.min(100, (sensorValue / 1000) * 100);
    elements.sensorIndicator.style.left = `${percent}%`;
}

function updateLastUpdated() {
    const now = new Date();
    elements.lastUpdated.textContent = now.toLocaleTimeString('vi-VN');
}

// ============ Chart Functions ============
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
                    pointHoverRadius: 6,
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
                    pointHoverRadius: 6,
                    borderWidth: 2,
                    yAxisID: 'y1',
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#8888a0',
                        font: {
                            family: "'Plus Jakarta Sans', sans-serif",
                        },
                    },
                },
                tooltip: {
                    backgroundColor: '#1a1a24',
                    titleColor: '#f0f0f5',
                    bodyColor: '#8888a0',
                    borderColor: '#2a2a3a',
                    borderWidth: 1,
                },
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                    },
                    ticks: {
                        color: '#555566',
                        maxRotation: 0,
                        maxTicksLimit: 8,
                    },
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                    },
                    ticks: {
                        color: '#00d4ff',
                    },
                    title: {
                        display: true,
                        text: 'Cảm biến',
                        color: '#00d4ff',
                    },
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    min: 0,
                    max: 100,
                    grid: {
                        drawOnChartArea: false,
                    },
                    ticks: {
                        color: '#ffaa00',
                    },
                    title: {
                        display: true,
                        text: 'Độ sáng (%)',
                        color: '#ffaa00',
                    },
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
            
            const sensorData = response.data.map(item => item.sensor_value);
            const brightnessData = response.data.map(item => item.brightness);
            
            state.chartInstance.data.labels = labels;
            state.chartInstance.data.datasets[0].data = sensorData;
            state.chartInstance.data.datasets[1].data = brightnessData;
            state.chartInstance.update('none');
        }
    } catch (error) {
        console.error('Error refreshing chart:', error);
    }
}

// ============ Toast Notifications ============
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px">
            ${type === 'success' 
                ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
                : type === 'error'
                ? '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
                : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
            }
        </svg>
        <span>${message}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============ Polling Functions ============
function startPolling() {
    if (state.pollInterval) {
        clearInterval(state.pollInterval);
    }
    
    // Initial fetch
    fetchStatus();
    fetchSettings();
    refreshChart();
    
    // Start polling
    state.pollInterval = setInterval(async () => {
        await fetchStatus();
    }, CONFIG.POLL_INTERVAL);
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

async function fetchSettings() {
    try {
        const settings = await getSettings();
        state.settings = settings;
        updateSettingsUI();
    } catch (error) {
        console.error('Error fetching settings:', error);
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
    
    if (!savedToken) {
        showScreen('login');
        return;
    }
    
    // Verify saved token with server
    const isValid = await verifyToken(savedToken);
    
    if (isValid) {
        state.token = savedToken;
        showScreen('dashboard');
        initChart();
        startPolling();
    } else {
        // Token invalid, clear it and show login
        localStorage.removeItem('access_token');
        showScreen('login');
    }
}

// ============ Event Handlers ============
function setupEventListeners() {
    // Login form
    elements.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = elements.usernameInput.value.trim();
        const password = elements.passwordInput.value;
        
        if (!username || !password) {
            elements.loginError.textContent = 'Vui lòng nhập tên đăng nhập và mật khẩu';
            elements.loginError.classList.add('show');
            return;
        }
        
        elements.loginBtn.disabled = true;
        elements.loginBtn.innerHTML = '<span>Đang đăng nhập...</span>';
        elements.loginError.classList.remove('show');
        
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
            elements.loginBtn.innerHTML = `
                <span>Đăng nhập</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
            `;
        }
    });
    
    // Logout
    elements.logoutBtn.addEventListener('click', () => {
        logout();
        showToast('Đã đăng xuất', 'info');
    });
    
    // Power toggle
    elements.powerToggle.addEventListener('click', async () => {
        if (!state.token) {
            showToast('Vui lòng đăng nhập trước', 'error');
            return;
        }
        try {
            const newState = !state.deviceStatus.is_on;
            await controlDevice('TOGGLE_POWER', { state: newState });
            showToast(newState ? 'Đã bật đèn' : 'Đã tắt đèn', 'success');
            // Immediate UI feedback
            state.deviceStatus.is_on = newState;
            updateDeviceUI();
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
    
    // Brightness slider
    let brightnessTimeout;
    elements.brightnessSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        elements.brightnessLabel.textContent = `${value}%`;
        elements.sliderFill.style.width = `${value}%`;
        
        if (!state.token) return;
        
        // Debounce API call
        clearTimeout(brightnessTimeout);
        brightnessTimeout = setTimeout(async () => {
            try {
                await controlDevice('SET_BRIGHTNESS', { value });
                showToast(`Độ sáng: ${value}%`, 'success');
            } catch (error) {
                showToast(error.message, 'error');
            }
        }, 300);
    });
    
    // Auto toggle
    elements.autoToggle.addEventListener('change', async (e) => {
        if (!state.token) {
            e.target.checked = !e.target.checked;
            showToast('Vui lòng đăng nhập trước', 'error');
            return;
        }
        try {
            const enable = e.target.checked;
            await controlDevice('SET_AUTO', { enable });
            showToast(enable ? 'Đã bật chế độ tự động' : 'Đã tắt chế độ tự động', 'success');
        } catch (error) {
            showToast(error.message, 'error');
            e.target.checked = !e.target.checked; // Revert
        }
    });
    
    // Settings sliders
    elements.thresholdLow.addEventListener('input', (e) => {
        elements.thresholdLowLabel.textContent = e.target.value;
        elements.thresholdLowMark.textContent = e.target.value;
        state.settings.light_threshold_low = parseInt(e.target.value);
        updateThresholdZones();
    });
    
    elements.thresholdHigh.addEventListener('input', (e) => {
        elements.thresholdHighLabel.textContent = e.target.value;
        elements.thresholdHighMark.textContent = e.target.value;
        state.settings.light_threshold_high = parseInt(e.target.value);
        updateThresholdZones();
    });
    
    elements.autoBrightness.addEventListener('input', (e) => {
        elements.autoBrightnessLabel.textContent = `${e.target.value}%`;
    });
    
    // Save settings
    elements.saveSettingsBtn.addEventListener('click', async () => {
        if (!state.token) {
            showToast('Vui lòng đăng nhập trước', 'error');
            return;
        }
        
        const low = parseInt(elements.thresholdLow.value);
        const high = parseInt(elements.thresholdHigh.value);
        const brightness = parseInt(elements.autoBrightness.value);
        
        if (low >= high) {
            showToast('Ngưỡng tối phải nhỏ hơn ngưỡng sáng', 'error');
            return;
        }
        
        try {
            await updateSettings({
                light_threshold_low: low,
                light_threshold_high: high,
                auto_brightness: brightness,
            });
            showToast('Đã lưu cài đặt', 'success');
            await fetchSettings();
        } catch (error) {
            showToast(error.message, 'error');
        }
    });
    
    // Chart controls
    elements.chartHours.addEventListener('change', () => {
        if (state.token) {
            refreshChart();
        }
    });
    
    elements.refreshChartBtn.addEventListener('click', () => {
        if (state.token) {
            refreshChart();
            showToast('Đã cập nhật biểu đồ', 'info');
        }
    });
}

// ============ Initialization ============
async function init() {
    // IMPORTANT: Hide dashboard initially, show only login
    elements.dashboardScreen.style.display = 'none';
    elements.dashboardScreen.classList.add('hidden');
    elements.loginScreen.style.display = 'flex';
    elements.loginScreen.classList.remove('hidden');
    
    setupEventListeners();
    
    // Try auto login with saved token
    await tryAutoLogin();
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
