using Jangna.Api.Auth;
using Jangna.Api.Localization;
using Jangna.Core.Entities;
using Jangna.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jangna.Api.Endpoints;

/// <summary>เอกสารพนักงาน (พาสปอร์ต วีซ่า ใบอนุญาตทำงาน บัตรชมพู) + รายการที่ใกล้หมดอายุ/หมดอายุแล้ว</summary>
public static class DocumentEndpoints
{
    public const int DefaultWarnDays = 60;

    public sealed record DocumentRequest(
        Guid EmployeeId, DocumentType Type, string? Number, DateOnly? IssuedOn, DateOnly? ExpiresOn, string? Note);

    /// <summary>DaysLeft: เหลือกี่วัน (ติดลบ = หมดอายุแล้ว, null = ไม่มีวันหมดอายุ)</summary>
    public sealed record DocumentDto(
        Guid Id, Guid EmployeeId, string EmployeeName, DocumentType Type, string? Number, DateOnly? IssuedOn, DateOnly? ExpiresOn,
        string? Note, int? DaysLeft);

    public static RouteGroupBuilder MapDocumentEndpoints(this RouteGroupBuilder api)
    {
        var docs = api.MapGroup("/employee-documents").RequireAuthorization(Policies.Manager);

        docs.MapGet("/", async (Guid employeeId, JangnaDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            var today = Today(clock);
            var rows = await db.EmployeeDocuments.AsNoTracking().Include(d => d.Employee)
                .Where(d => d.EmployeeId == employeeId)
                .ToListAsync(ct);
            return rows.OrderBy(d => d.ExpiresOn ?? DateOnly.MaxValue).Select(d => ToDto(d, today)).ToList();
        });

        // หมดอายุแล้ว หรือจะหมดภายใน days วัน — เรียงจากเร่งด่วนที่สุด; พนักงานที่ออกแล้ว (Inactive) ไม่นับ
        docs.MapGet("/expiring", async (int? days, JangnaDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            var today = Today(clock);
            var limit = today.AddDays(Math.Clamp(days ?? DefaultWarnDays, 1, 730));
            var rows = await db.EmployeeDocuments.AsNoTracking().Include(d => d.Employee)
                .Where(d => d.ExpiresOn != null && d.ExpiresOn <= limit && d.Employee!.Status == EmployeeStatus.Active)
                .OrderBy(d => d.ExpiresOn)
                .ToListAsync(ct);
            return rows.Select(d => ToDto(d, today)).ToList();
        });

        docs.MapPost("/", async (DocumentRequest req, JangnaDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            if (await Validate(req, db, ct) is { } invalid) return invalid;
            var doc = new EmployeeDocument { EmployeeId = req.EmployeeId };
            Apply(doc, req);
            db.EmployeeDocuments.Add(doc);
            await db.SaveChangesAsync(ct);
            await db.Entry(doc).Reference(d => d.Employee).LoadAsync(ct);
            return Results.Created($"/api/employee-documents/{doc.Id}", ToDto(doc, Today(clock)));
        });

        docs.MapPut("/{id:guid}", async (Guid id, DocumentRequest req, JangnaDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            if (await Validate(req, db, ct) is { } invalid) return invalid;
            var doc = await db.EmployeeDocuments.Include(d => d.Employee).SingleOrDefaultAsync(d => d.Id == id, ct);
            if (doc is null) return Results.NotFound();
            if (doc.EmployeeId != req.EmployeeId)
                return Results.Problem(L.T("ย้ายเอกสารไปพนักงานคนอื่นไม่ได้", "A document cannot be moved to another employee"), statusCode: 400);
            Apply(doc, req);
            await db.SaveChangesAsync(ct);
            return Results.Ok(ToDto(doc, Today(clock)));
        });

        docs.MapDelete("/{id:guid}", async (Guid id, JangnaDbContext db, CancellationToken ct) =>
        {
            var doc = await db.EmployeeDocuments.FindAsync([id], ct);
            if (doc is null) return Results.NotFound();
            db.EmployeeDocuments.Remove(doc);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        return api;
    }

    /// <summary>วันนี้ตามเวลาไทย (UTC+7) — วันหมดอายุเป็นวันตามปฏิทินไทย</summary>
    private static DateOnly Today(TimeProvider clock) => DateOnly.FromDateTime(clock.GetUtcNow().ToOffset(TimeSpan.FromHours(7)).DateTime);

    private static async Task<IResult?> Validate(DocumentRequest req, JangnaDbContext db, CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        if (!await db.Employees.AnyAsync(e => e.Id == req.EmployeeId, ct))
            return Results.Problem(L.T("ไม่พบพนักงาน", "Employee not found"), statusCode: 404);
        if (!Enum.IsDefined(req.Type)) errors["type"] = [L.T("ประเภทเอกสารไม่ถูกต้อง", "Invalid document type")];
        if (req.IssuedOn is { } issued && req.ExpiresOn is { } expires && expires < issued)
            errors["expiresOn"] = [L.T("วันหมดอายุต้องไม่ก่อนวันที่ออกเอกสาร", "Expiry date cannot be before the issue date")];
        if (req.Number is { Length: > 50 }) errors["number"] = [L.T("เลขที่เอกสารยาวเกินไป (ไม่เกิน 50)", "Document number is too long (max 50)")];
        return errors.Count > 0 ? Results.ValidationProblem(errors) : null;
    }

    private static void Apply(EmployeeDocument d, DocumentRequest req)
    {
        d.Type = req.Type;
        d.Number = string.IsNullOrWhiteSpace(req.Number) ? null : req.Number.Trim();
        d.IssuedOn = req.IssuedOn;
        d.ExpiresOn = req.ExpiresOn;
        d.Note = string.IsNullOrWhiteSpace(req.Note) ? null : req.Note.Trim();
    }

    private static DocumentDto ToDto(EmployeeDocument d, DateOnly today) =>
        new(d.Id, d.EmployeeId, $"{d.Employee?.FirstName} {d.Employee?.LastName}".Trim(), d.Type, d.Number, d.IssuedOn, d.ExpiresOn,
            d.Note, d.ExpiresOn is { } e ? e.DayNumber - today.DayNumber : null);
}
