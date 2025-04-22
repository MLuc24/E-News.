using System;
using System.ComponentModel.DataAnnotations;

namespace WebBaoDienTu.Models
{
    public class VerificationCode
    {
        [Key]
        public int Id { get; set; }
        public string Email { get; set; } = null!;
        public string Code { get; set; } = null!;
        public DateTime ExpiresAt { get; set; }
        public bool IsUsed { get; set; } = false;
        public string Type { get; set; } = "email";  // Mặc định là "email", có thể là "reset" hoặc các loại khác

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }

}
