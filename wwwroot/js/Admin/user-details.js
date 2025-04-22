// wwwroot/js/Admin/user-details.js

/**
 * User Details Module - Handles user detail page functionality
 */
document.addEventListener('DOMContentLoaded', function () {
    // Initialize password toggle for reset form
    initPasswordVisibilityToggle();

    // Initialize password strength meter
    initPasswordStrengthMeter();

    // Initialize Bootstrap tooltips
    initTooltips();

    // Initialize form validation
    initFormValidation();

    // Ensure the edit user modal is connected
    initEditUserModal();
});

/**
 * Initialize password visibility toggle
 */
function initPasswordVisibilityToggle() {
    const togglePasswordBtn = document.getElementById('togglePassword');
    const passwordField = document.getElementById('newPassword');

    if (togglePasswordBtn && passwordField) {
        togglePasswordBtn.addEventListener('click', function () {
            const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordField.setAttribute('type', type);
            this.querySelector('i').classList.toggle('fa-eye');
            this.querySelector('i').classList.toggle('fa-eye-slash');
        });
    }
}

/**
 * Initialize password strength meter
 */
function initPasswordStrengthMeter() {
    const passwordField = document.getElementById('newPassword');
    const strengthBar = document.getElementById('password-strength-bar');
    const strengthText = document.getElementById('password-strength-text');

    if (passwordField && strengthBar && strengthText) {
        passwordField.addEventListener('input', function () {
            const strength = calculatePasswordStrength(this.value);

            // Update progress bar
            strengthBar.style.width = `${strength.percentage}%`;

            // Update progress bar color based on strength
            strengthBar.className = `progress-bar ${strength.colorClass}`;

            // Update text description
            strengthText.innerHTML = `<i class="fas fa-${strength.icon} me-1"></i> Độ mạnh: ${strength.text}`;
        });
    }
}

/**
 * Calculate password strength
 * @param {string} password - The password to evaluate
 * @returns {Object} Strength details including percentage, text description, color class, and icon
 */
function calculatePasswordStrength(password) {
    if (!password) {
        return { percentage: 0, text: 'Chưa nhập mật khẩu', colorClass: 'bg-danger', icon: 'info-circle' };
    }

    let strength = 0;

    // Length check
    if (password.length >= 6) strength += 20;
    if (password.length >= 8) strength += 10;
    if (password.length >= 10) strength += 10;

    // Character variety checks
    if (/[A-Z]/.test(password)) strength += 15; // Uppercase
    if (/[a-z]/.test(password)) strength += 10; // Lowercase
    if (/[0-9]/.test(password)) strength += 15; // Numbers
    if (/[^A-Za-z0-9]/.test(password)) strength += 20; // Special chars

    // Determine text and color based on strength
    let text, colorClass, icon;

    if (strength < 30) {
        text = 'Rất yếu';
        colorClass = 'bg-danger';
        icon = 'exclamation-triangle';
    } else if (strength < 50) {
        text = 'Yếu';
        colorClass = 'bg-warning';
        icon = 'exclamation-circle';
    } else if (strength < 70) {
        text = 'Trung bình';
        colorClass = 'bg-info';
        icon = 'info-circle';
    } else if (strength < 90) {
        text = 'Mạnh';
        colorClass = 'bg-primary';
        icon = 'check-circle';
    } else {
        text = 'Rất mạnh';
        colorClass = 'bg-success';
        icon = 'shield-alt';
    }

    return { percentage: strength, text, colorClass, icon };
}

/**
 * Initialize Bootstrap tooltips
 */
function initTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.forEach(function (tooltipTriggerEl) {
        new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

/**
 * Initialize form validation
 */
function initFormValidation() {
    const forms = document.querySelectorAll('.needs-validation');
    Array.prototype.slice.call(forms).forEach(function (form) {
        form.addEventListener('submit', function (event) {
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();
            }
            form.classList.add('was-validated');
        }, false);
    });
}

/**
 * Initialize edit user modal if edit button exists on page
 */
function initEditUserModal() {
    const editUserBtn = document.querySelector('.edit-user-btn');
    if (editUserBtn) {
        editUserBtn.addEventListener('click', function () {
            const userId = this.getAttribute('data-userid');
            if (userId) {
                // This will invoke the user-management.js function
                if (typeof showUserEditModal === 'function') {
                    showUserEditModal(userId);
                } else {
                    console.error('showUserEditModal function not found. Make sure user-management.js is loaded.');
                }
            }
        });
    }
}

/**
 * Change user role
 * @param {number} userId - The ID of the user
 */
function changeUserRole(userId) {
    const roleSelect = document.getElementById('roleSelect');
    if (!roleSelect) {
        showToast('Không tìm thấy phần tử chọn vai trò', 'error');
        return;
    }

    const newRole = roleSelect.value;
    if (!newRole) {
        showToast('Vui lòng chọn một vai trò', 'warning');
        return;
    }

    // Get the CSRF token
    const token = document.querySelector('input[name="__RequestVerificationToken"]')?.value;
    if (!token) {
        showToast('Không tìm thấy token bảo mật', 'error');
        return;
    }

    // Show loading state
    showToast('Đang cập nhật vai trò...', 'info');

    // Send request to server
    fetch('/AdminUser/ChangeRole', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'RequestVerificationToken': token
        },
        body: JSON.stringify({ userId, newRole })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(result => {
            if (result.success) {
                showToast(result.message, 'success');

                // Update role badge on the page
                updateRoleBadge(newRole);
            } else {
                showToast(result.message || 'Có lỗi xảy ra khi cập nhật vai trò', 'error');
            }
        })
        .catch(error => {
            console.error('Error changing role:', error);
            showToast('Có lỗi xảy ra khi thực hiện thao tác', 'error');
        });
}

/**
 * Update the role badge displayed on page
 * @param {string} newRole - The new role value
 */
function updateRoleBadge(newRole) {
    // Find all role badges
    const roleBadges = document.querySelectorAll('.badge:not(.rounded-pill)');

    roleBadges.forEach(badge => {
        // Check if this is the role badge (based on text content)
        if (badge.textContent.trim() === 'Admin' ||
            badge.textContent.trim() === 'User' ||
            badge.textContent.trim() === 'Editor') {

            // Update badge text
            badge.textContent = newRole;

            // Update badge class
            badge.className = badge.className.replace(/bg-(danger|info|primary)/, '');

            if (newRole === 'Admin') {
                badge.classList.add('bg-danger');
            } else if (newRole === 'Editor') {
                badge.classList.add('bg-primary');
            } else {
                badge.classList.add('bg-info');
            }
        }
    });
}

/**
 * Toggle email verification status
 * @param {number} userId - The ID of the user
 * @param {boolean} verified - The new verification status
 */
function toggleEmailVerification(userId, verified) {
    if (!confirm('Bạn có chắc chắn muốn ' + (verified ? 'xác minh' : 'hủy xác minh') + ' email của người dùng này?')) {
        return;
    }

    const token = document.querySelector('input[name="__RequestVerificationToken"]')?.value;
    if (!token) {
        showToast('Không tìm thấy token bảo mật', 'error');
        return;
    }

    // Show loading state
    showToast('Đang cập nhật trạng thái xác minh email...', 'info');

    fetch('/AdminUser/ToggleEmailVerification', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'RequestVerificationToken': token
        },
        body: JSON.stringify({ userId, isVerified: verified })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(result => {
            if (result.success) {
                showToast(result.message, 'success');

                // Reload the page to reflect the changes
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                showToast(result.message || 'Có lỗi xảy ra khi thay đổi trạng thái xác minh email', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('Có lỗi xảy ra khi thực hiện thao tác', 'error');
        });
}

/**
 * Terminate all user sessions
 * @param {number} userId - The ID of the user
 */
function terminateAllSessions(userId) {
    if (!confirm('Bạn có chắc chắn muốn đăng xuất tất cả các phiên đăng nhập của người dùng này?')) {
        return;
    }

    const token = document.querySelector('input[name="__RequestVerificationToken"]')?.value;
    if (!token) {
        showToast('Không tìm thấy token bảo mật', 'error');
        return;
    }

    // Show loading state
    showToast('Đang kết thúc tất cả các phiên đăng nhập...', 'info');

    fetch('/AdminUser/TerminateAllSessions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'RequestVerificationToken': token
        },
        body: JSON.stringify({ userId })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(result => {
            if (result.success) {
                showToast(result.message, 'success');

                // Reload the page to reflect the changes
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                showToast(result.message || 'Có lỗi xảy ra khi kết thúc phiên đăng nhập', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('Có lỗi xảy ra khi thực hiện thao tác', 'error');
        });
}

/**
 * Unlink a social login account
 * @param {number} socialLoginId - The ID of the social login
 * @param {string} provider - The provider name
 */
function unlinkSocialAccount(socialLoginId, provider) {
    if (!confirm(`Bạn có chắc chắn muốn hủy liên kết tài khoản ${provider} này?`)) {
        return;
    }

    const token = document.querySelector('input[name="__RequestVerificationToken"]')?.value;
    if (!token) {
        showToast('Không tìm thấy token bảo mật', 'error');
        return;
    }

    // Show loading state
    showToast(`Đang hủy liên kết tài khoản ${provider}...`, 'info');

    fetch('/AdminUser/UnlinkSocialLogin', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'RequestVerificationToken': token
        },
        body: JSON.stringify({ socialLoginId })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(result => {
            if (result.success) {
                showToast(result.message, 'success');

                // Reload the page to reflect the changes
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                showToast(result.message || 'Có lỗi xảy ra khi hủy liên kết tài khoản', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('Có lỗi xảy ra khi thực hiện thao tác', 'error');
        });
}

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of toast (success, warning, error, info)
 */
function showToast(message, type = 'success') {
    // If we have access to the showNotification function from user-management.js, use it
    if (typeof showNotification === 'function') {
        showNotification(type, message);
        return;
    }

    // Otherwise implement toast functionality here
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
        toastContainer.style.zIndex = '1080';
        document.body.appendChild(toastContainer);
    }

    // Map type to Bootstrap classes and icons
    const typeMapping = {
        success: { bgClass: 'bg-success', icon: 'check-circle' },
        warning: { bgClass: 'bg-warning text-dark', icon: 'exclamation-triangle' },
        error: { bgClass: 'bg-danger', icon: 'exclamation-circle' },
        info: { bgClass: 'bg-info', icon: 'info-circle' }
    };

    const mappedType = typeMapping[type] || typeMapping.info;

    // Create toast element
    const toastElement = document.createElement('div');
    toastElement.className = `toast align-items-center text-white ${mappedType.bgClass} border-0`;
    toastElement.setAttribute('role', 'alert');
    toastElement.setAttribute('aria-live', 'assertive');
    toastElement.setAttribute('aria-atomic', 'true');

    toastElement.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="fas fa-${mappedType.icon} me-2"></i> ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;

    toastContainer.appendChild(toastElement);

    // Initialize Bootstrap toast
    const toast = new bootstrap.Toast(toastElement, {
        autohide: true,
        delay: 5000
    });

    toast.show();

    // Remove toast after it's hidden
    toastElement.addEventListener('hidden.bs.toast', function () {
        if (toastElement.parentNode) {
            toastElement.parentNode.removeChild(toastElement);
        }
    });
}
