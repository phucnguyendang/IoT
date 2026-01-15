// CONFIGURATION
const CONFIG = {
    API_URL: 'http://127.0.0.1:8000',    
    POLL_INTERVAL: 2000,                 
    UPDATE_DELAY: 4000                  
};

// STATE MANAGEMENT
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
    isInteracting: false,
    interactionTimeout: null
};


const elements = {
    // Màn hình đăng nhập
    loginScreen: document.getElementById('login-screen'),
    loginForm: document.getElementById('login-form'),
    usernameInput: document.getElementById('username'),
    passwordInput: document.getElementById('password'),
    loginError: document.getElementById('login-error'),
    loginBtn: document.getElementById('login-btn'),
    
    // Màn hình dashboard
    dashboardScreen: document.getElementById('dashboard-screen'),
    connectionStatus: document.getElementById('connection-status'),
    logoutBtn: document.getElementById('logout-btn'),
    
    // Hiển thị trạng thái thiết bị
    lightVisual: document.getElementById('light-visual'),
    brightnessDisplay: document.getElementById('brightness-display'),
    powerStatus: document.getElementById('power-status'),
    modeStatus: document.getElementById('mode-status'),
    sensorStatus: document.getElementById('sensor-status'),
    lastUpdated: document.getElementById('last-updated'),
    
    // Điều khiển thiết bị
    powerToggle: document.getElementById('power-toggle'),
    brightnessSlider: document.getElementById('brightness-slider'),
    brightnessLabel: document.getElementById('brightness-label'),
    sliderFill: document.getElementById('slider-fill'),
    autoToggle: document.getElementById('auto-toggle'),
    
    // Toast notification
    toastContainer: document.getElementById('toast-container'),

    // Biểu đồ lịch sử
    historyDateInput: document.getElementById('history-date'),
    loadHistoryBtn: document.getElementById('btn-load-history'),
    chartCanvas: document.getElementById('historyChart'),
};


/**
 * @param {string} endpoint         
 * @param {object} options    
 * @returns {Promise}            
 */

async function apiRequest(endpoint, options = {}) {
    const url = `${CONFIG.API_URL}${endpoint}`;
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    
    if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
    
    try {
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401) { 
            logout(); 
            throw new Error('Phiên đăng nhập hết hạn'); 
        }
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Lỗi hệ thống');
        return data;
    } catch (error) {
        if (error.name === 'TypeError') { 
            setConnectionStatus(false); 
            throw new Error('Mất kết nối Server'); 
        }
        throw error;
    }
}

/**
 * @param {string} username 
 * @param {string} password 
 * @returns {Promise}               - Promise trả về { access_token, token_type }
 */
async function login(username, password) {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    return await apiRequest('/token', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, 
        body: formData 
    });
}

/**
 * @returns {Promise}               - Promise trả về trạng thái thiết bị
 */
async function getDeviceStatus() { 
    return await apiRequest(`/api/device/status?t=${Date.now()}`); 
}


/**
 * @param {string} action           
 * @param {object} options         
 * @returns {Promise}               - Promise trả về kết quả từ Backend
 */
async function controlDevice(action, options = {}) {
    return await apiRequest('/api/device/control', { 
        method: 'POST', 
        body: JSON.stringify({ action, ...options }) 
    });
}

/**
 * 
 * @param {string} dateStr 
 * @returns {Promise}               - Promise trả về mảng dữ liệu lịch sử
 */
async function getHistoryByDate(dateStr) {
    return await apiRequest(`/api/device/history/by-date?target_date=${dateStr}`);
}



/**
 * Chuyển đổi giữa màn hình đăng nhập và dashboard
 * 
 * @param {string} screenName - 'login' hoặc 'dashboard'
 */
function showScreen(screenName) {
    elements.loginScreen.style.display = (screenName === 'login') ? 'flex' : 'none';
    elements.dashboardScreen.style.display = (screenName === 'dashboard') ? 'block' : 'none';
}

/**
 * Cập nhật hiển thị trạng thái kết nối với Backend
 * 
 * @param {boolean} connected 
 */
function setConnectionStatus(connected) {
    state.isConnected = connected;
    elements.connectionStatus.className = `status-badge ${connected ? 'online' : 'offline'}`;
    elements.connectionStatus.querySelector('.status-text').textContent = connected ? 'Đã kết nối' : 'Mất kết nối';
}

/**
 * Cập nhật giao diện hiển thị trạng thái thiết bị
 */
function updateDeviceUI() {
    const { is_on, brightness, sensor_value, is_auto_mode } = state.deviceStatus;
    
    elements.sensorStatus.textContent = sensor_value;
    
    // Cập nhật trạng thái nguồn (Đang bật / Đang tắt)
    elements.powerStatus.textContent = is_on ? 'Đang bật' : 'Đang tắt';
    elements.powerStatus.className = `info-value ${is_on ? 'on' : 'off'}`;
    
    // Cập nhật chế độ (Tự động / Thủ công)
    elements.modeStatus.textContent = is_auto_mode ? 'Tự động' : 'Thủ công';
    elements.modeStatus.className = `info-value ${is_auto_mode ? 'auto' : 'manual'}`;
    
    // Cập nhật hiệu ứng bóng đèn và nút nguồn
    elements.lightVisual.classList.toggle('on', is_on);
    elements.powerToggle.classList.toggle('on', is_on);
    
    // Cập nhật toggle chế độ tự động
    elements.autoToggle.checked = is_auto_mode;

    if (!state.isInteracting) {
        elements.brightnessDisplay.textContent = brightness;
        elements.brightnessSlider.value = brightness;
        elements.brightnessLabel.textContent = `${brightness}%`;
        elements.sliderFill.style.width = `${brightness}%`;
    }
}


function updateLastUpdated() {
    elements.lastUpdated.textContent = new Date().toLocaleTimeString('vi-VN');
}


function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function logout() {
    state.token = null;
    localStorage.removeItem('access_token');
    stopPolling();
    showScreen('login');
}

/**
 * Khóa UI: Đánh dấu người dùng đang tương tác
 * Khi UI bị khóa, hàm updateDeviceUI() sẽ không cập nhật thanh trượt
 */
function lockUI() {
    state.isInteracting = true;
    clearTimeout(state.interactionTimeout);
}

/**
 * Mở khóa UI: Sau một khoảng thời gian (UPDATE_DELAY), cho phép cập nhật lại
 * Khi người dùng ngừng tương tác, đợi UPDATE_DELAY giây rồi mới cho phép polling cập nhật UI
 */
function unlockUI() {
    clearTimeout(state.interactionTimeout);
    state.interactionTimeout = setTimeout(() => {
        state.isInteracting = false;
    }, CONFIG.UPDATE_DELAY);
}



async function loadAndDrawChart() {
    const dateStr = elements.historyDateInput.value;
    if (!dateStr) return showToast('Vui lòng chọn ngày', 'error');

    try {
        const data = await getHistoryByDate(dateStr);
        
        if (!data || data.length === 0) {
            showToast('Không có dữ liệu cho ngày này', 'info');
            drawChart([]);
            return;
        }
        
        drawChart(data);
        showToast('Đã tải dữ liệu lịch sử', 'success');
    } catch (error) {
        showToast('Lỗi tải biểu đồ', 'error');
        console.error(error);
    }
}


function drawChart(data) {
    // Trích xuất dữ liệu từ mảng
    const labels = data.map(item => item.timestamp);              // Thời gian (HH:MM:SS)
    const sensorData = data.map(item => item.sensor_value);       // Giá trị cảm biến
    const brightnessData = data.map(item => item.brightness);     // Độ sáng đèn

    const ctx = elements.chartCanvas.getContext('2d');

    if (state.chartInstance) {
        state.chartInstance.destroy();
    }

    state.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Cảm biến (Lux)',
                    data: sensorData,
                    borderColor: '#00d2ff',
                    backgroundColor: 'rgba(0, 210, 255, 0.1)',
                    yAxisID: 'y',
                    tension: 0.4,
                    pointRadius: 0
                },
                {
                    label: 'Độ sáng đèn (%)',
                    data: brightnessData,
                    borderColor: '#ffaa00',
                    backgroundColor: 'rgba(255, 170, 0, 0.2)',
                    yAxisID: 'y1',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'Giá trị cảm biến' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: 'Độ sáng (%)' },
                    grid: { drawOnChartArea: false },
                    min: 0,
                    max: 100
                }
            },
            animation: false
        }
    });
}


function updateChartLive() {
    if (!state.chartInstance) return;

    const selectedDate = elements.historyDateInput.value;
    const today = new Date().toISOString().split('T')[0];

    if (selectedDate === today && state.chartInstance.data.labels.length > 0) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('vi-VN', {hour12: false}); 
        
        state.chartInstance.data.labels.push(timeStr);
        state.chartInstance.data.datasets[0].data.push(state.deviceStatus.sensor_value);
        state.chartInstance.data.datasets[1].data.push(state.deviceStatus.brightness);

        state.chartInstance.update('none');
    }
}


function startPolling() {
    if (state.pollInterval) clearInterval(state.pollInterval);
    fetchStatus();
    state.pollInterval = setInterval(fetchStatus, CONFIG.POLL_INTERVAL);
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
        updateChartLive();      
        
    } catch (error) {
        console.error('Polling error:', error);
        setConnectionStatus(false);
    }
}


// EVENT HANDLERS
function setupEventListeners() {
    // 1. ĐĂNG NHẬP
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
            
            const today = new Date().toISOString().split('T')[0];
            elements.historyDateInput.value = today;
            loadAndDrawChart();

            startPolling();
            showToast('Đăng nhập thành công', 'success');
        } catch (err) {
            elements.loginError.textContent = err.message;
            elements.loginError.classList.add('show');
        } finally { 
            elements.loginBtn.disabled = false; 
        }
    });
    
    // 2. ĐĂNG XUẤT
    elements.logoutBtn.addEventListener('click', () => {
        state.token = null;
        localStorage.removeItem('access_token');
        stopPolling();
        showScreen('login');
    });

    // 3. NÚT BẬT/TẮT NGUỒN
    elements.powerToggle.addEventListener('click', async () => {
        if (!state.token) return;
        
        lockUI(); 
        const newState = !state.deviceStatus.is_on;
        state.deviceStatus.is_on = newState;
        
        if (newState === false) {
            state.deviceStatus.is_auto_mode = false;
            state.deviceStatus.brightness = 0;
            elements.brightnessDisplay.textContent = '0';
            elements.brightnessSlider.value = 0;
            elements.sliderFill.style.width = '0%';
            elements.brightnessLabel.textContent = '0%';
        } 
        updateDeviceUI();

        try {
            await controlDevice('TOGGLE_POWER', { state: newState });
            showToast(newState ? 'Đã bật đèn' : 'Đã tắt đèn', 'success');
        } catch (error) {
            showToast(error.message, 'error');
            state.deviceStatus.is_on = !newState;
            updateDeviceUI();
        } finally {
            unlockUI();
        }
    });
    
    // 4. THANH TRƯỢT ĐỘ SÁNG
    let debounceTimer;

    const startInteraction = () => { lockUI(); };
    elements.brightnessSlider.addEventListener('mousedown', startInteraction);
    elements.brightnessSlider.addEventListener('touchstart', startInteraction);

    elements.brightnessSlider.addEventListener('input', (e) => {
        lockUI(); 
        const val = parseInt(e.target.value);
        
        elements.brightnessLabel.textContent = `${val}%`;
        elements.sliderFill.style.width = `${val}%`;
        elements.brightnessDisplay.textContent = val;

        if (state.deviceStatus.is_auto_mode) {
             state.deviceStatus.is_auto_mode = false;
             updateDeviceUI();
        }

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            try {
                await controlDevice('SET_BRIGHTNESS', { value: val });
                state.deviceStatus.brightness = val;
            } catch (err) { 
                console.error(err); 
            }
        }, 300);
    });

    const endInteraction = () => { unlockUI(); };
    elements.brightnessSlider.addEventListener('mouseup', endInteraction);
    elements.brightnessSlider.addEventListener('touchend', endInteraction);
    elements.brightnessSlider.addEventListener('change', endInteraction);

    // 5. NÚT CHẾ ĐỘ TỰ ĐỘNG
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
            updateDeviceUI();
        } finally {
            unlockUI();
        }
    });
    
    // 6. NÚT TẢI BIỂU ĐỒ LỊCH SỬ
    elements.loadHistoryBtn.addEventListener('click', loadAndDrawChart);
}


document.addEventListener('DOMContentLoaded', async () => {
    // Thiết lập tất cả event listeners
    setupEventListeners();
    
    // Kiểm tra xem có token đã lưu từ lần đăng nhập trước không
    const savedToken = localStorage.getItem('access_token');
    if (savedToken) {
        try {
            state.token = savedToken;
            await getDeviceStatus(); 
            showScreen('dashboard');
            
            const today = new Date().toISOString().split('T')[0];
            elements.historyDateInput.value = today;
            loadAndDrawChart();

            startPolling();
        } catch { 
            logout(); 
        }
    }
});