using System.Security.Cryptography;
using Jangna.Api.Auth;
using Jangna.Api.Line;
using Jangna.Core.Entities;
using Jangna.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jangna.Api.Endpoints;

public static class EmployeeEndpoints
{
    public static readonly TimeSpan InviteLifetime = TimeSpan.FromDays(7);

    public sealed record EmployeeRequest(
        string FirstName, string? LastName, string? Nickname, string? Phone, Guid? BranchId,
        PayType PayType, decimal BaseRate, WorkerType WorkerType, string? Language);

    public sealed record EmployeeDto(
        Guid Id, string FirstName, string LastName, string? Nickname, string? Phone, Guid? BranchId, string? BranchName,
        PayType PayType, decimal BaseRate, WorkerType WorkerType, EmployeeStatus Status, string Language,
        bool LineLinked, DateTimeOffset? LineLinkedAt);

    public sealed record InviteResponse(string Code, string Url, DateTimeOffset ExpiresAt);

    public sealed record StatusRequest(EmployeeStatus Status);

    public static RouteGroupBuilder MapEmployeeEndpoints(this RouteGroupBuilder api)
    {
        var employees = api.MapGroup("/employees").RequireAuthorization(Policies.Manager);

        employees.MapGet("/", async (JangnaDbContext db, CancellationToken ct) =>
            await db.Employees.Include(e => e.Branch)
                .OrderBy(e => e.FirstName)
                .Select(e => ToDto(e))
                .ToListAsync(ct));

        employees.MapGet("/{id:guid}", async (Guid id, JangnaDbContext db, CancellationToken ct) =>
            await db.Employees.Include(e => e.Branch).SingleOrDefaultAsync(e => e.Id == id, ct) is { } e
                ? Results.Ok(ToDto(e))
                : Results.NotFound());

        employees.MapPost("/", async (EmployeeRequest req, JangnaDbContext db, CancellationToken ct) =>
        {
            if (await Validate(req, db, ct) is { } invalid) return invalid;

            var employee = new Employee { FirstName = req.FirstName.Trim() };
            Apply(employee, req);
            db.Employees.Add(employee);
            await db.SaveChangesAsync(ct);
            await db.Entry(employee).Reference(e => e.Branch).LoadAsync(ct);
            return Results.Created($"/api/employees/{employee.Id}", ToDto(employee));
        });

        employees.MapPut("/{id:guid}", async (Guid id, EmployeeRequest req, JangnaDbContext db, CancellationToken ct) =>
        {
            if (await Validate(req, db, ct) is { } invalid) return invalid;

            var employee = await db.Employees.Include(e => e.Branch).SingleOrDefaultAsync(e => e.Id == id, ct);
            if (employee is null) return Results.NotFound();
            Apply(employee, req);
            await db.SaveChangesAsync(ct);
            await db.Entry(employee).Reference(e => e.Branch).LoadAsync(ct);
            return Results.Ok(ToDto(employee));
        });

        employees.MapPost("/{id:guid}/status", async (Guid id, StatusRequest req, JangnaDbContext db, CancellationToken ct) =>
        {
            var employee = await db.Employees.FindAsync([id], ct);
            if (employee is null) return Results.NotFound();
            employee.Status = req.Status;
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        // สร้างลิงก์เชิญใหม่ — ลิงก์เก่าที่ยังไม่ใช้จะถูกยกเลิก
        employees.MapPost("/{id:guid}/invites", async (Guid id, JangnaDbContext db, LineOptions line,
            IConfiguration config, TimeProvider clock, CancellationToken ct) =>
        {
            var employee = await db.Employees.FindAsync([id], ct);
            if (employee is null) return Results.NotFound();

            var now = clock.GetUtcNow();
            var pending = await db.EmployeeInvites
                .Where(i => i.EmployeeId == id && i.UsedAt == null && i.ExpiresAt > now)
                .ToListAsync(ct);
            pending.ForEach(i => i.ExpiresAt = now);

            var invite = new EmployeeInvite { EmployeeId = id, Code = NewInviteCode(), ExpiresAt = now + InviteLifetime };
            db.EmployeeInvites.Add(invite);
            await db.SaveChangesAsync(ct);

            return Results.Ok(new InviteResponse(invite.Code, InviteUrl(invite.Code, line, config), invite.ExpiresAt));
        });

        return api;
    }

    /// <summary>LIFF URL ถ้าตั้ง LiffId แล้ว ไม่งั้นชี้ไปหน้า /liff/join ของ frontend ตรงๆ (dev)</summary>
    private static string InviteUrl(string code, LineOptions line, IConfiguration config) =>
        string.IsNullOrEmpty(line.LiffId)
            ? $"{config["Frontend:Origin"]?.TrimEnd('/')}/liff/join?code={code}"
            : $"https://liff.line.me/{line.LiffId}/join?code={code}";

    /// <summary>8 ตัว ไม่มีตัวที่สับสนง่าย (0/O, 1/I/L)</summary>
    public static string NewInviteCode()
    {
        const string alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
        return RandomNumberGenerator.GetString(alphabet, 8);
    }

    private static async Task<IResult?> Validate(EmployeeRequest req, JangnaDbContext db, CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(req.FirstName)) errors["firstName"] = ["กรุณากรอกชื่อ"];
        if (req.BaseRate < 0) errors["baseRate"] = ["ค่าจ้างติดลบไม่ได้"];
        if (req.PayType != PayType.Piece && req.BaseRate == 0) errors["baseRate"] = ["กรุณากรอกอัตราค่าจ้าง"];
        if (req.Language is not (null or "th" or "en" or "my")) errors["language"] = ["รองรับ th, en, my"];
        // filter ของ tenant ทำให้ branch ของร้านอื่นหาไม่เจอ
        if (req.BranchId is { } branchId && !await db.Branches.AnyAsync(b => b.Id == branchId, ct))
            errors["branchId"] = ["ไม่พบสาขา"];
        return errors.Count > 0 ? Results.ValidationProblem(errors) : null;
    }

    private static void Apply(Employee e, EmployeeRequest req)
    {
        e.FirstName = req.FirstName.Trim();
        e.LastName = req.LastName?.Trim() ?? "";
        e.Nickname = string.IsNullOrWhiteSpace(req.Nickname) ? null : req.Nickname.Trim();
        e.Phone = string.IsNullOrWhiteSpace(req.Phone) ? null : req.Phone.Trim();
        e.BranchId = req.BranchId;
        e.PayType = req.PayType;
        e.BaseRate = req.BaseRate;
        e.WorkerType = req.WorkerType;
        e.Language = req.Language ?? "th";
    }

    private static EmployeeDto ToDto(Employee e) =>
        new(e.Id, e.FirstName, e.LastName, e.Nickname, e.Phone, e.BranchId, e.Branch?.Name,
            e.PayType, e.BaseRate, e.WorkerType, e.Status, e.Language, e.LineUserId is not null, e.LineLinkedAt);
}
