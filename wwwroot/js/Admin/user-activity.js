// wwwroot/js/Admin/user-activity.js

/**
 * User Activity Module - Handles user activity displays
 */
document.addEventListener('DOMContentLoaded', function () {
    // Initialize all user activity buttons
    initUserActivityButtons();

    // Auto-load activity if on the activity page
    autoLoadActivityIfNeeded();
});

/**
 * Initialize all activity view buttons
 */
function initUserActivityButtons() {
    document.body.addEventListener('click', function (e) {
        if (e.target && (e.target.classList.contains('view-user-activity-btn') || e.target.closest('.view-user-activity-btn'))) {
            e.preventDefault();
            const button = e.target.classList.contains('view-user-activity-btn') ? e.target : e.target.closest('.view-user-activity-btn');
            const userId = button.getAttribute('data-userid');
            const tabName = button.getAttribute('data-tab') || 'news';

            showUserActivityModal(userId, tabName);
        }
    });
}

/**
 * Auto-load activity data if we're on a user activity page
 */
function autoLoadActivityIfNeeded() {
    // Check if we're on the user activity page by looking for a specific element
    const activityContainer = document.getElementById('userActivityMainContainer');
    if (activityContainer) {
        const userId = activityContainer.getAttribute('data-userid');
        const activeTab = activityContainer.getAttribute('data-active-tab') || 'news';

        if (userId) {
            loadUserActivity(userId, activeTab, false);
        }
    }
}

/**
 * Show user activity modal with data
 * @param {number} userId - The user ID
 * @param {string} activeTab - Which tab to activate (news, comments, sessions)
 */
function showUserActivityModal(userId, activeTab = 'news') {
    // Create activity modal dynamically if it doesn't exist
    createActivityModalIfNeeded();

    const modal = document.getElementById('userActivityModal');
    if (!modal) return;

    // Get the content element
    const activityContent = document.getElementById('userActivityContent');
    if (!activityContent) return;

    // Show loading state
    activityContent.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Đang tải...</span>
            </div>
            <p class="mt-2">Đang tải hoạt động của người dùng...</p>
        </div>
    `;

    // Show the modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    // Load user activity data
    loadUserActivity(userId, activeTab);
}

/**
 * Create the user activity modal if it doesn't exist
 */
function createActivityModalIfNeeded() {
    if (!document.getElementById('userActivityModal')) {
        const modalHtml = `
        <div class="modal fade" id="userActivityModal" tabindex="-1" aria-labelledby="userActivityModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-xl modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="userActivityModalLabel">
                            <i class="fas fa-chart-line me-2"></i>Hoạt động người dùng
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body p-0" id="userActivityContent">
                        <!-- Content will be loaded dynamically -->
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Đóng</button>
                    </div>
                </div>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
}

/**
 * Load and display user activity data
 * @param {number} userId - The user ID
 * @param {string} activeTab - Which tab to activate
 * @param {boolean} isModal - Whether loading in a modal or directly on page
 */
function loadUserActivity(userId, activeTab = 'news', isModal = true) {
    // Show loading state if we're not in a modal (already shown in modal)
    if (!isModal) {
        const container = document.getElementById('userActivityMainContainer');
        if (container) {
            container.innerHTML = `
                <div class="text-center py-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Đang tải...</span>
                    </div>
                    <p class="mt-2">Đang tải hoạt động của người dùng...</p>
                </div>
            `;
        }
    }

    // Fetch user activity data from API
    fetch(`/AdminUser/GetUserActivity/${userId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Get the container element based on whether we're in a modal or not
                const contentElement = isModal
                    ? document.getElementById('userActivityContent')
                    : document.getElementById('userActivityMainContainer');

                if (contentElement) {
                    // Render the activity data with specified active tab
                    renderUserActivity(data, contentElement, activeTab);
                }
            } else {
                showActivityError(data.message || 'Không thể tải hoạt động của người dùng.', isModal);
            }
        })
        .catch(error => {
            console.error('Error loading user activity:', error);
            showActivityError('Có lỗi xảy ra khi tải hoạt động của người dùng.', isModal);
        });
}

/**
 * Show an error message when activity can't be loaded
 * @param {string} message - The error message
 * @param {boolean} isModal - Whether in modal context
 */
function showActivityError(message, isModal = true) {
    const contentElement = isModal
        ? document.getElementById('userActivityContent')
        : document.getElementById('userActivityMainContainer');

    if (contentElement) {
        contentElement.innerHTML = `
            <div class="alert alert-danger m-3">
                <i class="fas fa-exclamation-triangle me-2"></i>
                ${message}
            </div>
        `;
    }
}

/**
 * Render user activity data into the container
 * @param {Object} data - The activity data from API
 * @param {HTMLElement} container - The container to render into
 * @param {string} activeTab - Which tab to activate
 */
function renderUserActivity(data, container, activeTab = 'news') {
    if (!container) return;

    const user = data.user;
    const news = data.news || [];
    const comments = data.comments || [];
    const sessions = data.sessions || [];

    let html = `
    <div class="user-activity-container">
        <!-- User info header -->
        <div class="user-info p-3 border-bottom bg-light">
            <div class="d-flex align-items-center">
                <div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-3" style="width: 48px; height: 48px;">
                    <i class="fas fa-user fa-lg"></i>
                </div>
                <div>
                    <h5 class="mb-0">${escapeHtml(user.fullName)}</h5>
                    <p class="text-muted mb-0">
                        <i class="fas fa-envelope me-1"></i>${escapeHtml(user.email)}
                        <span class="badge bg-${user.role === 'Admin' ? 'danger' : user.role === 'Editor' ? 'primary' : 'info'} ms-2">${escapeHtml(user.role)}</span>
                        <span class="badge bg-${user.isDeleted ? 'danger' : 'success'} ms-1">${user.isDeleted ? 'Đã vô hiệu hóa' : 'Đang hoạt động'}</span>
                    </p>
                </div>
            </div>
        </div>
        
        <!-- Activity tabs -->
        <ul class="nav nav-tabs" id="activityTabs" role="tablist">
            <li class="nav-item" role="presentation">
                <button class="nav-link ${activeTab === 'news' ? 'active' : ''}" id="news-tab" data-bs-toggle="tab" 
                        data-bs-target="#news-content" type="button" role="tab" aria-controls="news-content" 
                        aria-selected="${activeTab === 'news' ? 'true' : 'false'}">
                    <i class="fas fa-newspaper me-1"></i>
                    Tin tức (${news.length})
                </button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link ${activeTab === 'comments' ? 'active' : ''}" id="comments-tab" data-bs-toggle="tab" 
                        data-bs-target="#comments-content" type="button" role="tab" aria-controls="comments-content" 
                        aria-selected="${activeTab === 'comments' ? 'true' : 'false'}">
                    <i class="fas fa-comments me-1"></i>
                    Bình luận (${comments.length})
                </button>
            </li>
            <li class="nav-item" role="presentation">
                <button class="nav-link ${activeTab === 'sessions' ? 'active' : ''}" id="sessions-tab" data-bs-toggle="tab" 
                        data-bs-target="#sessions-content" type="button" role="tab" aria-controls="sessions-content" 
                        aria-selected="${activeTab === 'sessions' ? 'true' : 'false'}">
                    <i class="fas fa-sign-in-alt me-1"></i>
                    Phiên đăng nhập (${sessions.length})
                </button>
            </li>
        </ul>
        
        <!-- Tab content -->
        <div class="tab-content" id="activityTabsContent">
            <div class="tab-pane fade ${activeTab === 'news' ? 'show active' : ''}" id="news-content" role="tabpanel" aria-labelledby="news-tab">
                ${renderNewsTab(news)}
            </div>
            <div class="tab-pane fade ${activeTab === 'comments' ? 'show active' : ''}" id="comments-content" role="tabpanel" aria-labelledby="comments-tab">
                ${renderCommentsTab(comments)}
            </div>
            <div class="tab-pane fade ${activeTab === 'sessions' ? 'show active' : ''}" id="sessions-content" role="tabpanel" aria-labelledby="sessions-tab">
                ${renderSessionsTab(sessions)}
            </div>
        </div>
    </div>
    `;

    // Set the HTML to the container
    container.innerHTML = html;

    // Initialize tabs
    const tabElements = container.querySelectorAll('button[data-bs-toggle="tab"]');
    tabElements.forEach(tabEl => {
        tabEl.addEventListener('click', function (event) {
            event.preventDefault();
            new bootstrap.Tab(tabEl).show();
        });
    });
}

/**
 * Render the news tab content
 * @param {Array} news - Array of news items
 * @returns {string} HTML for news tab
 */
function renderNewsTab(news) {
    if (!news || news.length === 0) {
        return `
            <div class="text-center py-5">
                <i class="fas fa-newspaper text-muted fa-3x mb-3"></i>
                <p class="text-muted">Người dùng này chưa đăng tin tức nào</p>
            </div>
        `;
    }

    let html = `
    <div class="table-responsive">
        <table class="table table-hover table-striped align-middle mb-0">
            <thead class="table-light">
                <tr>
                    <th scope="col">ID</th>
                    <th scope="col">Tiêu đề</th>
                    <th scope="col">Danh mục</th>
                    <th scope="col" class="text-center">Lượt đọc</th>
                    <th scope="col" class="text-center">Trạng thái</th>
                    <th scope="col">Ngày tạo</th>
                    <th scope="col" class="text-end">Thao tác</th>
                </tr>
            </thead>
            <tbody>
    `;

    news.forEach(item => {
        const createdAt = new Date(item.createdAt);
        const formattedDate = formatDate(createdAt);

        html += `
        <tr>
            <td>${item.newsId}</td>
            <td>
                <div class="text-truncate" style="max-width: 300px;" title="${escapeHtml(item.title)}">
                    ${escapeHtml(item.title)}
                </div>
            </td>
            <td>${escapeHtml(item.categoryName || 'Chưa phân loại')}</td>
            <td class="text-center">
                <span class="badge bg-secondary rounded-pill">${item.readCount}</span>
            </td>
            <td class="text-center">
                <span class="badge bg-${item.isApproved ? 'success' : 'warning text-dark'}">
                    <i class="fas fa-${item.isApproved ? 'check-circle' : 'clock'} me-1"></i>
                    ${item.isApproved ? 'Đã duyệt' : 'Chưa duyệt'}
                </span>
            </td>
            <td>${formattedDate}</td>
            <td class="text-end">
                <a href="/News/Read/${item.newsId}" target="_blank" class="btn btn-sm btn-outline-primary" title="Xem tin">
                    <i class="fas fa-eye"></i>
                </a>
            </td>
        </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    </div>
    `;

    return html;
}

/**
 * Render the comments tab content
 * @param {Array} comments - Array of comment items
 * @returns {string} HTML for comments tab
 */
function renderCommentsTab(comments) {
    if (!comments || comments.length === 0) {
        return `
            <div class="text-center py-5">
                <i class="fas fa-comments text-muted fa-3x mb-3"></i>
                <p class="text-muted">Người dùng này chưa có bình luận nào</p>
            </div>
        `;
    }

    let html = `
    <div class="table-responsive">
        <table class="table table-hover table-striped align-middle mb-0">
            <thead class="table-light">
                <tr>
                    <th scope="col">ID</th>
                    <th scope="col">Nội dung</th>
                    <th scope="col">Tin tức</th>
                    <th scope="col" class="text-center">Trạng thái</th>
                    <th scope="col">Ngày tạo</th>
                    <th scope="col" class="text-end">Thao tác</th>
                </tr>
            </thead>
            <tbody>
    `;

    comments.forEach(comment => {
        const createdAt = new Date(comment.createdAt);
        const formattedDate = formatDate(createdAt);

        let status = 'Bình thường';
        let statusClass = 'success';
        let statusIcon = 'check-circle';

        if (comment.isHidden) {
            status = 'Đã ẩn';
            statusClass = 'warning text-dark';
            statusIcon = 'eye-slash';
        }

        if (comment.isDeleted) {
            status = 'Đã xóa';
            statusClass = 'danger';
            statusIcon = 'trash-alt';
        }

        html += `
        <tr>
            <td>${comment.commentId}</td>
            <td>
                <div class="text-truncate" style="max-width: 300px;" title="${escapeHtml(comment.content)}">
                    ${escapeHtml(comment.content)}
                </div>
            </td>
            <td>
                <div class="text-truncate" style="max-width: 200px;" title="${escapeHtml(comment.newsTitle || '')}">
                    ${escapeHtml(comment.newsTitle || 'Không xác định')}
                </div>
            </td>
            <td class="text-center">
                <span class="badge bg-${statusClass}">
                    <i class="fas fa-${statusIcon} me-1"></i>
                    ${status}
                </span>
            </td>
            <td>${formattedDate}</td>
            <td class="text-end">
                <a href="/News/Read/${comment.newsId}#comment-${comment.commentId}" target="_blank" class="btn btn-sm btn-outline-primary" title="Xem bình luận">
                    <i class="fas fa-eye"></i>
                </a>
            </td>
        </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    </div>
    `;

    return html;
}

/**
 * Render the sessions tab content
 * @param {Array} sessions - Array of session items
 * @returns {string} HTML for sessions tab
 */
function renderSessionsTab(sessions) {
    if (!sessions || sessions.length === 0) {
        return `
            <div class="text-center py-5">
                <i class="fas fa-sign-in-alt text-muted fa-3x mb-3"></i>
                <p class="text-muted">Người dùng này không có phiên đăng nhập nào</p>
            </div>
        `;
    }

    let html = `
    <div class="table-responsive">
        <table class="table table-hover table-striped align-middle mb-0">
            <thead class="table-light">
                <tr>
                    <th scope="col">ID</th>
                    <th scope="col">Thiết bị</th>
                    <th scope="col">Địa chỉ IP</th>
                    <th scope="col" class="text-center">Trạng thái</th>
                    <th scope="col">Hoạt động cuối</th>
                    <th scope="col">Đăng nhập lúc</th>
                    <th scope="col">Hết hạn</th>
                </tr>
            </thead>
            <tbody>
    `;

    sessions.forEach(session => {
        const lastActivity = new Date(session.lastActivity);
        const createdAt = new Date(session.createdAt);
        const expiresAt = new Date(session.expiresAt);

        const formattedLastActivity = formatDate(lastActivity, true);
        const formattedCreatedAt = formatDate(createdAt, true);
        const formattedExpiresAt = formatDate(expiresAt, true);

        // Determine device icon based on User-Agent info
        let deviceIcon = 'desktop';
        if (session.deviceInfo && session.deviceInfo.toLowerCase().includes('mobile')) {
            deviceIcon = 'mobile-alt';
        } else if (session.deviceInfo && session.deviceInfo.toLowerCase().includes('tablet')) {
            deviceIcon = 'tablet-alt';
        }

        html += `
        <tr class="${!session.isActive ? 'table-secondary' : ''}">
            <td>${session.sessionId}</td>
            <td>
                <div title="${escapeHtml(session.deviceInfo || 'Không xác định')}">
                    <i class="fas fa-${deviceIcon} me-1"></i>
                    ${escapeHtml((session.deviceInfo || 'Không xác định').substring(0, 25))}${session.deviceInfo && session.deviceInfo.length > 25 ? '...' : ''}
                </div>
            </td>
            <td>
                <i class="fas fa-network-wired me-1"></i>
                ${escapeHtml(session.ipAddress || 'Không xác định')}
            </td>
            <td class="text-center">
                <span class="badge bg-${session.isActive ? 'success' : 'secondary'}">
                    <i class="fas fa-${session.isActive ? 'check-circle' : 'times-circle'} me-1"></i>
                    ${session.isActive ? 'Đang hoạt động' : 'Đã kết thúc'}
                </span>
            </td>
            <td>${formattedLastActivity}</td>
            <td>${formattedCreatedAt}</td>
            <td>
                <span class="${new Date() > expiresAt ? 'text-danger' : ''}">
                    ${formattedExpiresAt}
                </span>
            </td>
        </tr>
        `;
    });

    html += `
            </tbody>
        </table>
    </div>
    `;

    return html;
}

/**
 * Format a date for display
 * @param {Date} date - The date to format
 * @param {boolean} includeTime - Whether to include time
 * @returns {string} Formatted date string
 */
function formatDate(date, includeTime = false) {
    if (!date || isNaN(date.getTime())) {
        return 'Không xác định';
    }

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    if (includeTime) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    }

    return `${day}/${month}/${year}`;
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} unsafe - The string to escape
 * @returns {string} Escaped string
 */
function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) {
        return '';
    }

    return unsafe
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Update the password strength meter
 * @param {HTMLInputElement} passwordField - The password input element
 * @param {string} context - The context ('create' or 'reset')
 */
function updatePasswordStrength(passwordField, context = 'create') {
    const strength = calculatePasswordStrength(passwordField.value);

    const idPrefix = context === 'create' ? 'create-' : '';
    const strengthBar = document.getElementById(`${idPrefix}password-strength-bar`);
    const strengthText = document.getElementById(`${idPrefix}password-strength-text`);

    if (strengthBar && strengthText) {
        // Update progress bar width
        strengthBar.style.width = `${strength.percentage}%`;

        // Update progress bar color
        strengthBar.className = `progress-bar ${strength.colorClass}`;

        // Update strength text
        strengthText.innerHTML = `<i class="fas fa-${strength.icon} me-1"></i> Độ mạnh: ${strength.text}`;
    }
}

/**
 * For external use - show notification function if not defined elsewhere
 */
if (typeof showNotification !== 'function') {
    function showNotification(type, message) {
        // Create toast container if it doesn't exist
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            toastContainer.style.zIndex = '1080';
            document.body.appendChild(toastContainer);
        }

        // Create notification element
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type === 'success' ? 'success' : type === 'error' ? 'danger' : type === 'warning' ? 'warning' : 'primary'} border-0`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');

        // Create toast content
        const icon = type === 'success' ? 'check-circle' :
            type === 'error' ? 'exclamation-circle' :
                type === 'warning' ? 'exclamation-triangle' : 'info-circle';

        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas fa-${icon} me-2"></i>
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;

        // Add to container
        toastContainer.appendChild(toast);

        // Initialize Bootstrap toast
        const bsToast = new bootstrap.Toast(toast, {
            autohide: true,
            delay: 5000
        });

        // Show toast
        bsToast.show();

        // Remove from DOM when hidden
        toast.addEventListener('hidden.bs.toast', function () {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
    }
}
