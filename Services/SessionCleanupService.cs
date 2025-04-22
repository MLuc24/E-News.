// Services/SessionCleanupService.cs
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using WebBaoDienTu.Models;

namespace WebBaoDienTu.Services
{
    public class SessionCleanupService : BackgroundService
    {
        private readonly IServiceProvider _services;
        private readonly ILogger<SessionCleanupService> _logger;

        public SessionCleanupService(IServiceProvider services, ILogger<SessionCleanupService> logger)
        {
            _services = services;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Session Cleanup Service running.");

            // Run every 30 minutes
            while (!stoppingToken.IsCancellationRequested)
            {
                await CleanupExpiredSessions();
                await Task.Delay(TimeSpan.FromMinutes(30), stoppingToken);
            }
        }

        private async Task CleanupExpiredSessions()
        {
            try
            {
                using (var scope = _services.CreateScope())
                {
                    var dbContext = scope.ServiceProvider.GetRequiredService<BaoDienTuContext>();

                    // Find all expired or inactive sessions older than 7 days
                    var cutoffDate = DateTime.Now.AddDays(-7);
                    var expiredSessions = await dbContext.UserSessions
                        .Where(s => s.ExpiresAt < DateTime.Now ||
                                  (!s.IsActive && s.LastActivity < cutoffDate))
                        .ToListAsync();

                    if (expiredSessions.Any())
                    {
                        dbContext.UserSessions.RemoveRange(expiredSessions);
                        await dbContext.SaveChangesAsync();
                        _logger.LogInformation("Cleaned up {Count} expired sessions", expiredSessions.Count);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cleaning up expired sessions");
            }
        }
    }
}
