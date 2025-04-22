// Controllers/AdminUserController.cs
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading.Tasks;
using WebBaoDienTu.Models;
using WebBaoDienTu.Services;
using WebBaoDienTu.ViewModels;

namespace WebBaoDienTu.Controllers
{
    [Authorize(Roles = "Admin")]
    public class AdminUserController : Controller
    {
        private readonly BaoDienTuContext _context;
        private readonly ILogger<AdminUserController> _logger;
        private readonly AuthService _authService;

        public AdminUserController(
            BaoDienTuContext context,
            ILogger<AdminUserController> logger,
            AuthService authService)
        {
            _context = context;
            _logger = logger;
            _authService = authService;
        }


        // GET: AdminUser/Index - Improved with caching options
        public async Task<IActionResult> Index(string searchTerm, string role, bool? isVerified, bool? isDeleted, int page = 1, int pageSize = 10)
        {
            try
            {
                // Store filter parameters for pagination and form reuse
                ViewBag.SearchTerm = searchTerm;
                ViewBag.Role = role;
                ViewBag.IsVerified = isVerified;
                ViewBag.IsDeleted = isDeleted;

                // Build query with eager loading but limited to needed related data
                IQueryable<User> query = _context.Users
                    .Include(u => u.Profile)
                    .Include(u => u.SocialLogins)
                    .Include(u => u.UserSessions.Where(s => s.IsActive))
                    .AsNoTracking() // Use AsNoTracking for better performance in read-only scenarios
                    .AsQueryable();

                // Apply filters with optimized query conditions
                if (!string.IsNullOrWhiteSpace(searchTerm))
                {
                    searchTerm = searchTerm.Trim().ToLower();
                    query = query.Where(u =>
                        u.FullName.ToLower().Contains(searchTerm) ||
                        u.Email.ToLower().Contains(searchTerm)
                    );
                }

                if (!string.IsNullOrWhiteSpace(role))
                {
                    query = query.Where(u => u.Role == role);
                }

                if (isVerified.HasValue)
                {
                    query = query.Where(u => u.IsEmailVerified == isVerified.Value);
                }

                if (isDeleted.HasValue)
                {
                    query = query.Where(u => u.IsDeleted == isDeleted.Value);
                }

                // Get total count for pagination
                var totalCount = await query.CountAsync();

                // Optimize pagination with ordered query
                var users = await query
                    .OrderByDescending(u => u.CreatedAt)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                // Pagination calculations
                var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

                // ViewBag setup for pagination controls
                ViewBag.CurrentPage = page;
                ViewBag.TotalPages = totalPages;
                ViewBag.PageSize = pageSize;
                ViewBag.TotalUsers = totalCount;

                // Get available roles for filter dropdown
                ViewBag.AvailableRoles = await _context.Users
                    .Select(u => u.Role)
                    .Distinct()
                    .ToListAsync();

                return View("~/Views/Admin/User/Index.cshtml", users);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading admin user management page");
                TempData["ErrorMessage"] = "Có lỗi xảy ra khi tải trang quản lý người dùng.";
                return View("~/Views/Admin/User/Index.cshtml", new List<User>());
            }
        }

        // GET: AdminUser/Details/5 - Improved with better error handling
        public async Task<IActionResult> Details(int? id)
        {
            if (id == null)
            {
                TempData["ErrorMessage"] = "ID người dùng không hợp lệ.";
                return RedirectToAction(nameof(Index));
            }

            try
            {
                // Use AsNoTracking for read-only operations
                var user = await _context.Users
                    .AsNoTracking()
                    .Include(u => u.Profile)
                    .Include(u => u.SocialLogins)
                    .Include(u => u.UserSessions.Where(s => s.IsActive))
                    .Include(u => u.News.OrderByDescending(n => n.CreatedAt).Take(10))
                    .Include(u => u.Comments.OrderByDescending(c => c.CreatedAt).Take(10))
                    .AsSplitQuery() // Use SplitQuery for performance with multiple includes
                    .FirstOrDefaultAsync(u => u.UserId == id);

                if (user == null)
                {
                    TempData["ErrorMessage"] = "Không tìm thấy người dùng.";
                    return RedirectToAction(nameof(Index));
                }

                return View("~/Views/Admin/User/Details.cshtml", user);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving user details for ID: {UserId}", id);
                TempData["ErrorMessage"] = "Có lỗi xảy ra khi tải thông tin người dùng.";
                return RedirectToAction(nameof(Index));
            }
        }

        // GET: AdminUser/GetAvailableRoles - API to get available roles
        [HttpGet]
        public IActionResult GetAvailableRoles()
        {
            // Return available roles (only Admin and User)
            var roles = new[] { "Admin", "User" };
            return Json(roles);
        }

        // POST: AdminUser/CreateUser - API endpoint for creating users
        [HttpPost]
        public async Task<IActionResult> CreateUser([FromBody] AdminUserCreateViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new { success = false, errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage) });
            }

            try
            {
                // Check if user already exists
                if (await _context.Users.AnyAsync(u => u.Email == model.Email))
                {
                    return BadRequest(new { success = false, message = "Email này đã được sử dụng." });
                }

                // Create new user
                var user = new User
                {
                    FullName = model.FullName,
                    Email = model.Email,
                    PasswordHash = _authService.HashPassword(model.Password),
                    Role = model.Role,
                    IsEmailVerified = model.IsEmailVerified,
                    CreatedAt = DateTime.Now
                };

                _context.Users.Add(user);
                await _context.SaveChangesAsync();

                // Create user profile
                var profile = new UserProfile
                {
                    UserId = user.UserId,
                    PhoneNumber = model.PhoneNumber,
                    Address = model.Address,
                    DateOfBirth = model.DateOfBirth,
                    Gender = model.Gender,
                    CreatedAt = DateTime.Now
                };

                _context.UserProfiles.Add(profile);
                await _context.SaveChangesAsync();

                // Return user information including the ID for the frontend
                return Json(new
                {
                    success = true,
                    message = "Người dùng đã được tạo thành công.",
                    user = new
                    {
                        user.UserId,
                        user.FullName,
                        user.Email,
                        user.Role,
                        user.IsEmailVerified,
                        user.CreatedAt,
                        Profile = new
                        {
                            model.PhoneNumber,
                            model.Gender,
                            DateOfBirth = model.DateOfBirth?.ToString("yyyy-MM-dd")
                        }
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating user");
                return StatusCode(500, new { success = false, message = "Có lỗi xảy ra khi tạo người dùng." });
            }
        }

        // Controllers/AdminUserController.cs - phần GetUserDetails
        [HttpGet]
        public async Task<IActionResult> GetUserDetails(int id)
        {
            try
            {
                var user = await _context.Users
                    .Include(u => u.Profile)
                    .FirstOrDefaultAsync(u => u.UserId == id);

                if (user == null)
                {
                    return NotFound(new { success = false, message = "Không tìm thấy người dùng." });
                }

                var model = new AdminUserEditViewModel
                {
                    UserId = user.UserId,
                    FullName = user.FullName,
                    Email = user.Email,
                    Role = user.Role,
                    IsEmailVerified = user.IsEmailVerified,
                    IsDeleted = user.IsDeleted,
                    PhoneNumber = user.Profile?.PhoneNumber,
                    Address = user.Profile?.Address,
                    DateOfBirth = user.Profile?.DateOfBirth,
                    Gender = user.Profile?.Gender,
                    Bio = user.Profile?.Bio
                };

                // Thêm log để debug
                _logger.LogInformation("Returning user details for ID: {UserId}, Name: {FullName}", user.UserId, user.FullName);

                return Json(model);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving user details for ID: {UserId}", id);
                return StatusCode(500, new { success = false, message = "Có lỗi xảy ra khi tải thông tin người dùng." });
            }
        }


        // POST: AdminUser/UpdateUser - API endpoint for updating users
        [HttpPost]
        public async Task<IActionResult> UpdateUser([FromBody] AdminUserEditViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(new
                {
                    success = false,
                    errors = ModelState.Values
                        .SelectMany(v => v.Errors)
                        .Select(e => e.ErrorMessage)
                });
            }

            try
            {
                var user = await _context.Users
                    .Include(u => u.Profile)
                    .FirstOrDefaultAsync(u => u.UserId == model.UserId);

                if (user == null)
                {
                    return NotFound(new { success = false, message = "Không tìm thấy người dùng." });
                }

                // Update user
                user.FullName = model.FullName;
                user.Email = model.Email;
                user.Role = model.Role;
                user.IsEmailVerified = model.IsEmailVerified;
                user.IsDeleted = model.IsDeleted;

                // Update or create profile
                if (user.Profile == null)
                {
                    user.Profile = new UserProfile
                    {
                        UserId = user.UserId,
                        CreatedAt = DateTime.Now
                    };
                    _context.UserProfiles.Add(user.Profile);
                }

                user.Profile.PhoneNumber = model.PhoneNumber;
                user.Profile.Address = model.Address;
                user.Profile.DateOfBirth = model.DateOfBirth;
                user.Profile.Gender = model.Gender;
                user.Profile.Bio = model.Bio;
                user.Profile.UpdatedAt = DateTime.Now;

                _context.Update(user);
                await _context.SaveChangesAsync();

                return Json(new
                {
                    success = true,
                    message = "Người dùng đã được cập nhật thành công.",
                    user = new
                    {
                        user.UserId,
                        user.FullName,
                        user.Email,
                        user.Role,
                        user.IsEmailVerified,
                        user.IsDeleted,
                        Profile = new
                        {
                            model.PhoneNumber,
                            model.Gender,
                            model.Address,
                            model.Bio,
                            DateOfBirth = model.DateOfBirth?.ToString("yyyy-MM-dd")
                        }
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user: {UserId}", model.UserId);
                return StatusCode(500, new { success = false, message = "Có lỗi xảy ra khi cập nhật người dùng." });
            }
        }

        // POST: AdminUser/ToggleStatus/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ToggleStatus(int id)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return NotFound();
            }

            try
            {
                user.IsDeleted = !user.IsDeleted;
                _context.Update(user);

                // If disabling account, log out all active sessions
                if (user.IsDeleted)
                {
                    var activeSessions = await _context.UserSessions
                        .Where(s => s.UserId == id && s.IsActive)
                        .ToListAsync();

                    foreach (var session in activeSessions)
                    {
                        session.IsActive = false;
                    }
                }

                await _context.SaveChangesAsync();
                return RedirectToAction(nameof(Index));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error toggling user status: {UserId}", id);
                TempData["ErrorMessage"] = "Có lỗi xảy ra khi thay đổi trạng thái người dùng.";
                return RedirectToAction(nameof(Index));
            }
        }
        [HttpGet("GetUserActivity/{id}")]
        public async Task<IActionResult> GetUserActivity(int id)
        {
            try
            {
                var user = await _context.Users.FirstOrDefaultAsync(u => u.UserId == id);
                if (user == null)
                {
                    return NotFound(new { success = false, message = "Không tìm thấy người dùng." });
                }

                // Get recent news (up to 50)
                var news = await _context.News
                    .Where(n => n.AuthorId == id)
                    .OrderByDescending(n => n.CreatedAt)
                    .Take(50)
                    .Select(n => new NewsDto
                    {
                        NewsId = n.NewsId,
                        Title = n.Title,
                        CategoryName = n.Category.CategoryName,
                        ReadCount = n.ReadCount,
                        IsApproved = n.IsApproved,
                        CreatedAt = n.CreatedAt
                    })
                    .ToListAsync();

                // Get recent comments (up to 50)
                var comments = await _context.Comments
                    .Where(c => c.UserId == id)
                    .OrderByDescending(c => c.CreatedAt)
                    .Take(50)
                    .Select(c => new CommentDto
                    {
                        CommentId = c.CommentId,
                        Content = c.Content,
                        NewsId = c.NewsId,
                        NewsTitle = c.News.Title,
                        CreatedAt = c.CreatedAt,
                        IsDeleted = c.IsDeleted,
                        IsHidden = c.IsHidden
                    })
                    .ToListAsync();

                // Get user sessions (up to 50)
                var sessions = await _context.UserSessions
                    .Where(s => s.UserId == id)
                    .OrderByDescending(s => s.IsActive)
                    .ThenByDescending(s => s.LastActivity)
                    .Take(50)
                    .Select(s => new UserSessionDto
                    {
                        SessionId = s.SessionId,
                        UserId = s.UserId,
                        DeviceInfo = s.DeviceInfo,
                        IpAddress = s.IpAddress,
                        IsActive = s.IsActive,
                        LastActivity = s.LastActivity,
                        ExpiresAt = s.ExpiresAt,
                        CreatedAt = s.CreatedAt
                    })
                    .ToListAsync();

                // Use DTOs to avoid circular references
                return Json(new
                {
                    success = true,
                    user = new UserDto
                    {
                        UserId = user.UserId,
                        FullName = user.FullName,
                        Email = user.Email,
                        Role = user.Role,
                        IsEmailVerified = user.IsEmailVerified,
                        IsDeleted = user.IsDeleted,
                        CreatedAt = user.CreatedAt
                    },
                    news,
                    comments,
                    sessions
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting user activity: {UserId}", id);
                return StatusCode(500, new { success = false, message = "Có lỗi xảy ra khi tải hoạt động của người dùng." });
            }
        }


        [HttpPost]
        public async Task<IActionResult> ToggleEmailVerification([FromBody] EmailVerificationToggleViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return Json(new { success = false, message = "Dữ liệu không hợp lệ." });
            }

            try
            {
                var user = await _context.Users.FindAsync(model.UserId);
                if (user == null)
                {
                    return Json(new { success = false, message = "Không tìm thấy người dùng." });
                }

                // Update user email verification status
                user.IsEmailVerified = model.IsVerified;
                _context.Update(user);
                await _context.SaveChangesAsync();

                return Json(new
                {
                    success = true,
                    message = model.IsVerified
                        ? "Email đã được đánh dấu là xác minh thành công."
                        : "Đã hủy xác minh email của người dùng."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error toggling email verification for user: {UserId}", model.UserId);
                return Json(new { success = false, message = "Có lỗi xảy ra khi thay đổi trạng thái xác minh email." });
            }
        }

        [HttpPost]
        public async Task<IActionResult> TerminateAllSessions([FromBody] UserIdViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return Json(new { success = false, message = "Dữ liệu không hợp lệ." });
            }

            try
            {
                var activeSessions = await _context.UserSessions
                    .Where(s => s.UserId == model.UserId && s.IsActive)
                    .ToListAsync();

                if (!activeSessions.Any())
                {
                    return Json(new { success = false, message = "Không có phiên đăng nhập nào đang hoạt động." });
                }

                foreach (var session in activeSessions)
                {
                    session.IsActive = false;
                }

                await _context.SaveChangesAsync();

                return Json(new
                {
                    success = true,
                    message = $"Đã đăng xuất tất cả {activeSessions.Count} phiên đăng nhập của người dùng."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error terminating all sessions for user: {UserId}", model.UserId);
                return Json(new { success = false, message = "Có lỗi xảy ra khi đăng xuất các phiên đăng nhập." });
            }
        }

        [HttpPost]
        public async Task<IActionResult> UnlinkSocialLogin([FromBody] SocialLoginViewModel model)
        {
            if (!ModelState.IsValid)
            {
                return Json(new { success = false, message = "Dữ liệu không hợp lệ." });
            }

            try
            {
                var socialLogin = await _context.SocialLogins.FindAsync(model.SocialLoginId);
                if (socialLogin == null)
                {
                    return Json(new { success = false, message = "Không tìm thấy tài khoản xã hội." });
                }

                // Store user info for the response
                int userId = socialLogin.UserId;
                string provider = socialLogin.Provider;

                _context.SocialLogins.Remove(socialLogin);
                await _context.SaveChangesAsync();

                return Json(new
                {
                    success = true,
                    message = $"Đã hủy liên kết tài khoản {provider} thành công."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error unlinking social login: {SocialLoginId}", model.SocialLoginId);
                return Json(new { success = false, message = "Có lỗi xảy ra khi hủy liên kết tài khoản xã hội." });
            }
        }

        // POST: AdminUser/ResetPassword/5
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> ResetPassword(int id, string newPassword)
        {
            var user = await _context.Users.FindAsync(id);
            if (user == null)
            {
                return NotFound();
            }

            if (string.IsNullOrEmpty(newPassword) || newPassword.Length < 6)
            {
                TempData["ErrorMessage"] = "Mật khẩu mới phải có ít nhất 6 ký tự.";
                return RedirectToAction(nameof(Details), new { id });
            }

            try
            {
                user.PasswordHash = _authService.HashPassword(newPassword);
                _context.Update(user);
                await _context.SaveChangesAsync();

                TempData["SuccessMessage"] = "Mật khẩu đã được đặt lại thành công.";
                return RedirectToAction(nameof(Details), new { id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resetting password for user: {UserId}", id);
                TempData["ErrorMessage"] = "Có lỗi xảy ra khi đặt lại mật khẩu.";
                return RedirectToAction(nameof(Details), new { id });
            }
        }

        // POST: AdminUser/TerminateSession
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> TerminateSession(int sessionId, int userId)
        {
            var session = await _context.UserSessions.FindAsync(sessionId);
            if (session == null)
            {
                return NotFound();
            }

            try
            {
                session.IsActive = false;
                _context.Update(session);
                await _context.SaveChangesAsync();

                TempData["SuccessMessage"] = "Phiên đăng nhập đã được kết thúc thành công.";
                return RedirectToAction(nameof(Details), new { id = userId });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error terminating session: {SessionId} for user: {UserId}", sessionId, userId);
                TempData["ErrorMessage"] = "Có lỗi xảy ra khi kết thúc phiên đăng nhập.";
                return RedirectToAction(nameof(Details), new { id = userId });
            }
        }

        // POST: AdminUser/ChangeRole
        [HttpPost]
        public async Task<IActionResult> ChangeRole(int userId, string newRole)
        {
            if (!ModelState.IsValid)
            {
                return Json(new { success = false, message = "Dữ liệu không hợp lệ." });
            }

            try
            {
                var user = await _context.Users.FindAsync(userId);
                if (user == null)
                {
                    return Json(new { success = false, message = "Không tìm thấy người dùng." });
                }

                // Update user role
                user.Role = newRole;
                _context.Update(user);
                await _context.SaveChangesAsync();

                return Json(new
                {
                    success = true,
                    message = "Quyền người dùng đã được cập nhật thành công.",
                    newRole = newRole
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error changing role for user: {UserId}", userId);
                return Json(new { success = false, message = "Có lỗi xảy ra khi cập nhật quyền người dùng." });
            }
        }

        private IActionResult JsonErrorResponse(string message, int statusCode = 400)
        {
            return StatusCode(statusCode, new { success = false, message });
        }

        private IActionResult JsonSuccessResponse(string message, object data = null)
        {
            return Json(new
            {
                success = true,
                message,
                data
            });
        }
    }
}
