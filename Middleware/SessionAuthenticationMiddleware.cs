using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using WebBaoDienTu.Models;
using System;

namespace WebBaoDienTu.Middleware
{
    public class SessionAuthenticationMiddleware
    {
        private readonly RequestDelegate _next;

        public SessionAuthenticationMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context, BaoDienTuContext dbContext)
        {
            if (context.User.Identity?.IsAuthenticated == true)
            {
                // Get user info from claims
                string? userId = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
                string? sessionToken = context.User.FindFirstValue("SessionToken");

                if (!string.IsNullOrEmpty(userId) && !string.IsNullOrEmpty(sessionToken) && int.TryParse(userId, out int userIdInt))
                {
                    // Find the active session in the database
                    var session = await dbContext.UserSessions
                        .FirstOrDefaultAsync(s =>
                            s.UserId == userIdInt &&
                            s.Token == sessionToken &&
                            s.IsActive &&
                            s.ExpiresAt > DateTime.Now);

                    if (session == null)
                    {
                        // Session is invalid, log the user out
                        await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);

                        // If API request, return JSON error
                        if (context.Request.Path.StartsWithSegments("/api"))
                        {
                            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                            await context.Response.WriteAsJsonAsync(new
                            {
                                success = false,
                                message = "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
                                requireLogin = true,
                                reason = "session_expired"
                            });
                            return;
                        }

                        // For non-API requests, redirect
                        if (!context.Response.HasStarted)
                        {
                            context.Response.Redirect($"/?sessionExpired=true");
                            return;
                        }
                    }
                    else
                    {
                        // Update last activity timestamp
                        session.LastActivity = DateTime.Now;
                        await dbContext.SaveChangesAsync();
                    }
                }
            }

            await _next(context);
        }
    }

    // Extension method
    public static class SessionAuthenticationMiddlewareExtensions
    {
        public static IApplicationBuilder UseSessionAuthentication(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<SessionAuthenticationMiddleware>();
        }
    }
}
