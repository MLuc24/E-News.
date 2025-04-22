// Models/News.cs
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;

namespace WebBaoDienTu.Models;

public partial class News
{
    public int NewsId { get; set; }
    public string Title { get; set; } = null!;
    public string Content { get; set; } = null!;
    public string? ImageUrl { get; set; }
    public int AuthorId { get; set; }
    public int CategoryId { get; set; }
    public bool IsApproved { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public int ReadCount { get; set; } = 0; // New property for tracking read count
    public bool IsDeleted { get; set; } = false;
    public bool IsArchived { get; set; } = false;
    public virtual User Author { get; set; } = null!;
    public virtual Category Category { get; set; } = null!;
    public virtual ICollection<NewsSharing> NewsSharings { get; set; } = new List<NewsSharing>(); // Added missing semicolon
    public virtual ICollection<Comment> Comments { get; set; } = new List<Comment>();
    [NotMapped]
    public int ViewCount
    {
        get { return ReadCount; }
        set { ReadCount = value; }
    }

    [NotMapped]
    public DateTime CreatedDate
    {
        get { return CreatedAt; }
        set { CreatedAt = value; }
    }

    [NotMapped]
    public int CommentCount
    {
        get { return Comments?.Count ?? 0; }
    }

}
