// wwwroot/js/Admin/user-management.js

/**
 * User Management Module - Handles user CRUD operations in admin panel
 */
document.addEventListener('DOMContentLoaded', function () {
    // Initialize all components
    initUserCreationModal();
    initUserEditButtons();
    setupPasswordValidation();
    initUserActivityButtons();
    initFormValidation();
});

/**
 * Initialize user creation modal functionality
 */
function initUserCreationModal() {
    // Show modal when "Create User" button is clicked
    const createUserBtn = document.getElementById('createUserBtn');
    if (createUserBtn) {
        createUserBtn.addEventListener('click', function () {
            const modal = new bootstrap.Modal(document.getElementById('createUserModal'));
            modal.show();
        });
    }

    // Set up form submission handler
    const userCreateForm = document.getElementById('userCreateForm');
    if (userCreateForm) {
        userCreateForm.addEventListener('submit', handleUserCreation);
    }

    // Toggle password visibility in create user modal
    const toggleCreatePasswordBtn = document.getElementById('toggleCreatePassword');
    if (toggleCreatePasswordBtn) {
        const pwField = document.getElementById('userPassword');
        toggleCreatePasswordBtn.addEventListener('click', function () {
            togglePasswordVisibility(pwField, toggleCreatePasswordBtn);
        });
    }

    // Load available roles for dropdown
    loadAvailableRoles();
}

/**
 * Initialize user edit buttons
 */
function initUserEditButtons() {
    // Use event delegation for dynamic elements
    document.body.addEventListener('click', function (e) {
        if (e.target && (e.target.classList.contains('edit-user-btn') || e.target.closest('.edit-user-btn'))) {
            e.preventDefault();
            const button = e.target.classList.contains('edit-user-btn') ? e.target : e.target.closest('.edit-user-btn');
            const userId = button.getAttribute('data-userid');
            showUserEditModal(userId);
        }
    });

    // Add submit handler for the edit form
    const editForm = document.getElementById('userEditForm');
    if (editForm) {
        editForm.addEventListener('submit', handleUserUpdate);
    }
}

/**
 * Initialize user activity buttons
 */
function initUserActivityButtons() {
    document.body.addEventListener('click', function (e) {
        if (e.target && (e.target.classList.contains('view-user-activity-btn') || e.target.closest('.view-user-activity-btn'))) {
            e.preventDefault();
            const button = e.target.classList.contains('view-user-activity-btn') ? e.target : e.target.closest('.view-user-activity-btn');
            const userId = button.getAttribute('data-userid');
            const activeTab = button.getAttribute('data-tab') || 'news';
            showUserActivityModal(userId, activeTab);
        }
    });
}

/**
 * Initialize form validation
 */
function initFormValidation() {
    // Bootstrap form validation
    const forms = document.querySelectorAll('.needs-validation');
    Array.from(forms).forEach(function (form) {
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
 * Setup password validation and strength meter
 */
function setupPasswordValidation() {
    // Password validation for new user
    const passwordField = document.getElementById('userPassword');
    const confirmField = document.getElementById('userConfirmPassword');

    if (passwordField && confirmField) {
        // Check password match when either field changes
        passwordField.addEventListener('input', function () {
            validatePasswordMatch(passwordField, confirmField);
            updatePasswordStrength(passwordField, 'create');
        });

        confirmField.addEventListener('input', function () {
            validatePasswordMatch(passwordField, confirmField);
        });
    }

    // Password strength meter
    const resetPasswordField = document.getElementById('newPassword');
    const strengthBar = document.getElementById('password-strength-bar');
    const strengthText = document.getElementById('password-strength-text');

    if (resetPasswordField && strengthBar && strengthText) {
        resetPasswordField.addEventListener('input', function () {
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
 * Validate that password and confirm password match
 */
function validatePasswordMatch(passwordField, confirmField) {
    if (confirmField.value && passwordField.value !== confirmField.value) {
        confirmField.setCustomValidity('Mật khẩu xác nhận không khớp');
    } else {
        confirmField.setCustomValidity('');
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
 * Toggle password visibility
 */
function togglePasswordVisibility(passwordField, toggleButton) {
    if (!passwordField || !toggleButton) return;

    const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordField.setAttribute('type', type);

    const icon = toggleButton.querySelector('i');
    if (icon) {
        icon.classList.toggle('fa-eye');
        icon.classList.toggle('fa-eye-slash');
    }
}

/**
 * Load available roles for user dropdown
 */
function loadAvailableRoles() {
    // Get available roles from the server
    fetch('/AdminUser/GetAvailableRoles')
        .then(response => response.json())
        .then(roles => {
            populateRoleDropdown('userRole', roles);
            populateRoleDropdown('editUserRole', roles);
        })
        .catch(error => {
            console.error('Error loading roles:', error);
        });
}

/**
 * Populate a role dropdown with options
 * @param {string} selectId - The ID of the select element
 * @param {Array} roles - Array of role names
 */
function populateRoleDropdown(selectId, roles) {
    const roleSelect = document.getElementById(selectId);
    if (!roleSelect) return;

    // Clear existing options
    roleSelect.innerHTML = '';

    // Add "Select role" option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '-- Chọn vai trò --';
    roleSelect.appendChild(defaultOption);

    // Add options for each role
    roles.forEach(role => {
        const option = document.createElement('option');
        option.value = role;
        option.textContent = role;
        if (role === 'User') {
            option.selected = true;
        }
        roleSelect.appendChild(option);
    });
}

/**
 * Handle user creation form submission
 */
function handleUserCreation(e) {
    e.preventDefault();

    // Validate form
    if (!this.checkValidity()) {
        this.classList.add('was-validated');
        return;
    }

    // Clear previous error messages
    clearFormErrors();

    // Collect form data
    const formData = {
        fullName: document.getElementById('userName').value.trim(),
        email: document.getElementById('userEmail').value.trim(),
        password: document.getElementById('userPassword').value,
        confirmPassword: document.getElementById('userConfirmPassword').value,
        role: document.getElementById('userRole').value,
        isEmailVerified: document.getElementById('userEmailVerified').checked,
        phoneNumber: document.getElementById('userPhone')?.value.trim() || null,
        address: document.getElementById('userAddress')?.value.trim() || null,
        dateOfBirth: document.getElementById('userDateOfBirth')?.value || null,
        gender: document.getElementById('userGender')?.value || null
    };

    // Check if password matches confirm password
    if (formData.password !== formData.confirmPassword) {
        showNotification('error', 'Mật khẩu xác nhận không khớp.');
        return;
    }

    // Get CSRF token
    const token = document.querySelector('input[name="__RequestVerificationToken"]').value;

    // Send data to the server
    fetch('/AdminUser/CreateUser', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'RequestVerificationToken': token
        },
        body: JSON.stringify(formData)
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Show success message
                showNotification('success', data.message);

                // Close the modal
                bootstrap.Modal.getInstance(document.getElementById('createUserModal')).hide();

                // Refresh the page to show the new user or add to table
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                // Show error messages
                if (data.errors) {
                    displayFormErrors(data.errors);
                } else {
                    showNotification('error', data.message || 'Có lỗi xảy ra khi tạo người dùng.');
                }
            }
        })
        .catch(error => {
            console.error('Error creating user:', error);
            showNotification('error', 'Có lỗi xảy ra khi tạo người dùng.');
        });
}

/**
 * Show the user edit modal
 * @param {number} userId - The ID of the user to edit
 */
function showUserEditModal(userId) {
    // Show loading state
    showNotification('info', 'Đang tải thông tin người dùng...');

    // Fetch user details
    fetch(`/AdminUser/GetUserDetails/${userId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(userData => {
            // Populate the form with user data
            populateEditForm(userData);

            // Create modal if it doesn't exist (for cases when loaded from Details page)
            createEditModalIfNeeded();

            // Show the modal
            const modal = new bootstrap.Modal(document.getElementById('editUserModal'));
            modal.show();
        })
        .catch(error => {
            console.error('Error fetching user details:', error);
            showNotification('error', 'Không thể tải thông tin người dùng. Vui lòng thử lại.');
        });
}

/**
 * Create the edit modal if it doesn't exist (for use on pages where it's not in the HTML)
 */
function createEditModalIfNeeded() {
    if (!document.getElementById('editUserModal')) {
        const modalHtml = `
        <div class="modal fade" id="editUserModal" tabindex="-1" aria-labelledby="editUserModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="editUserModalLabel">
                            <i class="fas fa-user-edit me-2"></i>Chỉnh sửa người dùng
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <form id="userEditForm" class="needs-validation" novalidate>
                        <input type="hidden" id="editUserId" name="editUserId">
                        <div class="modal-body">
                            <ul class="nav nav-tabs mb-3" id="editUserTabs" role="tablist">
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link active" id="edit-account-tab" data-bs-toggle="tab" 
                                            data-bs-target="#edit-account-info" type="button" role="tab" 
                                            aria-controls="edit-account-info" aria-selected="true">
                                        Thông tin tài khoản
                                    </button>
                                </li>
                                <li class="nav-item" role="presentation">
                                    <button class="nav-link" id="edit-profile-tab" data-bs-toggle="tab" 
                                            data-bs-target="#edit-profile-info" type="button" role="tab" 
                                            aria-controls="edit-profile-info" aria-selected="false">
                                        Thông tin cá nhân
                                    </button>
                                </li>
                            </ul>
                            
                            <div class="tab-content" id="editUserTabsContent">
                                <!-- Account Information Tab -->
                                <div class="tab-pane fade show active" id="edit-account-info" role="tabpanel" aria-labelledby="edit-account-tab">
                                    <div class="mb-3">
                                        <label for="editUserName" class="form-label">Họ tên <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" id="editUserName" required>
                                        <div class="invalid-feedback">Vui lòng nhập họ tên người dùng</div>
                                    </div>
                                    <div class="mb-3">
                                        <label for="editUserEmail" class="form-label">Email <span class="text-danger">*</span></label>
                                        <input type="email" class="form-control" id="editUserEmail" required>
                                        <div class="invalid-feedback">Vui lòng nhập địa chỉ email hợp lệ</div>
                                    </div>
                                    <div class="mb-3">
                                        <label for="editUserRole" class="form-label">Vai trò <span class="text-danger">*</span></label>
                                        <select class="form-select" id="editUserRole" required>
                                            <option value="">-- Chọn vai trò --</option>
                                        </select>
                                        <div class="invalid-feedback">Vui lòng chọn vai trò người dùng</div>
                                    </div>
                                    <div class="mb-3 form-check">
                                        <input type="checkbox" class="form-check-input" id="editUserEmailVerified">
                                        <label class="form-check-label" for="editUserEmailVerified">
                                            Đã xác minh email
                                        </label>
                                    </div>
                                    <div class="mb-3 form-check">
                                        <input type="checkbox" class="form-check-input" id="editUserDeleted">
                                        <label class="form-check-label" for="editUserDeleted">
                                            Vô hiệu hóa tài khoản
                                        </label>
                                    </div>
                                </div>
                                
                                <!-- Personal Information Tab -->
                                <div class="tab-pane fade" id="edit-profile-info" role="tabpanel" aria-labelledby="edit-profile-tab">
                                    <div class="mb-3">
                                        <label for="editUserPhone" class="form-label">Số điện thoại</label>
                                        <input type="tel" class="form-control" id="editUserPhone" pattern="[0-9]{10,11}">
                                        <div class="form-text">Số điện thoại 10-11 số, không bao gồm ký tự đặc biệt</div>
                                    </div>
                                    <div class="mb-3">
                                        <label for="editUserDateOfBirth" class="form-label">Ngày sinh</label>
                                        <input type="date" class="form-control" id="editUserDateOfBirth">
                                    </div>
                                    <div class="mb-3">
                                        <label for="editUserGender" class="form-label">Giới tính</label>
                                        <select class="form-select" id="editUserGender">
                                            <option value="">-- Chọn giới tính --</option>
                                            <option value="Nam">Nam</option>
                                            <option value="Nữ">Nữ</option>
                                            <option value="Khác">Khác</option>
                                        </select>
                                    </div>
                                    <div class="mb-3">
                                        <label for="editUserAddress" class="form-label">Địa chỉ</label>
                                        <textarea class="form-control" id="editUserAddress" rows="2"></textarea>
                                    </div>
                                    <div class="mb-3">
                                        <label for="editUserBio" class="form-label">Tiểu sử</label>
                                        <textarea class="form-control" id="editUserBio" rows="3"></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                                <i class="fas fa-times me-1"></i> Hủy
                            </button>
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save me-1"></i> Lưu thay đổi
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Reattach event handler
        const editForm = document.getElementById('userEditForm');
        if (editForm) {
            editForm.addEventListener('submit', handleUserUpdate);
        }
    }
}

/**
 * Populate the edit form with user data
 * @param {Object} userData - User data from API
 */
function populateEditForm(userData) {
    if (!userData) {
        showNotification('error', 'Không nhận được dữ liệu người dùng');
        return;
    }

    // Get form elements
    const elements = {
        id: document.getElementById('editUserId'),
        name: document.getElementById('editUserName'),
        email: document.getElementById('editUserEmail'),
        role: document.getElementById('editUserRole'),
        emailVerified: document.getElementById('editUserEmailVerified'),
        deleted: document.getElementById('editUserDeleted'),
        phone: document.getElementById('editUserPhone'),
        address: document.getElementById('editUserAddress'),
        dateOfBirth: document.getElementById('editUserDateOfBirth'),
        gender: document.getElementById('editUserGender'),
        bio: document.getElementById('editUserBio')
    };

    // Set values safely (checking for null/undefined)
    if (elements.id) elements.id.value = userData.userId;
    if (elements.name) elements.name.value = userData.fullName || '';
    if (elements.email) elements.email.value = userData.email || '';
    if (elements.role) elements.role.value = userData.role || 'User';
    if (elements.emailVerified) elements.emailVerified.checked = userData.isEmailVerified || false;
    if (elements.deleted) elements.deleted.checked = userData.isDeleted || false;
    if (elements.phone) elements.phone.value = userData.phoneNumber || '';
    if (elements.address) elements.address.value = userData.address || '';
    if (elements.bio) elements.bio.value = userData.bio || '';

    // Handle date of birth (format as YYYY-MM-DD for input[type=date])
    if (elements.dateOfBirth && userData.dateOfBirth) {
        try {
            // Parse the date
            const date = new Date(userData.dateOfBirth);
            if (!isNaN(date.getTime())) {
                // Format date as YYYY-MM-DD
                const formattedDate = date.toISOString().split('T')[0];
                elements.dateOfBirth.value = formattedDate;
            }
        } catch (e) {
            console.error('Error parsing date:', e);
        }
    }

    // Set gender dropdown
    if (elements.gender && userData.gender) {
        const genderOptions = elements.gender.options;
        for (let i = 0; i < genderOptions.length; i++) {
            if (genderOptions[i].value === userData.gender) {
                genderOptions[i].selected = true;
                break;
            }
        }
    }
}

/**
 * Handle user update form submission
 */
function handleUserUpdate(e) {
    e.preventDefault();

    // Validate form
    if (!this.checkValidity()) {
        this.classList.add('was-validated');
        return;
    }

    // Clear previous error messages
    clearFormErrors();

    // Collect form data
    const formData = {
        userId: parseInt(document.getElementById('editUserId').value),
        fullName: document.getElementById('editUserName').value.trim(),
        email: document.getElementById('editUserEmail').value.trim(),
        role: document.getElementById('editUserRole').value,
        isEmailVerified: document.getElementById('editUserEmailVerified').checked,
        isDeleted: document.getElementById('editUserDeleted').checked,
        phoneNumber: document.getElementById('editUserPhone')?.value.trim() || null,
        address: document.getElementById('editUserAddress')?.value.trim() || null,
        dateOfBirth: document.getElementById('editUserDateOfBirth')?.value || null,
        gender: document.getElementById('editUserGender')?.value || null,
        bio: document.getElementById('editUserBio')?.value.trim() || null
    };

    // Get CSRF token
    const token = document.querySelector('input[name="__RequestVerificationToken"]').value;

    // Send data to server
    fetch('/AdminUser/UpdateUser', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'RequestVerificationToken': token
        },
        body: JSON.stringify(formData)
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Show success message
                showNotification('success', data.message);

                // Close the modal
                bootstrap.Modal.getInstance(document.getElementById('editUserModal')).hide();

                // Refresh the page to show updated data
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                // Show error messages
                if (data.errors) {
                    displayFormErrors(data.errors);
                } else {
                    showNotification('error', data.message || 'Có lỗi xảy ra khi cập nhật người dùng.');
                }
            }
        })
        .catch(error => {
            console.error('Error updating user:', error);
            showNotification('error', 'Có lỗi xảy ra khi cập nhật người dùng.');
        });
}

/**
 * Clear form validation error messages
 */
function clearFormErrors() {
    // Remove all error messages
    const errorElements = document.querySelectorAll('.invalid-feedback:not(.form-control ~ .invalid-feedback)');
    errorElements.forEach(element => element.remove());

    // Remove invalid class from inputs
    const invalidInputs = document.querySelectorAll('.is-invalid:not(.form-control.is-invalid)');
    invalidInputs.forEach(input => input.classList.remove('is-invalid'));
}

/**
 * Display form errors
 * @param {Array} errors - Array of error messages
 */
function displayFormErrors(errors) {
    if (!Array.isArray(errors)) return;

    errors.forEach(error => {
        // Show error as notification
        showNotification('error', error);

        // Also highlight fields if possible
        if (error.includes('FullName') || error.includes('Họ tên')) {
            markFieldInvalid('userName');
            markFieldInvalid('editUserName');
        }
        else if (error.includes('Email')) {
            markFieldInvalid('userEmail');
            markFieldInvalid('editUserEmail');
        }
        else if (error.includes('Password') && !error.includes('ConfirmPassword')) {
            markFieldInvalid('userPassword');
        }
        else if (error.includes('ConfirmPassword')) {
            markFieldInvalid('userConfirmPassword');
        }
        else if (error.includes('Role')) {
            markFieldInvalid('userRole');
            markFieldInvalid('editUserRole');
        }
    });
}

/**
 * Mark a form field as invalid
 * @param {string} fieldId - The ID of the field
 */
function markFieldInvalid(fieldId) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.classList.add('is-invalid');
    }
}

/**
 * Show a notification to the user
 * @param {string} type - The notification type (success, error, info)
 * @param {string} message - The message to display
 */
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
    toast.className = `toast align-items-center text-white bg-${type === 'success' ? 'success' : type === 'error' ? 'danger' : 'primary'} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');

    // Create toast content
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'} me-2"></i>
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
