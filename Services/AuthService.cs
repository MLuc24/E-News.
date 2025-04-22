// Services/AuthService.cs
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.Security.Claims;
using WebBaoDienTu.Models;
using WebBaoDienTu.ViewModels;

namespace WebBaoDienTu.Services
{
    public class AuthService
    {
        private readonly BaoDienTuContext _context;
        private readonly ILogger<AuthService> _logger;
        private readonly IMemoryCache _cache;
        private readonly EmailService _emailService;
        private readonly EmailValidationService _emailValidator;

        private const int MaxFailedAttempts = 5;
        private const int LockoutDurationMinutes = 15;
        private const int VerificationCodeExpiryMinutes = 30;
        private const string USER_SESSION_PREFIX = "user_active_session_";

        public AuthService(
            BaoDienTuContext context,
            ILogger<AuthService> logger,
            IMemoryCache memoryCache,
            EmailService emailService,
            EmailValidationService emailValidator)
        {
            _context = context;
            _logger = logger;
            _cache = memoryCache;
            _emailService = emailService;
            _emailValidator = emailValidator;
        }

        public Task<bool> IsAccountLocked(string email)
        {
            if (string.IsNullOrEmpty(email)) return Task.FromResult(false);

            string cacheKeyLocked = $"account_locked_{email.ToLower()}";
            if (_cache.TryGetValue(cacheKeyLocked, out DateTime lockedUntil))
            {
                if (DateTime.Now < lockedUntil)
                    return Task.FromResult(true);
                else
                    _cache.Remove(cacheKeyLocked);
            }
            return Task.FromResult(false);
        }

        public object GetAccountLockedResponse(string email)
        {
            string cacheKeyLocked = $"account_locked_{email.ToLower()}";
            if (_cache.TryGetValue(cacheKeyLocked, out DateTime lockedUntil))
            {
                TimeSpan remainingTime = lockedUntil - DateTime.Now;
                string remainingMinutes = Math.Ceiling(remainingTime.TotalMinutes).ToString();

                return new
                {
                    success = false,
                    message = $"Tài khoản đã bị tạm khóa. Vui lòng thử lại sau {remainingMinutes} phút.",
                    isLocked = true,
                    remainingMinutes = remainingMinutes
                };
            }
            return new { success = false, message = "Tài khoản đã bị tạm khóa." };
        }

        public Task TrackFailedLoginAttempt(string email)
        {
            if (string.IsNullOrEmpty(email)) return Task.CompletedTask;

            string normalizedEmail = email.ToLower();
            string cacheKey = $"failed_attempts_{normalizedEmail}";

            int attempts = 1;
            if (_cache.TryGetValue(cacheKey, out int currentAttempts))
                attempts = currentAttempts + 1;

            _cache.Set(cacheKey, attempts, TimeSpan.FromMinutes(30));
            _logger.LogWarning("Failed login attempt {count} for email: {email}", attempts, email);

            if (attempts >= MaxFailedAttempts)
            {
                DateTime lockUntil = DateTime.Now.AddMinutes(LockoutDurationMinutes);
                _cache.Set($"account_locked_{normalizedEmail}", lockUntil,
                    TimeSpan.FromMinutes(LockoutDurationMinutes + 1));

                _logger.LogWarning("Account locked for email: {email} until {time}", email, lockUntil);
                _cache.Remove(cacheKey);
            }

            return Task.CompletedTask;
        }

        public void ResetFailedLoginAttempts(string email)
        {
            if (string.IsNullOrEmpty(email)) return;

            string normalizedEmail = email.ToLower();
            _cache.Remove($"failed_attempts_{normalizedEmail}");
            _cache.Remove($"account_locked_{normalizedEmail}");
        }

        public async Task<IActionResult?> ValidateRegistrationData(RegisterViewModel model, ModelStateDictionary modelState)
        {
            if (!modelState.IsValid)
            {
                return new BadRequestObjectResult(new { success = false, message = "Dữ liệu không hợp lệ." });
            }

            if (model.Password != model.ConfirmPassword)
            {
                return new BadRequestObjectResult(new { success = false, message = "Mật khẩu xác nhận không khớp." });
            }

            if (string.IsNullOrWhiteSpace(model.FullName))
            {
                return new BadRequestObjectResult(new { success = false, message = "Họ tên không được để trống." });
            }

            // Check email format first
            if (!_emailValidator.IsValidEmail(model.Email))
            {
                return new BadRequestObjectResult(new { success = false, message = "Địa chỉ email không đúng định dạng." });
            }

            // Complete email validation
            bool emailValid = await _emailValidator.ValidateEmail(model.Email);
            if (!emailValid)
            {
                return new BadRequestObjectResult(new { success = false, message = "Không thể xác minh địa chỉ email này. Vui lòng sử dụng một địa chỉ email thật." });
            }

            // Check if email already exists in system
            string normalizedEmail = model.Email.ToLower();
            var userExists = await _context.Users.AnyAsync(u => u.Email.ToLower() == normalizedEmail && !u.IsDeleted);
            if (userExists)
            {
                return new BadRequestObjectResult(new { success = false, message = "Email đã tồn tại trong hệ thống." });
            }

            return null;
        }


        public void SavePendingRegistration(string normalizedEmail, RegisterViewModel model)
        {
            string registrationKey = $"pending_registration_{normalizedEmail}";
            var pendingRegistration = new PendingRegistration
            {
                Email = model.Email,
                FullName = model.FullName,
                PasswordHash = HashPassword(model.Password),
                CreatedAt = DateTime.Now,
                ExpiresAt = DateTime.Now.AddMinutes(VerificationCodeExpiryMinutes)
            };

            _cache.Set(registrationKey, pendingRegistration, TimeSpan.FromMinutes(VerificationCodeExpiryMinutes));
        }

        public async Task SaveVerificationCode(string email, string code, string type = "email")
        {
            var verification = new VerificationCode
            {
                Email = email,
                Code = code,
                ExpiresAt = DateTime.Now.AddMinutes(VerificationCodeExpiryMinutes),
                CreatedAt = DateTime.Now,
                Type = type
            };

            _context.VerificationCodes.Add(verification);
            await _context.SaveChangesAsync();
        }

        public async Task<VerificationCode?> GetValidVerificationCode(string email, string code, string type = "email")
        {
            return await _context.VerificationCodes
                .Where(v => v.Email == email &&
                       !v.IsUsed &&
                       v.ExpiresAt > DateTime.Now &&
                       v.Code == code &&
                       v.Type == type)
                .OrderByDescending(v => v.CreatedAt)
                .FirstOrDefaultAsync();
        }

        public async Task ProcessUserVerification(string email)
        {
            string registrationKey = $"pending_registration_{email.ToLower()}";
            bool isNewRegistration = _cache.TryGetValue(registrationKey, out PendingRegistration? pendingRegistration);

            if (isNewRegistration && pendingRegistration != null)
            {
                // Create new verified user
                var user = new User
                {
                    Email = pendingRegistration.Email,
                    FullName = pendingRegistration.FullName,
                    PasswordHash = pendingRegistration.PasswordHash,
                    Role = "User",
                    CreatedAt = DateTime.Now,
                    IsEmailVerified = true
                };

                _context.Users.Add(user);
                await _context.SaveChangesAsync();

                // Create a profile for the user
                var profile = new UserProfile
                {
                    UserId = user.UserId,
                    CreatedAt = DateTime.Now
                };
                _context.UserProfiles.Add(profile);

                _cache.Remove(registrationKey);
            }
            else
            {
                // Update existing user's verification status
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email && !u.IsEmailVerified);
                if (user != null)
                {
                    user.IsEmailVerified = true;

                    // Check if user has a profile, create one if not
                    var hasProfile = await _context.UserProfiles.AnyAsync(p => p.UserId == user.UserId);
                    if (!hasProfile)
                    {
                        var profile = new UserProfile
                        {
                            UserId = user.UserId,
                            CreatedAt = DateTime.Now
                        };
                        _context.UserProfiles.Add(profile);
                    }
                }
            }
        }

        public async Task<bool> TooManyVerificationAttempts(string email)
        {
            var recentAttempts = await _context.VerificationCodes
                .Where(v => v.Email == email && v.CreatedAt > DateTime.Now.AddMinutes(-5))
                .CountAsync();

            return recentAttempts >= 3;
        }

        public async Task<bool> TooManyResetAttempts(string email)
        {
            var recentAttempts = await _context.VerificationCodes
                .Where(v => v.Email == email &&
                       v.CreatedAt > DateTime.Now.AddMinutes(-5) &&
                       v.Type == "reset")
                .CountAsync();

            return recentAttempts >= 3;
        }

        public string GenerateRandomCode()
        {
            return new Random().Next(100000, 999999).ToString();
        }

        public async Task SendVerificationEmail(string email, string fullName, string code)
        {
            string subject = "Xác minh email của bạn - Web Báo Điện Tử";
            string body = $@"
                <html>
                <body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
                    <div style='max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;'>
                        <h2 style='color: #0d6efd;'>Xác minh Email của bạn</h2>
                        <p>Xin chào <strong>{fullName}</strong>,</p>
                        <p>Cảm ơn bạn đã đăng ký tài khoản tại <strong>Web Báo Điện Tử</strong>. Để hoàn tất quá trình đăng ký, vui lòng nhập mã xác nhận dưới đây:</p>
                        <div style='background-color: #f7f7f7; padding: 15px; text-align: center; border-radius: 4px; margin: 20px 0;'>
                            <h1 style='font-family: monospace; letter-spacing: 5px; font-size: 32px; margin: 0; color: #333;'>{code}</h1>
                        </div>
                        <p>Mã xác nhận này sẽ hết hạn sau 30 phút.</p>
                        <p>Nếu bạn không yêu cầu tạo tài khoản này, vui lòng bỏ qua email này.</p>
                        <hr style='border-top: 1px solid #ddd; margin: 20px 0;'>
                        <p style='font-size: 12px; color: #777;'>© {DateTime.Now.Year} Web Báo Điện Tử. Tất cả các quyền được bảo lưu.</p>
                    </div>
                </body>
                </html>
            ";

            await _emailService.SendEmailAsync(email, subject, body);
        }

        public async Task SendPasswordResetEmail(string email, string fullName, string code)
        {
            string subject = "Khôi phục mật khẩu - Web Báo Điện Tử";
            string body = $@"
        <html>
        <body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
            <div style='max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;'>
                <h2 style='color: #0d6efd;'>Khôi phục mật khẩu của bạn</h2>
                <p>Xin chào <strong>{fullName}</strong>,</p>
                <p>Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn tại <strong>Web Báo Điện Tử</strong>. Vui lòng nhập mã xác nhận dưới đây để tiếp tục:</p>
                <div style='background-color: #f7f7f7; padding: 15px; text-align: center; border-radius: 4px; margin: 20px 0;'>
                    <h1 style='font-family: monospace; letter-spacing: 5px; font-size: 32px; margin: 0; color: #333;'>{code}</h1>
                </div>
                <p>Mã xác nhận này sẽ hết hạn sau 30 phút.</p>
                <p>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này hoặc liên hệ bộ phận hỗ trợ.</p>
                <hr style='border-top: 1px solid #ddd; margin: 20px 0;'>
                <p style='font-size: 12px; color: #777;'>© {DateTime.Now.Year} Web Báo Điện Tử. Tất cả các quyền được bảo lưu.</p>
            </div>
        </body>
        </html>
    ";

            await _emailService.SendEmailAsync(email, subject, body);
        }

        public IActionResult? ValidatePasswordChange(User user, ChangePasswordModel model)
        {
            // Verify current password
            if (!VerifyPasswordHash(model.CurrentPassword, user.PasswordHash))
            {
                return new BadRequestObjectResult(new { success = false, message = "Mật khẩu hiện tại không đúng." });
            }

            // Check if new password is the same as current password
            if (HashPassword(model.NewPassword) == user.PasswordHash)
            {
                return new BadRequestObjectResult(new { success = false, message = "Mật khẩu mới không được trùng với mật khẩu hiện tại." });
            }

            // Confirm passwords match
            if (model.NewPassword != model.ConfirmPassword)
            {
                return new BadRequestObjectResult(new { success = false, message = "Xác nhận mật khẩu không khớp." });
            }

            return null;
        }

        public string GetFirstName(string fullName)
        {
            if (string.IsNullOrEmpty(fullName))
                return string.Empty;

            var parts = fullName.Trim().Split(' ');
            return parts.Length > 0 ? parts[parts.Length - 1] : fullName;
        }

        public string HashPassword(string password)
        {
            return Convert.ToBase64String(
                System.Security.Cryptography.SHA256.Create()
                .ComputeHash(System.Text.Encoding.UTF8.GetBytes(password)));
        }

        public bool VerifyPasswordHash(string password, string storedHash)
        {
            var hash = HashPassword(password);
            return hash == storedHash;
        }

        public async Task SignInUserAsync(HttpContext httpContext, User user, bool isPersistent)
        {
            string displayName = GetFirstName(user.FullName) ?? user.Email.Split('@')[0];

            // Generate session token
            string sessionToken = Guid.NewGuid().ToString("N");

            // Create a new user session in the database
            var userSession = new UserSession
            {
                UserId = user.UserId,
                Token = sessionToken,
                DeviceInfo = httpContext.Request.Headers["User-Agent"].ToString(),
                IpAddress = httpContext.Connection.RemoteIpAddress?.ToString(),
                IsActive = true,
                LastActivity = DateTime.Now,
                ExpiresAt = isPersistent ? DateTime.Now.AddDays(30) : DateTime.Now.AddHours(12),
                CreatedAt = DateTime.Now
            };

            _context.UserSessions.Add(userSession);

            // Optional: Deactivate other sessions for this user
            var otherSessions = await _context.UserSessions
                .Where(s => s.UserId == user.UserId && s.IsActive && s.SessionId != userSession.SessionId)
                .ToListAsync();

            foreach (var session in otherSessions)
            {
                session.IsActive = false;
            }

            await _context.SaveChangesAsync();

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
                new Claim(ClaimTypes.Name, user.Email),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role),
                new Claim("FullName", user.FullName ?? user.Email.Split('@')[0]),
                new Claim("DisplayName", displayName),
                new Claim("SessionToken", sessionToken),
                new Claim("SessionId", userSession.SessionId.ToString())
            };

            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            var principal = new ClaimsPrincipal(identity);

            await httpContext.SignInAsync(
                CookieAuthenticationDefaults.AuthenticationScheme,
                principal,
                new AuthenticationProperties
                {
                    IsPersistent = isPersistent,
                    ExpiresUtc = isPersistent ? DateTime.UtcNow.AddDays(30) : DateTime.UtcNow.AddHours(12)
                });
        }

        public Task StoreUserSession(string email, string sessionId, bool isPersistent)
        {
            string userSessionKey = $"{USER_SESSION_PREFIX}{email}";
            var cacheOptions = new MemoryCacheEntryOptions()
                .SetAbsoluteExpiration(isPersistent
                    ? TimeSpan.FromDays(30)
                    : TimeSpan.FromHours(12));

            _cache.Set(userSessionKey, sessionId, cacheOptions);

            return Task.CompletedTask;
        }
    }
}
