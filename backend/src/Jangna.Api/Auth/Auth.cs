using System.Security.Claims;
using System.Text;
using Jangna.Core.Entities;
using Jangna.Core.Tenancy;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Jangna.Api.Auth;

public sealed class JwtOptions
{
    public const string Section = "Jwt";
    public string Issuer { get; set; } = "jangna";
    public string Audience { get; set; } = "jangna";

    /// <summary>อย่างน้อย 32 ตัวอักษร — production ตั้งผ่าน env `Jwt__SigningKey`</summary>
    public string SigningKey { get; set; } = "";

    public int ExpiryMinutes { get; set; } = 60 * 12;

    public SymmetricSecurityKey Key() => new(Encoding.UTF8.GetBytes(SigningKey));
}

public static class JangnaClaims
{
    public const string TenantId = "tenant_id";
    public const string Role = "role";
}

public static class Policies
{
    public const string Owner = nameof(Owner);
    public const string Manager = nameof(Manager);
}

public sealed class TokenService(JwtOptions options)
{
    public string Issue(User user, Membership membership)
    {
        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = options.Issuer,
            Audience = options.Audience,
            Expires = DateTime.UtcNow.AddMinutes(options.ExpiryMinutes),
            SigningCredentials = new SigningCredentials(options.Key(), SecurityAlgorithms.HmacSha256),
            Subject = new ClaimsIdentity(
            [
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim(JwtRegisteredClaimNames.Name, user.DisplayName),
                new Claim(JangnaClaims.TenantId, membership.TenantId.ToString()),
                new Claim(JangnaClaims.Role, membership.Role.ToString()),
            ]),
        };

        return new JsonWebTokenHandler().CreateToken(descriptor);
    }
}

/// <summary>อ่าน tenant จาก JWT ของ request ปัจจุบัน</summary>
public sealed class HttpTenantContext(IHttpContextAccessor accessor) : ITenantContext
{
    public Guid? TenantId =>
        Guid.TryParse(accessor.HttpContext?.User.FindFirstValue(JangnaClaims.TenantId), out var id) ? id : null;

    public Guid? UserId =>
        Guid.TryParse(accessor.HttpContext?.User.FindFirstValue(JwtRegisteredClaimNames.Sub), out var id) ? id : null;
}

public static class ClaimsPrincipalExtensions
{
    public static Guid UserId(this ClaimsPrincipal user) =>
        Guid.Parse(user.FindFirstValue(JwtRegisteredClaimNames.Sub)
                   ?? user.FindFirstValue(ClaimTypes.NameIdentifier)
                   ?? throw new InvalidOperationException("ไม่มี sub claim"));
}
