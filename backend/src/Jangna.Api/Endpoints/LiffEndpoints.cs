using Jangna.Api.Line;
using Jangna.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jangna.Api.Endpoints;

/// <summary>Endpoint ที่หน้า LIFF ของพนักงานเรียก (ยังไม่มี JWT → ยืนยันตัวด้วย LINE ID token)</summary>
public static class LiffEndpoints
{
    public sealed record InvitePreview(string ShopName, string EmployeeName, DateTimeOffset ExpiresAt);

    public sealed record JoinRequest(string Code, string IdToken);

    public sealed record JoinResponse(string ShopName, string EmployeeName);

    public static RouteGroupBuilder MapLiffEndpoints(this RouteGroupBuilder api)
    {
        var liff = api.MapGroup("/liff").AllowAnonymous();

        // request พวกนี้ไม่มี tenant ใน context จึงต้อง IgnoreQueryFilters แล้วหาเองจาก invite code
        liff.MapGet("/invites/{code}", async (string code, JangnaDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            var invite = await db.EmployeeInvites.IgnoreQueryFilters()
                .Include(i => i.Employee)
                .SingleOrDefaultAsync(i => i.Code == code.ToUpperInvariant(), ct);
            if (invite is null || !invite.IsUsable(clock.GetUtcNow()))
                return Results.Problem("ลิงก์เชิญไม่ถูกต้องหรือหมดอายุแล้ว", statusCode: StatusCodes.Status404NotFound);

            var shop = await db.Tenants.SingleAsync(t => t.Id == invite.TenantId, ct);
            return Results.Ok(new InvitePreview(shop.Name, invite.Employee!.FirstName, invite.ExpiresAt));
        });

        liff.MapPost("/join", async (JoinRequest req, JangnaDbContext db, ILineIdTokenVerifier verifier,
            TimeProvider clock, CancellationToken ct) =>
        {
            var profile = await verifier.VerifyAsync(req.IdToken, ct);
            if (profile is null)
                return Results.Problem("ยืนยันตัวตน LINE ไม่สำเร็จ", statusCode: StatusCodes.Status401Unauthorized);

            var now = clock.GetUtcNow();
            var invite = await db.EmployeeInvites.IgnoreQueryFilters()
                .Include(i => i.Employee)
                .SingleOrDefaultAsync(i => i.Code == req.Code.ToUpperInvariant(), ct);
            if (invite is null || !invite.IsUsable(now))
                return Results.Problem("ลิงก์เชิญไม่ถูกต้องหรือหมดอายุแล้ว", statusCode: StatusCodes.Status404NotFound);

            var employee = invite.Employee!;
            var takenByOther = await db.Employees.IgnoreQueryFilters()
                .AnyAsync(e => e.TenantId == invite.TenantId && e.LineUserId == profile.UserId && e.Id != employee.Id, ct);
            if (takenByOther)
                return Results.Problem("บัญชี LINE นี้ผูกกับพนักงานคนอื่นในร้านนี้แล้ว", statusCode: StatusCodes.Status409Conflict);

            employee.LineUserId = profile.UserId;
            employee.LineLinkedAt = now;
            invite.UsedAt = now;
            await db.SaveChangesAsync(ct);

            var shop = await db.Tenants.SingleAsync(t => t.Id == invite.TenantId, ct);
            return Results.Ok(new JoinResponse(shop.Name, employee.FirstName));
        });

        return api;
    }
}
