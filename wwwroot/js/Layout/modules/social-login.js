// wwwroot/js/Layout/modules/social-login.js

const SocialLogin = {
    init: function () {
        this.bindEvents();
        this.handleErrors();
    },

    bindEvents: function () {
        // Xử lý sự kiện click cho nút đăng nhập Facebook
        document.querySelectorAll('.social-btn.facebook').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleSocialLogin(button, 'facebook');
            });
        });

        // Xử lý sự kiện click cho nút đăng nhập Google
        document.querySelectorAll('.social-btn.google').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleSocialLogin(button, 'google');
            });
        });
    },

    handleSocialLogin: function (button, provider) {
        // Lưu icon hiện tại
        const originalContent = button.innerHTML;

        // Hiển thị trạng thái loading
        button.classList.add('loading');
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        // Xác định URL chuyển hướng
        const url = provider === 'facebook'
            ? '/api/Auth/LoginWithFacebook'
            : '/api/Auth/LoginWithGoogle';

        // Thêm thời gian chờ ngắn để animation hiển thị
        setTimeout(() => {
            window.location.href = url;
        }, 400);

        // Phục hồi nút sau 5 giây nếu redirect không hoạt động
        setTimeout(() => {
            if (document.body.contains(button)) {
                button.classList.remove('loading');
                button.innerHTML = originalContent;
            }
        }, 5000);
    },

    handleErrors: function () {
        // Kiểm tra query string để hiển thị lỗi
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');

        if (error === 'auth_failed') {
            this.showErrorMessage('Đăng nhập mạng xã hội không thành công. Vui lòng thử lại sau.');
        } else if (error === 'insufficient_info') {
            this.showErrorMessage('Không thể lấy đủ thông tin từ tài khoản mạng xã hội. Vui lòng thử phương thức khác.');
        } else if (error === 'invalid_provider') {
            this.showErrorMessage('Không thể xác định nhà cung cấp đăng nhập. Vui lòng thử lại.');
        } else if (error === 'facebook_auth_error') {
            this.showErrorMessage('Có lỗi khi xác thực với Facebook. Vui lòng thử lại sau.');
        }
    },

    showErrorMessage: function (message) {
        // Sử dụng SweetAlert2 nếu có
        if (typeof Swal !== 'undefined') {
            const Toast = Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 5000,
                timerProgressBar: true,
                didOpen: (toast) => {
                    toast.addEventListener('mouseenter', Swal.stopTimer);
                    toast.addEventListener('mouseleave', Swal.resumeTimer);
                }
            });

            Toast.fire({
                icon: 'error',
                title: message
            });
        } else {
            // Fallback nếu không có SweetAlert
            alert(message);
        }
    }
};

// Khởi tạo module khi document đã sẵn sàng
document.addEventListener('DOMContentLoaded', function () {
    SocialLogin.init();
});

export default SocialLogin;
