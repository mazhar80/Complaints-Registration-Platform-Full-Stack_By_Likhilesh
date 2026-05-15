const BACKEND_BASE_URL = window.location.port === '5500' || window.location.port === '5501' 
    ? 'http://localhost:3000' 
    : window.location.origin;
const API_URL = `${BACKEND_BASE_URL}/api`;
let currentUser = null;

const app = document.getElementById('app');
const navbar = document.getElementById('navbar');
const toastContainer = document.getElementById('toast-container');

// --- Helpers ---

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function setLoading(isLoading) {
    if (isLoading) {
        app.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';
    }
}

async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
    };
    if (body) options.body = JSON.stringify(body);
    
    // Credentials true for cookies
    options.credentials = 'include';

    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Something went wrong');
        return data;
    } catch (error) {
        showToast(error.message, 'error');
        throw error;
    }
}

// --- Navigation ---

function updateNavbar() {
    if (currentUser) {
        navbar.classList.remove('hidden');
        document.querySelectorAll('.user-only').forEach(el => {
            el.classList.toggle('hidden', currentUser.role !== 'user');
        });
        document.querySelectorAll('.admin-only').forEach(el => {
            el.classList.toggle('hidden', currentUser.role !== 'admin');
        });
    } else {
        navbar.classList.add('hidden');
    }
}

// --- Views ---

async function showRegister() {
    app.innerHTML = `
        <div class="card">
            <h1>Create Account</h1>
            <p class="subtitle">Enter your details to get started</p>
            <form id="register-form">
                <div class="form-group">
                    <label>Full Name</label>
                    <input type="text" id="reg-name" required placeholder="John Doe">
                </div>
                <div class="form-group">
                    <label>Email Address</label>
                    <input type="email" id="reg-email" required placeholder="john@example.com">
                </div>
                <button type="submit" id="reg-submit-btn" class="btn-primary">Send OTP</button>
                <div id="reg-spinner" class="hidden" style="text-align: center; margin-top: 1rem;">
                    <div class="spinner" style="width: 30px; height: 30px; margin: 0 auto;"></div>
                    <p style="font-size: 0.875rem; color: var(--text-muted); margin-top: 0.5rem;">Please wait...</p>
                </div>
            </form>
            <p style="margin-top: 1.5rem; text-align: center; color: var(--text-muted);">
                Already have an account? <a href="#" id="link-login" style="color: var(--primary); text-decoration: none;">Login</a>
            </p>
        </div>
    `;

    document.getElementById('link-login').onclick = (e) => { e.preventDefault(); showLogin(); };

    document.getElementById('register-form').onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const btn = document.getElementById('reg-submit-btn');
        const spinner = document.getElementById('reg-spinner');
        
        btn.classList.add('hidden');
        spinner.classList.remove('hidden');

        try {
            await apiCall('/auth/send-otp', 'POST', { name, email });
            showOTPVerification(email);
        } catch (err) {
            btn.classList.remove('hidden');
            spinner.classList.add('hidden');
        }
    };
}

function showOTPVerification(email) {
    app.innerHTML = `
        <div class="card">
            <h1>Verify Email</h1>
            <p class="subtitle">We've sent a 6-digit code to ${email}</p>
            <form id="otp-form">
                <div class="form-group">
                    <label>Enter OTP</label>
                    <input type="text" id="otp-code" required maxlength="6" placeholder="000000" style="text-align: center; letter-spacing: 0.5rem; font-size: 1.5rem;">
                </div>
                <button type="submit" id="otp-submit-btn" class="btn-primary">Verify OTP</button>
                <div id="otp-spinner" class="hidden" style="text-align: center; margin-top: 1rem;">
                    <div class="spinner" style="width: 30px; height: 30px; margin: 0 auto;"></div>
                    <p style="font-size: 0.875rem; color: var(--text-muted); margin-top: 0.5rem;">Verifying...</p>
                </div>
            </form>
        </div>
    `;

    document.getElementById('otp-form').onsubmit = async (e) => {
        e.preventDefault();
        const otp = document.getElementById('otp-code').value;
        const btn = document.getElementById('otp-submit-btn');
        const spinner = document.getElementById('otp-spinner');

        btn.classList.add('hidden');
        spinner.classList.remove('hidden');

        try {
            await apiCall('/auth/verify-otp', 'POST', { email, otp });
            showPasswordSetup(email, otp);
        } catch (err) {
            btn.classList.remove('hidden');
            spinner.classList.add('hidden');
        }
    };
}

function showPasswordSetup(email, otp) {
    app.innerHTML = `
        <div class="card">
            <h1>Set Password</h1>
            <p class="subtitle">Secure your account with a strong password</p>
            <form id="password-form">
                <div class="form-group">
                    <label>Create Password</label>
                    <input type="password" id="reg-password" required placeholder="••••••••">
                </div>
                <div class="form-group">
                    <label>Confirm Password</label>
                    <input type="password" id="reg-confirm" required placeholder="••••••••">
                </div>
                <button type="submit" id="pass-submit-btn" class="btn-primary">Complete Registration</button>
                <div id="pass-spinner" class="hidden" style="text-align: center; margin-top: 1rem;">
                    <div class="spinner" style="width: 30px; height: 30px; margin: 0 auto;"></div>
                    <p style="font-size: 0.875rem; color: var(--text-muted); margin-top: 0.5rem;">Saving your account...</p>
                </div>
            </form>
        </div>
    `;

    document.getElementById('password-form').onsubmit = async (e) => {
        e.preventDefault();
        const password = document.getElementById('reg-password').value;
        const confirm = document.getElementById('reg-confirm').value;
        const btn = document.getElementById('pass-submit-btn');
        const spinner = document.getElementById('pass-spinner');

        if (password !== confirm) {
            return showToast('Passwords do not match', 'error');
        }

        btn.classList.add('hidden');
        spinner.classList.remove('hidden');

        try {
            await apiCall('/auth/register', 'POST', { email, otp, password });
            showToast('Registration successful! Please login.');
            showLogin();
        } catch (err) {
            btn.classList.remove('hidden');
            spinner.classList.add('hidden');
        }
    };
}


async function showLogin() {
    app.innerHTML = `
        <div class="card">
            <h1>Welcome Back</h1>
            <p class="subtitle">Securely login to your account</p>
            <form id="login-form">
                <div class="form-group">
                    <label>Email Address</label>
                    <input type="email" id="login-email" required placeholder="john@example.com">
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="login-password" required placeholder="••••••••">
                </div>
                <button type="submit" class="btn-primary">Login</button>
            </form>
            <p style="margin-top: 1.5rem; text-align: center; color: var(--text-muted);">
                Don't have an account? <a href="#" id="link-register" style="color: var(--primary); text-decoration: none;">Register</a>
            </p>
        </div>
    `;

    document.getElementById('link-register').onclick = (e) => { e.preventDefault(); showRegister(); };

    document.getElementById('login-form').onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const user = await apiCall('/auth/login', 'POST', { email, password });
            currentUser = user;
            updateNavbar();
            if (user.role === 'admin') showAdminDashboard();
            else showMyComplaints();
        } catch (err) {}
    };
}

async function showComplaintSubmission() {
    app.innerHTML = `
        <div class="card">
            <h1>Submit a Complaint</h1>
            <p class="subtitle">Describe the issue and our AI will help clarify</p>
            <form id="complaint-form">
                <div class="form-group">
                    <label>What is your complaint?</label>
                    <textarea id="complaint-text" rows="4" required placeholder="Explain clearly..."></textarea>
                </div>
                <div id="ai-question-container" class="hidden">
                    <div class="ai-section">
                        <h4><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><path d="M12 8v4M12 16h.01"/></svg> AI Follow-up Question</h4>
                        <p id="ai-question-text" style="font-weight: 500; margin-bottom: 1rem;"></p>
                        <div class="form-group">
                            <label>Your Answer</label>
                            <textarea id="user-answer" rows="3" placeholder="Provide more details here..."></textarea>
                        </div>
                    </div>
                </div>
                <button type="button" id="get-ai-btn" class="btn-primary">Analyze & Continue</button>
                <button type="submit" id="final-submit-btn" class="btn-primary hidden">Submit Final Complaint</button>
            </form>
        </div>
    `;

    const complaintText = document.getElementById('complaint-text');
    const aiContainer = document.getElementById('ai-question-container');
    const aiQuestionText = document.getElementById('ai-question-text');
    const getAiBtn = document.getElementById('get-ai-btn');
    const finalSubmitBtn = document.getElementById('final-submit-btn');

    getAiBtn.onclick = async () => {
        if (!complaintText.value) return showToast('Please enter your complaint first', 'error');
        
        getAiBtn.disabled = true;
        getAiBtn.textContent = 'AI is thinking...';
        
        try {
            const { question } = await apiCall('/ai/question', 'POST', { complaint_text: complaintText.value });
            aiQuestionText.textContent = question;
            aiContainer.classList.remove('hidden');
            getAiBtn.classList.add('hidden');
            finalSubmitBtn.classList.remove('hidden');
        } catch (err) {
            getAiBtn.disabled = false;
            getAiBtn.textContent = 'Analyze & Continue';
        }
    };

    document.getElementById('complaint-form').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            complaint_text: complaintText.value,
            ai_question: aiQuestionText.textContent,
            user_answer: document.getElementById('user-answer').value
        };

        try {
            await apiCall('/complaints', 'POST', data);
            showToast('Complaint submitted successfully!');
            showMyComplaints();
        } catch (err) {}
    };
}

async function showMyComplaints() {
    setLoading(true);
    try {
        const complaints = await apiCall('/complaints/my');
        app.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                <h1>My Complaints</h1>
                <button id="btn-new-complaint" class="btn-primary" style="width: auto; padding: 0.5rem 1.5rem;">New Complaint</button>
            </div>
            <div class="complaint-list">
                ${complaints.length === 0 ? '<p style="text-align: center; color: var(--text-muted);">No complaints submitted yet.</p>' : ''}
                ${complaints.map(c => `
                    <div class="complaint-card">
                        <div class="complaint-header">
                            <span class="user-info">ID: #${c.id}</span>
                            <span class="date">${new Date(c.created_at).toLocaleDateString()}</span>
                        </div>
                        <div class="complaint-body">
                            <h4>Complaint</h4>
                            <p class="text-content">${c.complaint_text}</p>
                            <h4>AI Question</h4>
                            <p class="text-content">${c.ai_question}</p>
                            <h4>Your Answer</h4>
                            <p class="text-content">${c.user_answer || 'N/A'}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        document.getElementById('btn-new-complaint').onclick = showComplaintSubmission;
    } catch (err) {}
}

async function showAdminDashboard() {
    setLoading(true);
    try {
        const complaints = await apiCall('/admin/complaints');
        app.innerHTML = `
            <h1 style="margin-bottom: 2rem;">Admin Dashboard</h1>
            <div class="complaint-list">
                ${complaints.length === 0 ? '<p style="text-align: center; color: var(--text-muted);">No complaints found.</p>' : ''}
                ${complaints.map(c => `
                    <div class="complaint-card">
                        <div class="complaint-header">
                            <span class="user-info"><strong>${c.user_name}</strong> (${c.user_email})</span>
                            <span class="date">${new Date(c.created_at).toLocaleDateString()}</span>
                        </div>
                        <div class="complaint-body">
                            <h4>Complaint</h4>
                            <p class="text-content">${c.complaint_text}</p>
                            <h4>AI Question</h4>
                            <p class="text-content">${c.ai_question}</p>
                            <h4>User Answer</h4>
                            <p class="text-content">${c.user_answer || 'N/A'}</p>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (err) {}
}

// --- Initialization ---

async function checkSession() {
    try {
        const user = await apiCall('/auth/me');
        currentUser = user;
        updateNavbar();
        if (user.role === 'admin') showAdminDashboard();
        else showMyComplaints();
    } catch (err) {
        showLogin();
    }
}

document.getElementById('logout-btn').onclick = async () => {
    try {
        await apiCall('/auth/logout', 'POST');
        currentUser = null;
        updateNavbar();
        showLogin();
    } catch (err) {}
};

document.getElementById('nav-home').onclick = (e) => { e.preventDefault(); showComplaintSubmission(); };
document.getElementById('nav-my-complaints').onclick = (e) => { e.preventDefault(); showMyComplaints(); };
document.getElementById('nav-admin').onclick = (e) => { e.preventDefault(); showAdminDashboard(); };

checkSession();
