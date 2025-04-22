// wwwroot/js/Layout/modules/password-reset.js

/**
 * Password Reset Manager
 * Handles the forgot password and reset password functionality
 */
export default class PasswordResetManager {
    constructor() {
        this.resetEmailInProgress = null;
        this.resendCooldown = false;
        this.countdownInterval = null;
        this.verifiedEmail = null;
        this.verifiedCode = null;
        this.currentStep = 1; // 1: Email entry, 2: Verification code, 3: New password
    }

    /**
     * Initialize the password reset functionality
     */
    init() {
        this.setupEventHandlers();
        this.initModalContent();
    }

    /**
     * Initialize modal content structure
     */
    initModalContent() {
        // Create the multi-step form structure if it doesn't exist
        if (!$('#forgotPasswordSteps').length) {
            const modalBody = $('#forgotPasswordModal .modal-body');
            const originalContent = modalBody.html();

            modalBody.html(`
                <div id="forgotPasswordSteps">
                    <div id="step1" class="step-content">
                        ${originalContent}
                    </div>
                    <div id="step2" class="step-content" style="display: none;">
                        <div class="text-center mb-4">
                            <h5>Nhập mã xác nhận</h5>
                            <p class="text-muted">Chúng tôi đã gửi mã xác nhận đến email <strong id="confirmationEmail"></strong></p>
                        </div>
                        <div class="form-group verification-code-group">
                            <label for="verificationCode">Mã xác nhận</label>
                            <input type="text" class="form-control" id="verificationCode" placeholder="Nhập mã 6 chữ số" maxlength="6">
                            <div class="mt-2">
                                <button type="button" class="btn btn-link p-0 resend-code-btn">Gửi lại mã</button>
                                <span class="countdown-timer ml-2" style="display: none;"></span>
                            </div>
                        </div>
                        <div class="alert alert-danger" id="verificationErrorMessage" style="display: none;"></div>
                        <div class="text-center mt-4">
                            <button type="button" class="btn btn-primary btn-block" id="verifyCodeBtn">Xác nhận mã</button>
                        </div>
                    </div>
                    <div id="step3" class="step-content" style="display: none;">
                        <div class="text-center mb-4">
                            <h5>Tạo mật khẩu mới</h5>
                        </div>
                        <div class="form-group">
                            <label for="newPassword">Mật khẩu mới</label>
                            <input type="password" class="form-control" id="newPassword" placeholder="Mật khẩu mới">
                            <small class="form-text text-muted">Mật khẩu phải từ 6-8 ký tự, chứa ít nhất một chữ cái in hoa và một số</small>
                        </div>
                        <div class="form-group">
                            <label for="confirmPassword">Xác nhận mật khẩu</label>
                            <input type="password" class="form-control" id="confirmPassword" placeholder="Xác nhận mật khẩu">
                        </div>
                        <div class="alert alert-danger" id="passwordResetErrorMessage" style="display: none;"></div>
                        <div class="text-center mt-4">
                            <button type="button" class="btn btn-primary btn-block" id="resetPasswordBtn">Đặt lại mật khẩu</button>
                        </div>
                    </div>
                </div>
            `);

            // Update modal title
            $('#forgotPasswordModal .modal-title').text('Khôi phục mật khẩu');
        }
    }

    /**
     * Set up event handlers for password reset forms
     */
    setupEventHandlers() {
        $('#forgotPasswordForm').on('submit', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const email = $('#forgotPasswordEmail').val().trim();
            const submitBtn = $(e.target).find('button[type="submit"]');
            this.handleForgotPassword(email, submitBtn);
        });

        // Verification code step (Step 2)
        // In setupEventHandlers
        $(document).on('click', '#verifyCodeBtn', (e) => {
            e.preventDefault();

            const codeInput = document.getElementById('verificationCode');
            const code = codeInput ? codeInput.value.trim() : '';
            console.log('Submitting verification code:', code);

            if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
                $("#verificationErrorMessage").text("Mã xác nhận phải gồm 6 chữ số").show();
                return;
            }

            this.processVerificationCode(code, $(e.target));
        });

        // Reset password step (Step 3)
        $(document).on('click', '#resetPasswordBtn', (e) => {
            const newPassword = $('#newPassword').val();
            const confirmPassword = $('#confirmPassword').val();
            this.handleResetPassword(newPassword, confirmPassword, $(e.target));
        });

        // Resend verification code
        $(document).on('click', '.resend-code-btn', () => {
            if (!this.resendCooldown && this.resetEmailInProgress) {
                this.resendVerificationCode(this.resetEmailInProgress);
            }
        });

        // Add this to your setupEventHandlers() method
        $(document).on('click', '#verifyCodeBtn', (e) => {
            e.preventDefault();

            const codeInput = document.getElementById('verificationCode');
            const code = codeInput ? codeInput.value.trim() : '';
            console.log('Submitting verification code:', code);

            if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
                $("#verificationErrorMessage").text("Mã xác nhận phải gồm 6 chữ số").show();
                return;
            }

            this.processVerificationCode(code, $(e.target));
        });



        // Add input listener to ensure code is captured properly
        $(document).on('input', '#verificationCode', (e) => {
            console.log('Verification code updated:', e.target.value);
        });

        // Reset all steps when modal is closed
        $('#forgotPasswordModal').on('hidden.bs.modal', () => {
            this.resetSteps();
        });

        // Show forgot password modal when link is clicked
        $('#forgotPasswordLink').on('click', (e) => {
            e.preventDefault();
            $('#loginModal').modal('hide');
            $('#forgotPasswordModal').modal('show');
        });
    }

    // Fix the processVerificationCode method that's currently incomplete
    processVerificationCode(code, submitBtn) {
        this.setButtonLoading(submitBtn, true);
        $("#verificationErrorMessage").removeClass("alert-danger").addClass("alert-info")
            .text("Đang xác thực mã...").show();

        // Add debug info
        this.showDebugInfo("Xác thực với mã", { code, email: this.resetEmailInProgress });

        $.ajax({
            type: "POST",
            url: "/api/Auth/verify-reset-code",
            data: JSON.stringify({
                email: this.resetEmailInProgress,
                code: code
            }),
            contentType: "application/json",
            success: (response) => {
                // Add debug info
                this.showDebugInfo("Phản hồi từ server", response);
                this.setButtonLoading(submitBtn, false);

                if (response.success && response.proceedToReset) {
                    this.verifiedEmail = this.resetEmailInProgress;
                    this.verifiedCode = code;
                    this.showDebugInfo("Xác thực thành công, chuyển sang bước 3");
                    this.goToStep(3);
                } else {
                    this.showDebugInfo("Xác thực thất bại", response);
                    $("#verificationErrorMessage").removeClass("alert-info").addClass("alert-danger")
                        .text(response.message || "Xác minh không thành công").show();
                }
            },
            error: (xhr, status, error) => {
                this.showDebugInfo("Lỗi xác thực", { status, error, response: xhr.responseText });
                this.setButtonLoading(submitBtn, false);

                let errorMsg = "Mã xác nhận không hợp lệ hoặc đã hết hạn.";
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMsg = xhr.responseJSON.message;
                } else if (error) {
                    errorMsg = "Lỗi: " + error;
                }

                $("#verificationErrorMessage").removeClass("alert-info").addClass("alert-danger")
                    .text(errorMsg).show();

                this.showToast('Lỗi xác minh', errorMsg, 'error');
            }
        });
    }


    /**
     * Reset to first step
     */
    resetSteps() {
        this.currentStep = 1;
        this.resetEmailInProgress = null;
        this.verifiedEmail = null;
        this.verifiedCode = null;

        // Reset form fields
        $('#forgotPasswordForm')[0].reset();
        $('#verificationCode').val('');
        $('#newPassword').val('');
        $('#confirmPassword').val('');

        // Hide all steps except the first one
        $('.step-content').hide();
        $('#step1').show();

        // Hide all error messages
        $('.alert').hide();

        // Reset cooldown
        this.resendCooldown = false;
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        $('.countdown-timer').hide();
        $('.resend-code-btn').removeClass('disabled');
    }

    /**
     * Handle forgot password request (Step 1)
     * @param {string} email - User's email
     * @param {jQuery} submitBtn - Submit button element
     */
    handleForgotPassword(email, submitBtn) {
        $("#forgotPasswordErrorMessage").hide();
        $("#forgotPasswordSuccessMessage").hide();

        if (!email || !this.validateEmail(email)) {
            $("#forgotPasswordErrorMessage").text("Vui lòng nhập một địa chỉ email hợp lệ").show();
            return;
        }

        this.setButtonLoading(submitBtn, true);

        // First, check if the email exists in the database
        $.ajax({
            type: "POST",
            url: "/api/Auth/VerifyEmailExists",
            data: JSON.stringify({ email: email }),
            contentType: "application/json",
            headers: {
                "RequestVerificationToken": $('input[name="__RequestVerificationToken"]').val()
            },
            success: (response) => {
                if (response.exists) {
                    // Email exists in database, proceed with password reset
                    this.sendResetCode(email, submitBtn);
                } else {
                    // Email doesn't exist in database, show error
                    this.setButtonLoading(submitBtn, false);
                    $("#forgotPasswordErrorMessage").text("Email này không tồn tại trong hệ thống. Vui lòng kiểm tra lại hoặc đăng ký tài khoản mới.").show();
                }
            },
            error: (xhr) => {
                this.setButtonLoading(submitBtn, false);
                const errorMsg = xhr.responseJSON?.message || "Có lỗi xảy ra khi kiểm tra email. Vui lòng thử lại sau.";
                $("#forgotPasswordErrorMessage").text(errorMsg).show();
            }
        });
    }

    /**
     * Send reset code to user's email
     * @param {string} email - Email address
     * @param {jQuery} submitBtn - Submit button
     */
    sendResetCode(email, submitBtn) {
        $.ajax({
            type: "POST",
            url: "/api/Auth/forgot-password",
            data: JSON.stringify({ email: email }),
            contentType: "application/json",
            success: (response) => {
                this.setButtonLoading(submitBtn, false);

                if (response.success) {
                    // Store email for next steps
                    this.resetEmailInProgress = email;

                    // Move to step 2
                    this.goToStep(2);
                    $('#confirmationEmail').text(email);

                    // Start countdown for resend code
                    this.startResendCountdown(60);
                } else {
                    $("#forgotPasswordErrorMessage").text(response.message).show();
                }
            },
            error: (xhr) => {
                this.setButtonLoading(submitBtn, false);
                const errorMsg = xhr.responseJSON?.message || "Có lỗi xảy ra. Vui lòng thử lại sau.";
                $("#forgotPasswordErrorMessage").text(errorMsg).show();
            }
        });
    }

    /**
  * Handle verification code confirmation (Step 2)
  * @param {string} code - Verification code
  * @param {jQuery} submitBtn - Submit button
  */
    handleVerifyCode(code, submitBtn) {
        $("#verificationErrorMessage").hide();

        // Get the code directly from the DOM and ensure we wait for it to be available
        setTimeout(() => {
            // Always use the actual DOM element value, not the parameter
            const directCode = document.getElementById('verificationCode').value.trim();

            this.showDebugInfo("Verification code value", {
                "Original code": code,
                "DOM value": directCode
            });

            // Validate the code
            if (!directCode || directCode.length !== 6 || !/^\d+$/.test(directCode)) {
                $("#verificationErrorMessage").text("Mã xác nhận phải gồm 6 chữ số").show();
                this.showDebugInfo("Lỗi: Mã xác nhận không hợp lệ");
                return;
            }

            this.setButtonLoading(submitBtn, true);
            $("#verificationErrorMessage").removeClass("alert-danger").addClass("alert-info")
                .text("Đang xác thực mã...").show();

            $.ajax({
                type: "POST",
                url: "/api/Auth/verify-reset-code",
                data: JSON.stringify({
                    email: this.resetEmailInProgress,
                    code: directCode
                }),
                contentType: "application/json",
                success: (response) => {
                    // Rest of the code remains the same
                    this.showDebugInfo("Phản hồi từ server", response);
                    this.setButtonLoading(submitBtn, false);

                    if (response.success && response.proceedToReset) {
                        this.verifiedEmail = this.resetEmailInProgress;
                        this.verifiedCode = directCode;
                        this.showDebugInfo("Xác thực thành công, chuyển sang bước 3");
                        this.goToStep(3);
                    } else {
                        this.showDebugInfo("Xác thực thất bại", response);
                        $("#verificationErrorMessage").removeClass("alert-info").addClass("alert-danger")
                            .text(response.message || "Xác minh không thành công").show();
                    }
                },
                error: (xhr, status, error) => {
                    // Error handling remains the same
                    this.showDebugInfo("Lỗi xác thực", { status, error, response: xhr.responseText });
                    this.setButtonLoading(submitBtn, false);

                    let errorMsg = "Mã xác nhận không hợp lệ hoặc đã hết hạn.";
                    if (xhr.responseJSON && xhr.responseJSON.message) {
                        errorMsg = xhr.responseJSON.message;
                    } else if (error) {
                        errorMsg = "Lỗi: " + error;
                    }

                    $("#verificationErrorMessage").removeClass("alert-info").addClass("alert-danger")
                        .text(errorMsg).show();

                    this.showToast('Lỗi xác minh', errorMsg, 'error');
                }
            });
        }, 100); // Small delay to ensure DOM is ready
    }

    // Add this function to your password-reset.js class
    showDebugInfo(message, data = null) {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log(message, data);
            // For local development, you could also display a small debug panel
            if (!$("#debug-panel").length) {
                $("body").append(`
                <div id="debug-panel" style="position:fixed; bottom:10px; left:10px; background:#f8f9fa; 
                border:1px solid #ddd; padding:10px; max-width:400px; z-index:9999; font-size:12px;">
                    <div class="debug-header" style="font-weight:bold; margin-bottom:5px;">Debug Info:</div>
                    <div class="debug-content" style="max-height:200px; overflow:auto;"></div>
                </div>
            `);
            }
            $("#debug-panel .debug-content").append(`<div>${message}</div>`);
            if (data) {
                $("#debug-panel .debug-content").append(`<pre>${JSON.stringify(data, null, 2)}</pre>`);
            }
        }
    }

    /**
     * Handle password reset (Step 3)
     * @param {string} newPassword - New password
     * @param {string} confirmPassword - Confirm password
     * @param {jQuery} submitBtn - Submit button element
     */
    handleResetPassword(newPassword, confirmPassword, submitBtn) {
        $("#passwordResetErrorMessage").hide();

        // Validate password
        const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{6,8}$/;
        if (!passwordRegex.test(newPassword)) {
            $("#passwordResetErrorMessage").text("Mật khẩu phải từ 6-8 ký tự, chứa ít nhất một chữ cái in hoa và một số.").show();
            return;
        }

        // Validate password match
        if (newPassword !== confirmPassword) {
            $("#passwordResetErrorMessage").text("Mật khẩu xác nhận không khớp.").show();
            return;
        }

        this.setButtonLoading(submitBtn, true);

        const requestData = {
            email: this.verifiedEmail,
            code: this.verifiedCode,
            newPassword: newPassword,
            confirmPassword: confirmPassword
        };

        console.log("Sending reset password request:", {
            email: requestData.email,
            code: requestData.code
        });

        $.ajax({
            type: "POST",
            url: "/api/Auth/reset-password",
            data: JSON.stringify(requestData),
            contentType: "application/json",
            success: (response) => {
                this.setButtonLoading(submitBtn, false);
                if (response.success) {
                    $('#forgotPasswordModal').modal('hide');
                    this.showSuccessMessage(response.message);

                    // Clear stored data
                    this.resetEmailInProgress = null;
                    this.verifiedEmail = null;
                    this.verifiedCode = null;

                    // Show login modal after success message
                    setTimeout(() => {
                        $('#successModal').modal('hide');
                        $('#loginModal').modal('show');
                    }, 2000);
                } else {
                    $("#passwordResetErrorMessage").text(response.message).show();
                }
            },
            error: (xhr) => {
                console.error("Reset password error:", xhr);
                this.setButtonLoading(submitBtn, false);
                const errorMsg = xhr.responseJSON?.message || "Có lỗi xảy ra. Vui lòng thử lại sau.";
                $("#passwordResetErrorMessage").text(errorMsg).show();
            }
        });
    }

    /**
     * Go to specified step
     * @param {number} step - Step number
     */
    // Thêm đoạn code này vào hàm goToStep
    goToStep(step) {
        this.currentStep = step;
        $('.step-content').hide();
        $(`#step${step}`).show();

        // Update modal title based on step
        let title = 'Khôi phục mật khẩu';
        switch (step) {
            case 2:
                title = 'Xác nhận mã';
                // Đặt focus vào ô input khi chuyển đến bước 2
                setTimeout(() => {
                    const codeInput = document.getElementById('verificationCode');
                    if (codeInput) {
                        codeInput.focus();
                        console.log('Đã đặt focus vào trường nhập mã xác nhận');
                    } else {
                        console.error('Không tìm thấy phần tử nhập mã xác nhận!');
                    }
                }, 300);
                break;
            case 3:
                title = 'Tạo mật khẩu mới';
                break;
        }
        $('#forgotPasswordModal .modal-title').text(title);
    }


    /**
     * Resend verification code
     * @param {string} email - Email address
     */
    resendVerificationCode(email) {
        $('.resend-code-btn').addClass('disabled');
        this.resendCooldown = true;

        $.ajax({
            type: "POST",
            url: "/api/Auth/forgot-password", // Use forgot-password to resend code
            data: JSON.stringify({ email: email }),
            contentType: "application/json",
            success: (response) => {
                if (response.success) {
                    this.startResendCountdown(60);
                    this.showToast('Thành công', 'Mã xác nhận mới đã được gửi đến email của bạn', 'success');
                } else {
                    $('.resend-code-btn').removeClass('disabled');
                    this.resendCooldown = false;
                    this.showToast('Lỗi', response.message, 'error');
                }
            },
            error: (xhr) => {
                $('.resend-code-btn').removeClass('disabled');
                this.resendCooldown = false;
                const errorMsg = xhr.responseJSON?.message || "Có lỗi xảy ra. Vui lòng thử lại sau.";
                this.showToast('Lỗi', errorMsg, 'error');
            }
        });
    }

    /**
     * Start countdown for resend button
     * @param {number} seconds - Countdown seconds
     */
    startResendCountdown(seconds) {
        let remainingSeconds = seconds;
        $('.countdown-timer').show().text(`(${remainingSeconds}s)`);

        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }

        this.countdownInterval = setInterval(() => {
            remainingSeconds--;
            $('.countdown-timer').text(`(${remainingSeconds}s)`);

            if (remainingSeconds <= 0) {
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
                $('.countdown-timer').hide();
                $('.resend-code-btn').removeClass('disabled');
                this.resendCooldown = false;
            }
        }, 1000);
    }

    /**
     * Show toast notification
     * @param {string} title - Toast title
     * @param {string} message - Toast message
     * @param {string} type - Toast type (success, error, etc.)
     */
    showToast(title, message, type = "error") {
        // Using SweetAlert2 for toast
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        });

        Toast.fire({
            icon: type,
            title: message
        });
    }

    /**
     * Show success message in modal
     * @param {string} message - Success message
     */
    showSuccessMessage(message) {
        $('#successMessage').text(message);
        $('#successModal').modal('show');
    }

    /**
     * Set button loading state
     * @param {jQuery} button - Button element
     * @param {boolean} isLoading - Whether the button is loading
     */
    setButtonLoading(button, isLoading) {
        if (isLoading) {
            button.data('original-html', button.html());
            button.html('<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Đang xử lý...');
            button.prop('disabled', true);
        } else {
            button.html(button.data('original-html'));
            button.prop('disabled', false);
        }
    }

    /**
     * Helper method to validate email format
     * @param {string} email - Email to validate
     * @returns {boolean} - Whether email is valid
     */
    validateEmail(email) {
        const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    }
}
