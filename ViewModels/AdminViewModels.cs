// ViewModels/AdminViewModels.cs
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using WebBaoDienTu.Models;

namespace WebBaoDienTu.ViewModels
{
    public class AdminUserCreateViewModel
    {
        [Required(ErrorMessage = "Họ tên không được để trống")]
        [Display(Name = "Họ tên")]
        public string FullName { get; set; } = null!;

        [Required(ErrorMessage = "Email không được để trống")]
        [EmailAddress(ErrorMessage = "Email không hợp lệ")]
        [Display(Name = "Email")]
        public string Email { get; set; } = null!;

        [Required(ErrorMessage = "Mật khẩu không được để trống")]
        [StringLength(20, MinimumLength = 6, ErrorMessage = "Mật khẩu phải có ít nhất 6 ký tự")]
        [Display(Name = "Mật khẩu")]
        [DataType(DataType.Password)]
        public string Password { get; set; } = null!;

        [Required(ErrorMessage = "Vui lòng xác nhận mật khẩu")]
        [Compare("Password", ErrorMessage = "Mật khẩu xác nhận không khớp")]
        [Display(Name = "Xác nhận mật khẩu")]
        [DataType(DataType.Password)]
        public string ConfirmPassword { get; set; } = null!;

        [Required(ErrorMessage = "Vai trò không được để trống")]
        [Display(Name = "Vai trò")]
        public string Role { get; set; } = "User";

        [Display(Name = "Đã xác minh email")]
        public bool IsEmailVerified { get; set; } = false;

        [Display(Name = "Số điện thoại")]
        public string? PhoneNumber { get; set; }

        [Display(Name = "Địa chỉ")]
        public string? Address { get; set; }

        [Display(Name = "Ngày sinh")]
        [DataType(DataType.Date)]
        public DateTime? DateOfBirth { get; set; }

        [Display(Name = "Giới tính")]
        public string? Gender { get; set; }
    }

    public class AdminUserEditViewModel
    {
        public int UserId { get; set; }

        [Required(ErrorMessage = "Họ tên không được để trống")]
        [Display(Name = "Họ tên")]
        public string FullName { get; set; } = null!;

        [Required(ErrorMessage = "Email không được để trống")]
        [EmailAddress(ErrorMessage = "Email không hợp lệ")]
        [Display(Name = "Email")]
        public string Email { get; set; } = null!;

        [Required(ErrorMessage = "Vai trò không được để trống")]
        [Display(Name = "Vai trò")]
        public string Role { get; set; } = null!;

        [Display(Name = "Đã xác minh email")]
        public bool IsEmailVerified { get; set; }

        [Display(Name = "Đã vô hiệu hóa")]
        public bool IsDeleted { get; set; }

        [Display(Name = "Số điện thoại")]
        public string? PhoneNumber { get; set; }

        [Display(Name = "Địa chỉ")]
        public string? Address { get; set; }

        [Display(Name = "Ngày sinh")]
        [DataType(DataType.Date)]
        public DateTime? DateOfBirth { get; set; }

        [Display(Name = "Giới tính")]
        public string? Gender { get; set; }

        [Display(Name = "Tiểu sử")]
        public string? Bio { get; set; }
    }


    // Add these classes to ViewModels/AdminViewModels.cs

    public class EmailVerificationToggleViewModel
    {
        [Required]
        public int UserId { get; set; }

        [Required]
        public bool IsVerified { get; set; }
    }

    public class UserIdViewModel
    {
        [Required]
        public int UserId { get; set; }
    }

    public class SocialLoginViewModel
    {
        [Required]
        public int SocialLoginId { get; set; }
    }

    public class UserActivityViewModel
    {
        public User User { get; set; } = null!;
        public List<News> News { get; set; } = new List<News>();
        public List<Comment> Comments { get; set; } = new List<Comment>();
        public List<UserSession> Sessions { get; set; } = new List<UserSession>();

        // For pagination
        public int CurrentPage { get; set; } = 1;
        public int PageSize { get; set; } = 10;
        public int TotalItems { get; set; }
        public string ActiveTab { get; set; } = "news";
    }

}
