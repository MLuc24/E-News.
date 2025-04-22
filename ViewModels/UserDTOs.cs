// ViewModels/UserDTOs.cs
using System;

namespace WebBaoDienTu.ViewModels
{
    public class UserSessionDto
    {
        public int SessionId { get; set; }
        public int UserId { get; set; }
        public string? Token { get; set; }
        public string? DeviceInfo { get; set; }
        public string? IpAddress { get; set; }
        public bool IsActive { get; set; }
        public DateTime LastActivity { get; set; }
        public DateTime ExpiresAt { get; set; }
        public DateTime CreatedAt { get; set; }
        // No User navigation property
    }

    public class UserDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string Role { get; set; } = null!;
        public bool IsEmailVerified { get; set; }
        public bool IsDeleted { get; set; }
        public DateTime CreatedAt { get; set; }
        // Include other properties but exclude navigation properties or use DTOs for them
    }

    public class UserActivityDto
    {
        public UserDto? User { get; set; }
        public IEnumerable<NewsDto>? News { get; set; }
        public IEnumerable<CommentDto>? Comments { get; set; }
        public IEnumerable<UserSessionDto>? Sessions { get; set; }
    }

    public class NewsDto
    {
        public int NewsId { get; set; }
        public string Title { get; set; } = null!;
        public string? CategoryName { get; set; }
        public int ReadCount { get; set; }
        public bool IsApproved { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class CommentDto
    {
        public int CommentId { get; set; }
        public string Content { get; set; } = null!;
        public int NewsId { get; set; }
        public string? NewsTitle { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool IsDeleted { get; set; }
        public bool IsHidden { get; set; }
    }
}
