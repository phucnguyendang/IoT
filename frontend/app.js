/**
 * IoT Smart Light - Frontend Application (Cleaned Version)
 * ======================================
 */

// ============ Configuration ============
const CONFIG = {
    API_URL: 'http://127.0.0.1:8000',
    POLL_INTERVAL: 2000, // Cập nhật trạng thái mỗi 2 giây
    // ĐÃ XÓA: CHART_REFRESH_INTERVAL
    UPDATE_DELAY: 4000 
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
    // ĐÃ XÓA: chartInstance
    
    // Cờ chặn cập nhật khi người dùng đang thao tác
    isInteracting: false, 
    interactionTimeout: null
};

// ============ DOM Elements ============
const elements = {
    loginScreen: document.getElementById('login-screen'),
    dashboardScreen: document.getElementById('dashboard-screen'),
    loginForm: document.getElementById('login-form'),
    usernameInput: document.getElementById('username'),
    passwordInput: document.getElementById('password'),
    loginError: document.getElementById('login-error'),
    loginBtn: document.getElementById('login-btn'),
    connectionStatus: document.getElementById('connection-status'),
    logoutBtn: document.getElementById('logout-btn'),
    lightVisual: document.getElementById('light-visual'),
    brightnessDisplay: document.getElementById('brightness-display'),
    powerStatus: document.getElementById('power-status'),
    modeStatus: document.getElementById('mode-status'),
    sensorStatus: document.getElementById('sensor-status'),
    lastUpdated: document.getElementById('last-updated'),
    powerToggle: document.getElementById('power-toggle'),
    brightnessSlider: document.getElementById('brightness-slider'),
    brightnessLabel: document.getElementById('brightness-label'),
    sliderFill: document.getElementById('slider-fill'),
    autoToggle: document.getElementById('auto-toggle'),
    // ĐÃ XÓA: chartHours, refreshChartBtn, sensorChart
    toastContainer: document.getElementById('toast-container'),
};

// ============ API Functions ============
async function apiRequest(endpoint, options = {}) {
    const url = `${CONFIG.API_URL}${endpoint}`;
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
    
    try {
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401) { logout(); throw new Error('Phiên đăng nhập hết hạn'); }
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Lỗi hệ thống');
        return data;
    } catch (error) {
        if (error.name === 'TypeError') { setConnectionStatus(false); throw new Error('Mất kết nối Server'); }
        throw error;
    }
}

async function login(username, password) {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    return await apiRequest('/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formData });
}

async function getDeviceStatus() { return await apiRequest('/api/device/status'); }

async function controlDevice(action, options = {}) {
    return await apiRequest('/api/device/control', { method: 'POST', body: JSON.stringify({ action, ...options }) });
}

// ĐÃ XÓA: getSensorHistory()

// ============ UI Update Functions ============
function showScreen(screenName) {
    elements.loginScreen.style.display = (screenName === 'login') ? 'flex' : 'none';
    elements.dashboardScreen.style.display = (screenName === 'dashboard') ? 'block' : 'none';
}

function setConnectionStatus(connected) {
    state.isConnected = connected;
    elements.connectionStatus.className = `status-badge ${connected ? 'online' : 'offline'}`;
    elements.connectionStatus.querySelector('.status-text').textContent = connected ? 'Đã kết nối' : 'Mất kết nối';
}

function updateDeviceUI() {
    // === CHỐNG NHẢY SỐ ===
    // Nếu người dùng đang thao tác hoặc vừa thao tác xong -> KHÔNG cập nhật từ Server
    if (state.isInteracting) return;

    const { is_on, brightness, sensor_value, is_auto_mode } = state.deviceStatus;
    
    // Cập nhật trạng thái đèn
    elements.lightVisual.classList.toggle('on', is_on);
    elements.brightnessDisplay.textContent = brightness;
    
    elements.powerStatus.textContent = is_on ? 'Đang bật' : 'Đang tắt';
    elements.powerStatus.className = `info-value ${is_on ? 'on' : 'off'}`;
    
    elements.modeStatus.textContent = is_auto_mode ? 'Tự động' : 'Thủ công';
    elements.modeStatus.className = `info-value ${is_auto_mode ? 'auto' : 'manual'}`;
    
    elements.sensorStatus.textContent = sensor_value;
    
    // Cập nhật nút nguồn và slider
    elements.powerToggle.classList.toggle('on', is_on);
    
    // Chỉ cập nhật slider khi người dùng KHÔNG chạm vào nó
    elements.brightnessSlider.value = brightness;
    elements.brightnessLabel.textContent = `${brightness}%`;
    elements.sliderFill.style.width = `${brightness}%`;
    
    elements.autoToggle.checked = is_auto_mode;
}

function updateLastUpdated() {
    elements.lastUpdated.textContent = new Date().toLocaleTimeString('vi-VN');
}

// ============ Helper: Lock UI ============
function lockUI() {
    state.isInteracting = true;
    clearTimeout(state.interactionTimeout);
}

function unlockUI() {
    // Đợi 4 giây sau khi thao tác xong mới cho phép Server cập nhật lại
    // Để đảm bảo dữ liệu cũ đã bị ESP32 ghi đè xong
    clearTimeout(state.interactionTimeout);
    state.interactionTimeout = setTimeout(() => {
        state.isInteracting = false;
    }, CONFIG.UPDATE_DELAY);
}

// ============ Polling Functions ============
function startPolling() {
    if (state.pollInterval) clearInterval(state.pollInterval);
    fetchStatus();
    // ĐÃ XÓA: refreshChart();
    state.pollInterval = setInterval(fetchStatus, CONFIG.POLL_INTERVAL);
}

function stopPolling() {
    if (state.pollInterval) { clearInterval(state.pollInterval); state.pollInterval = null; }
}

async function fetchStatus() {
    // Nếu đang bị khóa (đang chỉnh tay) thì bỏ qua lần cập nhật này
    if (state.isInteracting) return;
    
    try {
        const status = await getDeviceStatus();
        state.deviceStatus = status;
        setConnectionStatus(true);
        updateDeviceUI();
        updateLastUpdated();
    } catch (error) {
        console.error('Polling error:', error);
        setConnectionStatus(false);
    }
}

// ============ Event Handlers ============
function setupEventListeners() {
    // Login
    elements.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const u = elements.usernameInput.value.trim();
        const p = elements.passwordInput.value;
        if (!u || !p) return;
        
        elements.loginBtn.disabled = true;
        try {
            const data = await login(u, p);
            state.token = data.access_token;
            localStorage.setItem('access_token', data.access_token);
            showScreen('dashboard');
            // ĐÃ XÓA: initChart();
            startPolling();
            showToast('Đăng nhập thành công', 'success');
        } catch (err) {
            elements.loginError.textContent = err.message;
            elements.loginError.classList.add('show');
        } finally { elements.loginBtn.disabled = false; }
    });
    
    elements.logoutBtn.addEventListener('click', () => {
        state.token = null;
        localStorage.removeItem('access_token');
        stopPolling();
        showScreen('login');
    });

    // --- 1. NÚT NGUỒN (Khắc phục lỗi không tắt được) ---
    elements.powerToggle.addEventListener('click', async () => {
        if (!state.token) return;
        
        lockUI(); // Khóa cập nhật từ Server ngay lập tức

        // Logic UI: Đảo ngược trạng thái hiện tại
        const newState = !state.deviceStatus.is_on;
        state.deviceStatus.is_on = newState;
        
        // Nếu TẮT -> Bắt buộc tắt luôn chế độ Auto trên giao diện
        if (newState === false) {
            state.deviceStatus.is_auto_mode = false;
            state.deviceStatus.brightness = 0;
            // Cập nhật UI ngay lập tức để người dùng thấy đèn đã tắt
            elements.powerToggle.classList.remove('on');
            elements.lightVisual.classList.remove('on');
            elements.autoToggle.checked = false;
            elements.modeStatus.textContent = 'Thủ công';
        } else {
            // Nếu BẬT -> Hiện sáng
            elements.powerToggle.classList.add('on');
            elements.lightVisual.classList.add('on');
        }
        
        // Gửi lệnh xuống Server
        try {
            await controlDevice('TOGGLE_POWER', { state: newState });
            showToast(newState ? 'Đã bật đèn' : 'Đã tắt đèn', 'success');
        } catch (error) {
            showToast(error.message, 'error');
            // Nếu lỗi thì hoàn tác lại UI
            state.deviceStatus.is_on = !newState;
            updateDeviceUI();
        } finally {
            unlockUI(); // Giữ khóa UI thêm 4 giây nữa
        }
    });
    
    // --- 2. THANH TRƯỢT (Khắc phục lỗi nhảy số) ---
    let debounceTimer;

    // Khi bắt đầu chạm vào -> Khóa ngay
    const startInteraction = () => { lockUI(); };
    elements.brightnessSlider.addEventListener('mousedown', startInteraction);
    elements.brightnessSlider.addEventListener('touchstart', startInteraction);

    elements.brightnessSlider.addEventListener('input', (e) => {
        lockUI(); // Đảm bảo luôn khóa khi đang kéo
        
        const val = parseInt(e.target.value);
        
        // Cập nhật số hiển thị ngay lập tức (Responsive)
        elements.brightnessLabel.textContent = `${val}%`;
        elements.sliderFill.style.width = `${val}%`;
        
        // Logic: Kéo thanh trượt -> Tự động chuyển sang chế độ Thủ công
        if (state.deviceStatus.is_auto_mode) {
             state.deviceStatus.is_auto_mode = false;
             elements.autoToggle.checked = false;
             elements.modeStatus.textContent = 'Thủ công';
             elements.modeStatus.className = 'info-value manual';
        }

        // Debounce: Chỉ gửi lệnh khi dừng kéo 300ms
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            try {
                await controlDevice('SET_BRIGHTNESS', { value: val });
                state.deviceStatus.brightness = val;
            } catch (err) { console.error(err); }
        }, 300);
    });

    // Khi thả tay ra -> Chờ 4 giây rồi mới mở khóa cập nhật
    const endInteraction = () => { unlockUI(); };
    elements.brightnessSlider.addEventListener('mouseup', endInteraction);
    elements.brightnessSlider.addEventListener('touchend', endInteraction);
    elements.brightnessSlider.addEventListener('change', endInteraction);

    // --- 3. NÚT AUTO ---
    elements.autoToggle.addEventListener('change', async (e) => {
        lockUI();
        const enable = e.target.checked;
        
        state.deviceStatus.is_auto_mode = enable;
        updateDeviceUI();

        try {
            await controlDevice('SET_AUTO', { enable });
            showToast(enable ? 'Bật tự động' : 'Tắt tự động', 'success');
        } catch (error) {
            showToast(error.message, 'error');
            e.target.checked = !enable;
            state.deviceStatus.is_auto_mode = !enable;
            updateDeviceUI();
        } finally {
            unlockUI();
        }
    });
    
    // ĐÃ XÓA: Các EventListener của chart
}

// ============ Init ============
// ĐÃ XÓA: function initChart(), function refreshChart()

document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    const savedToken = localStorage.getItem('access_token');
    if (savedToken) {
        try {
            state.token = savedToken;
            await getDeviceStatus(); 
            showScreen('dashboard');
            // ĐÃ XÓA: initChart();
            startPolling();
        } catch { logout(); }
    }
});