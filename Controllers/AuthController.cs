using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using WebBaoDienTu.Models;
using Microsoft.AspNetCore.Authorization;
using WebBaoDienTu.Services;
using WebBaoDienTu.ViewModels;

namespace WebBaoDienTu.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly BaoDienTuContext _context;
        private readonly ILogger<AuthController> _logger;
        private readonly AuthService _authService;
        private readonly EmailService _emailService;
        private readonly EmailValidationService _emailValidator;

        public AuthController(
            BaoDienTuContext context,
            ILogger<AuthController> logger,
            AuthService authService,
            EmailService emailService,
            EmailValidationService emailValidator)
        {
            _context = context;
            _logger = logger;
            _authService = authService;
            _emailService = emailService;
            _emailValidator = emailValidator;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromForm] LoginViewModel model)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(new { success = false, message = "Dữ liệu không hợp lệ." });

                // Check if account is locked
                if (await _authService.IsAccountLocked(model.Email))
                    return BadRequest(_authService.GetAccountLockedResponse(model.Email));

                var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == model.Email);

                // If user doesn't exist or password is wrong or account is deleted
                if (user == null || !_authService.VerifyPasswordHash(model.Password, user.PasswordHash) || user.IsDeleted)
                {
                    await _authService.TrackFailedLoginAttempt(model.Email);
                    return BadRequest(new { success = false, message = "Email hoặc mật khẩu không đúng hoặc tài khoản đã bị xóa." });
                }

                _authService.ResetFailedLoginAttempts(model.Email);

                // Sign in the user
                await _authService.SignInUserAsync(HttpContext, user, model.RememberMe);

                // Store avatar in session if available
                if (user.Profile?.AvatarUrl != null)
                {
                    HttpContext.Session.SetString("UserAvatarUrl", user.Profile.AvatarUrl);
                }

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during login: {Message}", ex.Message);
                return StatusCode(500, new { success = false, message = "Có lỗi xảy ra: " + ex.Message });
            }
        }

        [HttpGet("LoginWithGoogle")]
        public IActionResult LoginWithGoogle()
        {
            string? redirectUri = Url.Action("ExternalLoginCallback", "Auth", null, Request.Scheme);
            if (redirectUri != null)
            {
                var properties = new AuthenticationProperties
                {
                    RedirectUri = redirectUri,
                    Items = { { "scheme", "Google" }, { "returnUrl", "/" } }
                };
                return Challenge(properties, "Google");
            }
            return BadRequest("Unable to generate redirect URI");
        }

        [HttpGet("LoginWithFacebook")]
        public IActionResult LoginWithFacebook()
        {
            var properties = new AuthenticationProperties
            {
                RedirectUri = Url.Action("ExternalLoginCallback"),
                Items = { { "scheme", "Facebook" }, { "returnUrl", "/" } }
            };
            return Challenge(properties, "Facebook");
        }

        [HttpGet("ExternalLoginCallback")]
        public async Task<IActionResult> ExternalLoginCallback()
        {
            try
            {
                _logger.LogInformation("Starting external login callback processing");

                var result = await HttpContext.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                if (!result.Succeeded)
                {
                    _logger.LogError("Authentication failed: {Message}", result.Failure?.Message);
                    return LocalRedirect("/?error=auth_failed");
                }

                // Get external provider info
                var externalProvider = result.Properties.Items.ContainsKey(".AuthScheme")
                    ? result.Properties.Items[".AuthScheme"]
                    : result.Principal.FindFirst("http://schemas.microsoft.com/ws/2008/06/identity/claims/authenticationmethod")?.Value;

                if (string.IsNullOrEmpty(externalProvider))
                {
                    _logger.LogError("Could not determine external provider");
                    return LocalRedirect("/?error=invalid_provider");
                }

                // Extract user information from claims
                var claims = result.Principal.Claims.ToList();
                var email = claims.FirstOrDefault(c => c.Type == ClaimTypes.Email)?.Value;
                var name = claims.FirstOrDefault(c => c.Type == ClaimTypes.Name)?.Value;
                var providerKey = claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier)?.Value;
                var picture = claims.FirstOrDefault(c => c.Type == "picture")?.Value;

                if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(providerKey))
                {
                    _logger.LogError("Missing required user information from provider");
                    return LocalRedirect("/?error=insufficient_info");
                }

                // Extract token information
                result.Properties.Items.TryGetValue(".Token.access_token", out var accessToken);
                result.Properties.Items.TryGetValue(".Token.refresh_token", out var refreshToken);
                DateTime? expiresAt = null;
                if (result.Properties.Items.TryGetValue(".Token.expires_at", out var expires) &&
                    DateTime.TryParse(expires, out var expiryTime))
                {
                    expiresAt = expiryTime;
                }

                // Handle user sign-in or registration based on social login
                User user = await HandleSocialLogin(externalProvider, providerKey, email, name, picture, accessToken, refreshToken, expiresAt);

                // Sign in the user
                await _authService.SignInUserAsync(HttpContext, user, true);

                // Store avatar in session if available
                if (!string.IsNullOrEmpty(picture))
                {
                    HttpContext.Session.SetString("UserAvatarUrl", picture);
                }
                else if (user.Profile?.AvatarUrl != null)
                {
                    HttpContext.Session.SetString("UserAvatarUrl", user.Profile.AvatarUrl);
                }

                // Redirect to the intended URL or home page
                string returnUrl = "/";
                if (result.Properties.Items.TryGetValue("returnUrl", out var url) && url != null)
                {
                    returnUrl = url;
                }

                return LocalRedirect(returnUrl);

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in ExternalLoginCallback");
                return LocalRedirect("/?error=unexpected_error");
            }
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromForm] RegisterViewModel model)
        {
            try
            {
                // Validate registration data
                var validationResult = await _authService.ValidateRegistrationData(model, ModelState);
                if (validationResult != null)
                    return validationResult;

                string normalizedEmail = model.Email.ToLower();

                // Save pending registration to cache
                _authService.SavePendingRegistration(normalizedEmail, model);

                // Generate and save verification code
                string verificationCode = _authService.GenerateRandomCode();
                await _authService.SaveVerificationCode(model.Email, verificationCode);

                // Send verification email
                try
                {
                    await _authService.SendVerificationEmail(model.Email, model.FullName, verificationCode);
                    _logger.LogInformation("Email xác nhận đã được gửi đến: {Email}", model.Email);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi khi gửi email xác nhận đến: {Email}", model.Email);
                    return StatusCode(500, new
                    {
                        success = false,
                        message = "Đăng ký thất bại do không thể gửi email xác nhận. Vui lòng thử lại sau."
                    });
                }

                return Ok(new
                {
                    success = true,
                    requiresVerification = true,
                    email = model.Email,
                    message = "Đăng ký thành công! Một mã xác nhận đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư đến để xác minh tài khoản."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi không xác định trong quá trình đăng ký: {Email}", model?.Email);
                return StatusCode(500, new { success = false, message = "Có lỗi xảy ra trong quá trình đăng ký: " + ex.Message });
            }
        }


        [HttpPost("verify-email")]
        public async Task<IActionResult> VerifyEmail([FromForm] EmailVerificationViewModel model)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(model.Email) || string.IsNullOrWhiteSpace(model.Code))
                    return BadRequest(new { success = false, message = "Email và mã xác nhận không được để trống." });

                // Find the verification code and validate it
                var verification = await _authService.GetValidVerificationCode(model.Email, model.Code);
                if (verification == null)
                    return BadRequest(new { success = false, message = "Mã xác nhận không tồn tại, không chính xác hoặc đã hết hạn." });

                // Mark code as used
                verification.IsUsed = true;

                // Process user verification based on whether it's a new registration or existing user
                await _authService.ProcessUserVerification(model.Email);

                await _context.SaveChangesAsync();

                return Ok(new
                {
                    success = true,
                    message = "Xác minh email thành công! Bạn có thể đăng nhập vào hệ thống.",
                    redirectToLogin = true
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Có lỗi xảy ra: " + ex.Message });
            }
        }

        [HttpPost("resend-verification")]
        public async Task<IActionResult> ResendVerification([FromForm] ResendVerificationViewModel model)
        {
            if (string.IsNullOrWhiteSpace(model.Email))
                return BadRequest(new { success = false, message = "Email không được để trống." });

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == model.Email && !u.IsEmailVerified);
            if (user == null)
                return BadRequest(new { success = false, message = "Không tìm thấy tài khoản cần xác minh." });

            // Check for too many recent verification attempts
            if (await _authService.TooManyVerificationAttempts(model.Email))
                return BadRequest(new { success = false, message = "Bạn đã gửi quá nhiều yêu cầu xác minh. Vui lòng đợi 5 phút và thử lại." });

            // Generate and send new verification code
            string verificationCode = _authService.GenerateRandomCode();
            await _authService.SaveVerificationCode(model.Email, verificationCode);
            await _authService.SendVerificationEmail(model.Email, user.FullName, verificationCode);

            return Ok(new { success = true, message = "Mã xác nhận mới đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư đến." });
        }

        [HttpPost("logout")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Logout()
        {
            try
            {
                string? userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                string? sessionToken = User.FindFirstValue("SessionToken");

                if (!string.IsNullOrEmpty(userId) && !string.IsNullOrEmpty(sessionToken))
                {
                    // Deactivate the session in the database
                    var session = await _context.UserSessions
                        .FirstOrDefaultAsync(s => s.UserId == int.Parse(userId) && s.Token == sessionToken && s.IsActive);

                    if (session != null)
                    {
                        session.IsActive = false;
                        await _context.SaveChangesAsync();
                    }
                }

                await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Có lỗi xảy ra khi đăng xuất: " + ex.Message });
            }
        }

        [HttpPost("changePassword")]
        [Authorize]
        public async Task<IActionResult> ChangePassword([FromForm] ChangePasswordModel model)
        {
            if (!ModelState.IsValid)
                return BadRequest(new { success = false, message = "Thông tin không hợp lệ." });

            try
            {
                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (string.IsNullOrEmpty(userId) || !int.TryParse(userId, out int id))
                    return Unauthorized(new { success = false, message = "Bạn cần đăng nhập lại." });

                var user = await _context.Users.FindAsync(id);
                if (user == null)
                    return NotFound(new { success = false, message = "Người dùng không tồn tại." });

                var validationResult = _authService.ValidatePasswordChange(user, model);
                if (validationResult != null)
                    return validationResult;

                // Update password
                user.PasswordHash = _authService.HashPassword(model.NewPassword);
                _context.Update(user);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Mật khẩu đã được cập nhật thành công." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error changing password for user");
                return StatusCode(500, new { success = false, message = "Có lỗi xảy ra khi thay đổi mật khẩu." });
            }
        }

        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordViewModel model)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(new { success = false, message = "Email không hợp lệ." });

                // Check if email exists in the system
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == model.Email && !u.IsDeleted);
                if (user == null)
                    return BadRequest(new { success = false, message = "Email này không tồn tại trong hệ thống." });

                // Check for too many recent reset attempts
                if (await _authService.TooManyResetAttempts(model.Email))
                    return BadRequest(new { success = false, message = "Bạn đã gửi quá nhiều yêu cầu đặt lại mật khẩu. Vui lòng đợi 5 phút và thử lại." });

                // Generate and send verification code
                string verificationCode = _authService.GenerateRandomCode();
                await _authService.SaveVerificationCode(model.Email, verificationCode, "reset");
                await _authService.SendPasswordResetEmail(model.Email, user.FullName, verificationCode);

                return Ok(new
                {
                    success = true,
                    message = "Mã xác nhận đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư đến.",
                    email = model.Email
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during password reset request for {Email}", model.Email);
                return StatusCode(500, new { success = false, message = "Có lỗi xảy ra: " + ex.Message });
            }
        }

        [HttpPost("verify-reset-code")]
        public async Task<IActionResult> VerifyResetCode([FromBody] EmailVerificationViewModel model)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(model.Email) || string.IsNullOrWhiteSpace(model.Code))
                    return BadRequest(new { success = false, message = "Email và mã xác nhận không được để trống." });

                var verification = await _authService.GetValidVerificationCode(model.Email, model.Code, "reset");
                if (verification == null)
                    return BadRequest(new { success = false, message = "Mã xác nhận không tồn tại, không chính xác hoặc đã hết hạn." });

                return Ok(new
                {
                    success = true,
                    message = "Xác minh thành công. Bạn có thể thiết lập mật khẩu mới.",
                    proceedToReset = true
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = "Có lỗi xảy ra: " + ex.Message });
            }
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordViewModel model)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(new { success = false, message = "Thông tin không hợp lệ." });

                var verification = await _authService.GetValidVerificationCode(model.Email, model.Code, "reset");
                if (verification == null)
                    return BadRequest(new { success = false, message = "Mã khôi phục không tồn tại, không chính xác hoặc đã hết hạn." });

                var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == model.Email && !u.IsDeleted);
                if (user == null)
                    return NotFound(new { success = false, message = "Không tìm thấy tài khoản với email này." });

                // Validate password complexity
                var passwordRegex = new System.Text.RegularExpressions.Regex(@"^(?=.*[A-Z])(?=.*\d).{6,8}$");
                if (!passwordRegex.IsMatch(model.NewPassword))
                    return BadRequest(new { success = false, message = "Mật khẩu mới phải từ 6-8 ký tự, chứa ít nhất một chữ cái in hoa và một số." });

                // Mark code as used
                verification.IsUsed = true;
                _context.Update(verification);

                // Update password
                user.PasswordHash = _authService.HashPassword(model.NewPassword);
                _context.Update(user);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Mật khẩu đã được đặt lại thành công. Bạn có thể đăng nhập với mật khẩu mới." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during password reset for {Email}", model.Email);
                return StatusCode(500, new { success = false, message = "Có lỗi xảy ra: " + ex.Message });
            }
        }

        [HttpGet("check-session")]
        [Authorize]
        public async Task<IActionResult> CheckSessionStatus()
        {
            string? userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            string? sessionToken = User.FindFirstValue("SessionToken");

            if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(sessionToken))
                return Unauthorized(new { success = false, message = "Phiên đăng nhập không hợp lệ", requireLogin = true });

            var session = await _context.UserSessions
                .FirstOrDefaultAsync(s =>
                    s.UserId == int.Parse(userId) &&
                    s.Token == sessionToken &&
                    s.IsActive &&
                    s.ExpiresAt > DateTime.Now);

            if (session != null)
            {
                session.LastActivity = DateTime.Now;
                await _context.SaveChangesAsync();
                return Ok(new { valid = true });
            }

            return Unauthorized(new
            {
                success = false,
                message = "Phiên đăng nhập đã hết hạn hoặc không còn hợp lệ",
                requireLogin = true,
                reason = "session_expired"
            });
        }

        [HttpPost("ValidateEmail")]
        public async Task<IActionResult> ValidateEmail([FromBody] EmailValidationViewModel model)
        {
            if (string.IsNullOrWhiteSpace(model?.Email))
                return BadRequest(new { exists = false, message = "Email không được để trống" });

            bool isValidEmail = await _emailValidator.ValidateEmail(model.Email);
            return Ok(new
            {
                exists = isValidEmail,
                message = isValidEmail ? "Email hợp lệ" : "Email này không tồn tại. Vui lòng nhập một địa chỉ email hợp lệ."
            });
        }

        [HttpPost("VerifyEmailExists")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> VerifyEmailExists([FromBody] EmailValidationViewModel model)
        {
            if (string.IsNullOrWhiteSpace(model?.Email))
                return BadRequest(new { exists = false, message = "Email không được để trống" });

            bool exists = await _context.Users.AnyAsync(u => u.Email == model.Email && !u.IsDeleted);
            return Ok(new
            {
                exists = exists,
                message = exists
                    ? "Email hợp lệ và đã đăng ký trong hệ thống"
                    : "Email này chưa được đăng ký trong hệ thống. Vui lòng kiểm tra lại hoặc đăng ký tài khoản mới."
            });
        }

        private async Task<User> HandleSocialLogin(
            string provider,
            string providerKey,
            string email,
            string? name,
            string? picture = null,
            string? accessToken = null,
            string? refreshToken = null,
            DateTime? expiresAt = null)
        {
            // Check if this social account is already linked
            var existingSocialLogin = await _context.SocialLogins
                .Include(s => s.User)
                .FirstOrDefaultAsync(s => s.Provider == provider && s.ProviderUserId == providerKey);

            User user;

            // Case 1: Social login exists - update and return the user
            if (existingSocialLogin != null)
            {
                user = existingSocialLogin.User;

                // Update the social login tokens
                existingSocialLogin.ProviderAccessToken = accessToken;
                existingSocialLogin.ProviderRefreshToken = refreshToken;
                existingSocialLogin.TokenExpiresAt = expiresAt;
                existingSocialLogin.UpdatedAt = DateTime.Now;

                _context.Update(existingSocialLogin);
                await _context.SaveChangesAsync();

                return user;
            }

            // Case 2: User exists with this email but hasn't linked this social account
            user = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Email == email && !u.IsDeleted)
                ?? throw new InvalidOperationException("User not found or is deleted.");

            if (user != null)
            {
                // Link this social account to the existing user
                var socialLogin = new SocialLogin
                {
                    UserId = user.UserId,
                    Provider = provider,
                    ProviderUserId = providerKey,
                    ProviderAccessToken = accessToken,
                    ProviderRefreshToken = refreshToken,
                    TokenExpiresAt = expiresAt,
                    ProfileDataJson = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        Name = name,
                        Email = email,
                        Picture = picture
                    }),
                    CreatedAt = DateTime.Now
                };

                _context.SocialLogins.Add(socialLogin);

                // Update profile picture if it doesn't exist
                if (user.Profile != null && string.IsNullOrEmpty(user.Profile.AvatarUrl) && !string.IsNullOrEmpty(picture))
                {
                    user.Profile.AvatarUrl = picture;
                    _context.Update(user.Profile);
                }

                await _context.SaveChangesAsync();
                return user;
            }

            // Case 3: Create a new user with this social login
            user = new User
            {
                Email = email,
                FullName = name ?? email.Split('@')[0],
                PasswordHash = Convert.ToBase64String(Guid.NewGuid().ToByteArray()),  // Random password for social users
                Role = "User",
                IsEmailVerified = true, // Social logins are pre-verified
                CreatedAt = DateTime.Now
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            // Create user profile
            var profile = new UserProfile
            {
                UserId = user.UserId,
                AvatarUrl = picture,
                CreatedAt = DateTime.Now
            };
            _context.UserProfiles.Add(profile);

            // Create social login record
            var newSocialLogin = new SocialLogin
            {
                UserId = user.UserId,
                Provider = provider,
                ProviderUserId = providerKey,
                ProviderAccessToken = accessToken,
                ProviderRefreshToken = refreshToken,
                TokenExpiresAt = expiresAt,
                ProfileDataJson = System.Text.Json.JsonSerializer.Serialize(new
                {
                    Name = name,
                    Email = email,
                    Picture = picture
                }),
                CreatedAt = DateTime.Now
            };

            _context.SocialLogins.Add(newSocialLogin);
            await _context.SaveChangesAsync();

            return user;
        }


        // This class remains in the same file
        public class PendingRegistration
        {
            public string Email { get; set; } = null!;
            public string FullName { get; set; } = null!;
            public string PasswordHash { get; set; } = null!;
            public DateTime CreatedAt { get; set; }
            public DateTime ExpiresAt { get; set; }
        }
    }
}
