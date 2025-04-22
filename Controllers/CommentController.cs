using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using WebBaoDienTu.Models;
using WebBaoDienTu.ViewModels;

namespace WebBaoDienTu.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CommentController : ControllerBase
    {
        private readonly BaoDienTuContext _context;
        private readonly ILogger<CommentController> _logger;

        public CommentController(BaoDienTuContext context, ILogger<CommentController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // GET: api/Comment/news/{newsId}
        [HttpGet("news/{newsId}")]
        public async Task<IActionResult> GetNewComments(int newsId)
        {
            try
            {
                var comments = await _context.Comments
                    .Where(c => c.NewsId == newsId && c.ParentCommentId == null && !c.IsDeleted)
                    .Include(c => c.User)
                        .ThenInclude(u => u!.Profile)
                    .Include(c => c.Replies.Where(r => !r.IsDeleted))
                        .ThenInclude(r => r.User)
                            .ThenInclude(u => u!.Profile)
                    .OrderByDescending(c => c.CreatedAt)
                    .ToListAsync();

                var result = comments.Select(c => new
                {
                    c.CommentId,
                    c.Content,
                    Author = c.UserId.HasValue && c.User != null ? c.User.FullName : c.GuestName,
                    IsAuthenticated = c.UserId.HasValue,
                    c.CreatedAt,
                    c.IsHidden,
                    UserId = c.UserId,
                    AvatarUrl = c.UserId.HasValue && c.User != null ? c.User.Profile?.AvatarUrl : null,
                    Replies = c.Replies.Select(r => new
                    {
                        r.CommentId,
                        r.Content,
                        Author = r.UserId.HasValue && r.User != null ? r.User.FullName : r.GuestName,
                        IsAuthenticated = r.UserId.HasValue,
                        r.CreatedAt,
                        r.IsHidden,
                        UserId = r.UserId,
                        AvatarUrl = r.UserId.HasValue && r.User != null ? r.User.Profile?.AvatarUrl : null
                    }).OrderBy(r => r.CreatedAt).ToList()
                }).ToList();


                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving comments for news ID: {NewsId}", newsId);
                return StatusCode(500, new { message = "Error retrieving comments" });
            }
        }

        // POST: api/Comment
        [HttpPost]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Post([FromBody] CommentViewModel model)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ModelState);

                var comment = new Comment
                {
                    Content = model.Content ?? "",
                    NewsId = model.NewsId,
                    ParentCommentId = model.ParentCommentId,
                    CreatedAt = DateTime.Now,
                    News = await _context.News.FindAsync(model.NewsId) ?? throw new InvalidOperationException("News not found")
                };


                if (User.Identity != null && User.Identity.IsAuthenticated)
                {
                    var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
                    if (int.TryParse(userIdClaim, out int userId))
                    {
                        comment.UserId = userId;
                    }
                }
                else
                {
                    if (string.IsNullOrEmpty(model.GuestName) || string.IsNullOrEmpty(model.GuestEmail))
                        return BadRequest(new { success = false, message = "Tên và email là bắt buộc cho bình luận của khách." });

                    comment.GuestName = model.GuestName;
                    comment.GuestEmail = model.GuestEmail;
                }

                _context.Comments.Add(comment);
                await _context.SaveChangesAsync();

                string? avatarUrl = null;
                if (User.Identity != null && User.Identity.IsAuthenticated && comment.UserId.HasValue)
                {
                    var user = await _context.Users
                        .Include(u => u.Profile)
                        .FirstOrDefaultAsync(u => u.UserId == comment.UserId);

                    avatarUrl = user?.Profile?.AvatarUrl;
                }

                // Return data for new comment to display
                var commentData = new
                {
                    comment.CommentId,
                    comment.Content,
                    // Fix for both line 128 and 213
                    Author = User.Identity != null && User.Identity.IsAuthenticated
                    ? User.FindFirstValue("FullName") ?? (User.Identity?.Name ?? "Unknown User")
                    : (model.GuestName ?? "Anonymous"),

                    IsAuthenticated = User.Identity != null && User.Identity.IsAuthenticated,
                    comment.CreatedAt,
                    IsReply = comment.ParentCommentId.HasValue,
                    ParentId = comment.ParentCommentId,
                    UserId = comment.UserId,
                    IsHidden = comment.IsHidden,
                    AvatarUrl = avatarUrl
                };

                return Ok(new { success = true, comment = commentData });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding comment");
                return StatusCode(500, new { success = false, message = "Có lỗi xảy ra khi thêm bình luận." });
            }
        }

        // REMOVE or RENAME THIS METHOD since it conflicts with GetNewComments
        // [HttpGet("news/{newsId}")]
        // public async Task<IActionResult> GetComments(int newsId)
        // {
        //     ...
        // }

        [HttpPost("add")]
        public async Task<IActionResult> AddComment([FromBody] CommentViewModel model)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                // Validate news exists
                var newsExists = await _context.News.AnyAsync(n => n.NewsId == model.NewsId);
                if (!newsExists)
                    return NotFound(new { success = false, message = "Bài viết không tồn tại." });

                // If there's a parent comment ID, verify it exists
                if (model.ParentCommentId.HasValue)
                {
                    var parentExists = await _context.Comments.AnyAsync(c => c.CommentId == model.ParentCommentId);
                    if (!parentExists)
                        return NotFound(new { success = false, message = "Bình luận gốc không tồn tại." });
                }

                var news = await _context.News.FindAsync(model.NewsId);
                if (news == null)
                    return NotFound(new { success = false, message = "Bài viết không tồn tại." });

                var comment = new Comment
                {
                    Content = model.Content ?? "",
                    NewsId = model.NewsId,
                    ParentCommentId = model.ParentCommentId,
                    CreatedAt = DateTime.Now,
                    News = news, // Set the required 'News' property here
                    IsDeleted = false,
                    IsHidden = false
                };



                if (User.Identity != null && User.Identity.IsAuthenticated)
                {
                    var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
                    if (int.TryParse(userIdClaim, out int userId))
                    {
                        comment.UserId = userId;
                    }
                }

                else
                {
                    // For guest comments
                    if (string.IsNullOrEmpty(model.GuestName) || string.IsNullOrEmpty(model.GuestEmail))
                        return BadRequest(new { success = false, message = "Tên và email là bắt buộc cho bình luận của khách." });

                    comment.GuestName = model.GuestName;
                    comment.GuestEmail = model.GuestEmail;
                }

                _context.Comments.Add(comment);
                await _context.SaveChangesAsync();

                // Return data for new comment to display
                var commentData = new
                {
                    comment.CommentId,
                    comment.Content,
                    Author = User.Identity != null && User.Identity.IsAuthenticated
                    ? User.FindFirstValue("FullName") ?? (User.Identity?.Name ?? "Unknown User")
                    : (model.GuestName ?? "Anonymous"),

                    IsAuthenticated = User.Identity != null && User.Identity.IsAuthenticated,

                    comment.CreatedAt,
                    IsReply = comment.ParentCommentId.HasValue,
                    ParentId = comment.ParentCommentId,
                    UserId = comment.UserId,
                    IsHidden = comment.IsHidden
                };

                return Ok(new { success = true, comment = commentData });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding comment");
                return StatusCode(500, new { success = false, message = "Có lỗi xảy ra khi thêm bình luận." });
            }
        }

        [HttpPut("{id}")]
        [Authorize]
        public async Task<IActionResult> UpdateComment(int id, [FromBody] UpdateCommentViewModel model)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                var comment = await _context.Comments.FindAsync(id);
                if (comment == null)
                    return NotFound(new { success = false, message = "Không tìm thấy bình luận." });

                // Check if user owns the comment
                var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
                if (!int.TryParse(userIdClaim, out int userId) || comment.UserId != userId)
                    return Forbid();

                comment.Content = model.Content ?? "";
                comment.UpdatedAt = DateTime.Now;

                _context.Comments.Update(comment);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Bình luận đã được cập nhật." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating comment {CommentId}", id);
                return StatusCode(500, new { success = false, message = "Có lỗi xảy ra khi cập nhật bình luận." });
            }
        }

        [HttpPost("hide/{id}")]
        [Authorize]
        public async Task<IActionResult> HideComment(int id)
        {
            try
            {
                var comment = await _context.Comments
                    .Include(c => c.News)
                    .ThenInclude(n => n.Author)
                    .FirstOrDefaultAsync(c => c.CommentId == id);

                if (comment == null)
                    return NotFound(new { success = false, message = "Không tìm thấy bình luận." });

                var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var isAdmin = User.IsInRole("Admin");

                // Only admin or the author of the news can hide comments
                bool isNewsAuthor = false;
                if (int.TryParse(userIdClaim, out int userId))
                {
                    isNewsAuthor = comment.News.AuthorId == userId;
                }

                if (!isAdmin && !isNewsAuthor)
                    return Forbid();

                comment.IsHidden = true;
                _context.Comments.Update(comment);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Bình luận đã được ẩn." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error hiding comment {CommentId}", id);
                return StatusCode(500, new { success = false, message = "Có lỗi xảy ra khi ẩn bình luận." });
            }
        }

        [HttpPost("unhide/{id}")]
        [Authorize]
        public async Task<IActionResult> UnhideComment(int id)
        {
            try
            {
                var comment = await _context.Comments
                    .Include(c => c.News)
                    .ThenInclude(n => n.Author)
                    .FirstOrDefaultAsync(c => c.CommentId == id);

                if (comment == null)
                    return NotFound(new { success = false, message = "Không tìm thấy bình luận." });

                var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var isAdmin = User.IsInRole("Admin");

                // Only admin or the author of the news can unhide comments
                bool isNewsAuthor = false;
                if (int.TryParse(userIdClaim, out int userId))
                {
                    isNewsAuthor = comment.News.AuthorId == userId;
                }

                if (!isAdmin && !isNewsAuthor)
                    return Forbid();

                comment.IsHidden = false;
                _context.Comments.Update(comment);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Bình luận đã được hiện." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error unhiding comment {CommentId}", id);
                return StatusCode(500, new { success = false, message = "Có lỗi xảy ra khi hiện bình luận." });
            }
        }

        [HttpDelete("{id}")]
        [Authorize]
        public async Task<IActionResult> DeleteComment(int id)
        {
            try
            {
                var comment = await _context.Comments.FindAsync(id);
                if (comment == null)
                    return NotFound(new { success = false, message = "Không tìm thấy bình luận." });

                // Check if user is admin or owns the comment
                var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
                var isAdmin = User.IsInRole("Admin");

                if (!isAdmin && (!int.TryParse(userIdClaim, out int userId) || comment.UserId != userId))
                    return Forbid();

                // Soft delete
                comment.IsDeleted = true;
                _context.Comments.Update(comment);
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = "Bình luận đã được xóa." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting comment {CommentId}", id);
                return StatusCode(500, new { success = false, message = "Có lỗi xảy ra khi xóa bình luận." });
            }
        }
    }
}
