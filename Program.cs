using WebBaoDienTu.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.Cookies;
using WebBaoDienTu.Middleware;
using WebBaoDienTu.Services;
using System.Net;
using System.Net.Security;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authentication.Facebook;
using Microsoft.AspNetCore.Authentication;
using System.Security.Authentication;
using System.Security.Cryptography.X509Certificates;
using System.Security.Claims;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);
// Add this at the beginning of Program.cs, before the builder initialization
ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 | SecurityProtocolType.Tls13;
// Add this after builder initialization in Program.cs
builder.Logging.AddFilter("Microsoft.AspNetCore.Authentication", LogLevel.Debug);
builder.Logging.AddFilter("WebBaoDienTu.Controllers.AuthController", LogLevel.Debug);

// Register HttpClient Factory - Add this line
builder.Services.AddHttpClient();

builder.Services.AddSingleton(provider => {
    var smtpServer = builder.Configuration["EmailSettings:SmtpServer"]
        ?? throw new InvalidOperationException("SMTP Server configuration is missing");
    var smtpPortStr = builder.Configuration["EmailSettings:SmtpPort"]
        ?? throw new InvalidOperationException("SMTP Port configuration is missing");
    var senderEmail = builder.Configuration["EmailSettings:SenderEmail"]
        ?? throw new InvalidOperationException("Sender Email configuration is missing");
    var senderPassword = builder.Configuration["EmailSettings:SenderPassword"]
        ?? throw new InvalidOperationException("Sender Password configuration is missing");

    if (!int.TryParse(smtpPortStr, out int smtpPort))
    {
        throw new InvalidOperationException("Invalid SMTP Port configuration");
    }

    return new EmailService(smtpServer, smtpPort, senderEmail, senderPassword);
});

builder.Services.AddDbContext<BaoDienTuContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Make sure NotificationService is properly registered
builder.Services.AddScoped<NotificationService>();
// Program.cs - Thêm vào phần ConfigureServices
builder.Services.AddScoped<EmailValidationService>();
builder.Services.AddScoped<SubscriptionService>();
builder.Services.AddScoped<SubscriptionDiagnosticService>();
// Add this to Program.cs
// Add service registration in Program.cs
builder.Services.AddScoped<AuthService>();

builder.Services.AddHostedService<SessionCleanupService>();

builder.Services.AddRazorPages();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromMinutes(30);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});

builder.Services.AddHttpClient("GoogleAuth", client =>
{
    // Configure client as needed
}).ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
{
    SslOptions = new SslClientAuthenticationOptions
    {
        // Only use secure TLS versions
        EnabledSslProtocols = SslProtocols.Tls12 | SslProtocols.Tls13,
        CertificateRevocationCheckMode = X509RevocationMode.NoCheck,
        RemoteCertificateValidationCallback = (sender, cert, chain, errors) => true // For troubleshooting only
    }
});


// Replace the existing authentication configuration in Program.cs
builder.Services.AddAuthentication(options =>
{
    options.DefaultScheme = CookieAuthenticationDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = CookieAuthenticationDefaults.AuthenticationScheme;
})
.AddCookie(options =>
{
    options.LoginPath = "/Account/Login";
    options.LogoutPath = "/Account/Logout";
    options.AccessDeniedPath = "/Account/AccessDenied";
    options.ExpireTimeSpan = TimeSpan.FromMinutes(30);
    options.SlidingExpiration = true;
    options.Cookie.IsEssential = true;
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;

    // Only use one SameSite setting
    options.Cookie.SameSite = SameSiteMode.None;

    // Add these lines to help with correlation issues
    options.Events = new CookieAuthenticationEvents
    {
        OnRedirectToLogin = context =>
        {
            context.Response.Headers["Location"] = context.RedirectUri;
            context.Response.StatusCode = 302;
            return Task.CompletedTask;
        }
    };
})

.AddGoogle(googleOptions =>
{
    googleOptions.ClientId = builder.Configuration["Authentication:Google:ClientId"] ?? "";
    googleOptions.ClientSecret = builder.Configuration["Authentication:Google:ClientSecret"] ?? "";
    googleOptions.CallbackPath = "/signin-google";

    // Clear default scopes and add required ones in specific order
    googleOptions.Scope.Clear();
    googleOptions.Scope.Add("email");
    googleOptions.Scope.Add("profile");

    // Map claims explicitly without using Clear() which removes needed defaults
    googleOptions.ClaimActions.MapJsonKey("urn:google:picture", "picture", "url");
    googleOptions.ClaimActions.MapJsonKey("urn:google:locale", "locale", "string");

    googleOptions.SaveTokens = true;

    // Set explicit timeout
    googleOptions.BackchannelTimeout = TimeSpan.FromSeconds(30);

    // Use the named HttpClient with custom handler
    googleOptions.Backchannel = new HttpClient(new SocketsHttpHandler
    {
        SslOptions = new SslClientAuthenticationOptions
        {
            EnabledSslProtocols = SslProtocols.Tls12 | SslProtocols.Tls13,
            RemoteCertificateValidationCallback = delegate { return true; } // For development only
        }
    })
    {
        Timeout = TimeSpan.FromSeconds(30)
    };
})

// Replace your existing Facebook authentication configuration
.AddFacebook(options =>
{
    options.AppId = builder.Configuration["Authentication:Facebook:AppId"] ?? "";
    options.AppSecret = builder.Configuration["Authentication:Facebook:AppSecret"] ?? "";
    options.CallbackPath = "/signin-facebook";

    // Add these lines to fix the state validation issue
    options.SaveTokens = true;
    options.CorrelationCookie.SameSite = SameSiteMode.None;
    options.CorrelationCookie.SecurePolicy = CookieSecurePolicy.Always;

    // These scopes are necessary for basic profile info
    options.Scope.Add("email");
    options.Scope.Add("public_profile");

    // Map claims correctly
    options.ClaimActions.MapJsonKey(ClaimTypes.NameIdentifier, "id");
    options.ClaimActions.MapJsonKey(ClaimTypes.Name, "name");
    options.ClaimActions.MapJsonKey(ClaimTypes.Email, "email");
});




builder.Services.AddControllersWithViews()
    .AddJsonOptions(options =>
    {
        // Handle circular references during JSON serialization
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.Preserve;
        options.JsonSerializerOptions.MaxDepth = 64; // Increase the max depth if needed
    });
builder.Services.AddScoped<EmailValidationService>();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseSession();
app.UseRouting();
app.UseAuthentication();
// Thêm middleware kiểm tra phiên
app.UseSessionAuthentication();
app.UseAuthorization();
// Add API endpoint routing before the default route
// Update the existing API route configuration
app.MapControllerRoute(
    name: "api",
    pattern: "api/{controller}/{action}/{id?}");

// Consider adding a more RESTful routing pattern for API controllers
app.MapControllers();

app.MapRazorPages();
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
