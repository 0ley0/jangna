using Jangna.Api.Auth;
using Jangna.Api.Localization;
using Jangna.Core.Entities;
using Jangna.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Jangna.Api.Endpoints;

public static class AuthEndpoints
{
    public sealed record RegisterRequest(string ShopName, string Email, string Password, string DisplayName);

    public sealed record LoginRequest(string Email, string Password, Guid? TenantId);

    public sealed record TenantSummary(Guid Id, string Name, string Role);

    public sealed record AuthResponse(string AccessToken, Guid TenantId, IReadOnlyList<TenantSummary> Tenants);

    public static RouteGroupBuilder MapAuthEndpoints(this RouteGroupBuilder api)
    {
        var auth = api.MapGroup("/auth").AllowAnonymous();

        auth.MapPost("/register", async (RegisterRequest req, JangnaDbContext db, TokenService tokens,
            IPasswordHasher<User> hasher, CancellationToken ct) =>
        {
            var errors = new Dictionary<string, string[]>();
            if (string.IsNullOrWhiteSpace(req.ShopName)) errors["shopName"] = [L.T("กรุณากรอกชื่อร้าน", "Shop name is required")];
            if (string.IsNullOrWhiteSpace(req.DisplayName)) errors["displayName"] = [L.T("กรุณากรอกชื่อ", "Your name is required")];
            if (!req.Email.Contains('@')) errors["email"] = [L.T("อีเมลไม่ถูกต้อง", "Invalid email")];
            if (req.Password.Length < 8) errors["password"] = [L.T("รหัสผ่านอย่างน้อย 8 ตัวอักษร", "Password must be at least 8 characters")];
            if (errors.Count > 0) return Results.ValidationProblem(errors);

            var email = NormalizeEmail(req.Email);
            if (await db.Users.AnyAsync(u => u.Email == email, ct))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["email"] = [L.T("อีเมลนี้ถูกใช้แล้ว", "This email is already registered")] });

            var tenant = new Tenant { Name = req.ShopName.Trim() };
            var user = new User { Email = email, DisplayName = req.DisplayName.Trim() };
            user.PasswordHash = hasher.HashPassword(user, req.Password);
            var membership = new Membership { TenantId = tenant.Id, UserId = user.Id, Role = Role.Owner };

            db.AddRange(tenant, user, membership);
            await db.SaveChangesAsync(ct);

            return Results.Ok(new AuthResponse(
                tokens.Issue(user, membership), tenant.Id,
                [new TenantSummary(tenant.Id, tenant.Name, membership.Role.ToString())]));
        });

        auth.MapPost("/login", async (LoginRequest req, JangnaDbContext db, TokenService tokens,
            IPasswordHasher<User> hasher, CancellationToken ct) =>
        {
            var email = NormalizeEmail(req.Email);
            var user = await db.Users.SingleOrDefaultAsync(u => u.Email == email, ct);
            if (user is null || hasher.VerifyHashedPassword(user, user.PasswordHash, req.Password) == PasswordVerificationResult.Failed)
                return Results.Problem(L.T("อีเมลหรือรหัสผ่านไม่ถูกต้อง", "Incorrect email or password"), statusCode: StatusCodes.Status401Unauthorized);

            // ยังไม่ได้เลือก tenant ตอน login จึงต้องข้าม tenant filter อย่างตั้งใจ
            var memberships = await db.Memberships.IgnoreQueryFilters()
                .Where(m => m.UserId == user.Id)
                .Join(db.Tenants, m => m.TenantId, t => t.Id, (m, t) => new { Membership = m, t.Name })
                .OrderBy(x => x.Membership.CreatedAt)
                .ToListAsync(ct);

            var selected = req.TenantId is { } wanted
                ? memberships.FirstOrDefault(x => x.Membership.TenantId == wanted)
                : memberships.FirstOrDefault();
            if (selected is null)
                return Results.Problem(L.T("ไม่มีสิทธิ์เข้าร้านนี้", "You do not have access to this shop"), statusCode: StatusCodes.Status403Forbidden);

            return Results.Ok(new AuthResponse(
                tokens.Issue(user, selected.Membership), selected.Membership.TenantId,
                memberships.Select(x => new TenantSummary(x.Membership.TenantId, x.Name, x.Membership.Role.ToString())).ToList()));
        });

        return api;
    }

    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();
}
