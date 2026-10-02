using System.Security.Cryptography;
using Jangna.Api.Auth;
using Jangna.Api.Line;
using Jangna.Api.Localization;
using Jangna.Core.Entities;
using Jangna.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jangna.Api.Endpoints;

public static class EmployeeEndpoints
{
    public static readonly TimeSpan InviteLifetime = TimeSpan.FromDays(7);

    public sealed record EmployeeRequest(
        string FirstName, string? LastName, string? Nickname, string? Phone, Guid? BranchId,
        PayType PayType, decimal BaseRate, WorkerType WorkerType, string? Language,
        Title? Title = null, string? NationalId = null, string? AddressLine = null, string? Subdistrict = null,
        string? District = null, string? Province = null, string? PostalCode = null);

    public sealed record EmployeeDto(
        Guid Id, string FirstName, string LastName, string? Nickname, string? Phone, Guid? BranchId, string? BranchName,
        PayType PayType, decimal BaseRate, WorkerType WorkerType, EmployeeStatus Status, string Language,
        bool LineLinked, DateTimeOffset? LineLinkedAt,
        Title? Title, string? NationalId, string? AddressLine, string? Subdistrict, string? District, string? Province, string? PostalCode);

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
            if (await Validate(req, null, db, ct) is { } invalid) return invalid;

            var employee = new Employee { FirstName = req.FirstName.Trim() };
            Apply(employee, req);
            db.Employees.Add(employee);
            await db.SaveChangesAsync(ct);
            await db.Entry(employee).Reference(e => e.Branch).LoadAsync(ct);
            return Results.Created($"/api/employees/{employee.Id}", ToDto(employee));
        });

        employees.MapPut("/{id:guid}", async (Guid id, EmployeeRequest req, JangnaDbContext db, CancellationToken ct) =>
        {
            if (await Validate(req, id, db, ct) is { } invalid) return invalid;

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

    private static async Task<IResult?> Validate(EmployeeRequest req, Guid? id, JangnaDbContext db, CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(req.FirstName)) errors["firstName"] = [L.T("กรุณากรอกชื่อ", "First name is required")];
        if (req.BaseRate < 0) errors["baseRate"] = [L.T("ค่าจ้างติดลบไม่ได้", "Pay rate cannot be negative")];
        if (req.PayType != PayType.Piece && req.BaseRate == 0) errors["baseRate"] = [L.T("กรุณากรอกอัตราค่าจ้าง", "Enter a pay rate")];
        if (req.Language is not (null or "th" or "en" or "my")) errors["language"] = [L.T("รองรับ th, en, my", "Supported: th, en, my")];
        // filter ของ tenant ทำให้ branch ของร้านอื่นหาไม่เจอ
        if (req.BranchId is { } branchId && !await db.Branches.AnyAsync(b => b.Id == branchId, ct))
            errors["branchId"] = [L.T("ไม่พบสาขา", "Branch not found")];
        if (Clean(req.NationalId) is { } nationalId)
        {
            if (!IsValidNationalId(nationalId))
                errors["nationalId"] = [L.T("เลขประจำตัวประชาชนไม่ถูกต้อง (13 หลัก)", "Invalid national ID (13 digits)")];
            else if (await db.Employees.AnyAsync(e => e.NationalId == nationalId && e.Id != id, ct))
                errors["nationalId"] = [L.T("เลขนี้ใช้กับพนักงานคนอื่นแล้ว", "This ID is already used by another employee")];
        }
        if (Clean(req.PostalCode) is { } postal && (postal.Length != 5 || !postal.All(char.IsAsciiDigit)))
            errors["postalCode"] = [L.T("รหัสไปรษณีย์ 5 หลัก", "Postal code must be 5 digits")];
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
        e.Title = req.Title;
        e.NationalId = Clean(req.NationalId);
        e.AddressLine = Text(req.AddressLine);
        e.Subdistrict = Text(req.Subdistrict);
        e.District = Text(req.District);
        e.Province = Text(req.Province);
        e.PostalCode = Clean(req.PostalCode);
    }

    private static string? Text(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /// <summary>ตัวเลข: ตัดช่องว่าง/ขีด (1-2345-67890-12-3 → 1234567890123) ว่าง = null</summary>
    private static string? Clean(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var trimmed = value.Trim();
        return trimmed.All(c => char.IsAsciiDigit(c) || c is '-' or ' ') ? trimmed.Replace("-", "").Replace(" ", "") : trimmed;
    }

    /// <summary>เลขบัตรประชาชน 13 หลัก + check digit (หลักที่ 13 = (11 − Σ dᵢ×(14−i) mod 11) mod 10)</summary>
    public static bool IsValidNationalId(string id)
    {
        if (id.Length != 13 || !id.All(char.IsAsciiDigit)) return false;
        var sum = 0;
        for (var i = 0; i < 12; i++) sum += (id[i] - '0') * (13 - i);
        return (11 - sum % 11) % 10 == id[12] - '0';
    }

    private static EmployeeDto ToDto(Employee e) =>
        new(e.Id, e.FirstName, e.LastName, e.Nickname, e.Phone, e.BranchId, e.Branch?.Name,
            e.PayType, e.BaseRate, e.WorkerType, e.Status, e.Language, e.LineUserId is not null, e.LineLinkedAt,
            e.Title, e.NationalId, e.AddressLine, e.Subdistrict, e.District, e.Province, e.PostalCode);
}
