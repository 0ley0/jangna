using Jangna.Api.Auth;
using Jangna.Api.Localization;
using Jangna.Core.Entities;
using Jangna.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jangna.Api.Endpoints;

/// <summary>กะงาน: แม่แบบกะ + จัดกะรายสัปดาห์ (1 คน 1 กะต่อวัน) — ยังไม่ส่งผลต่อเงินเดือน</summary>
public static class ShiftEndpoints
{
    public static readonly string[] Colors = ["brand", "sage", "amber", "plum", "blue", "neutral"];
    public const int MaxRangeDays = 62;

    public sealed record TemplateRequest(string Name, TimeOnly StartTime, TimeOnly EndTime, int BreakMinutes, string? Color, bool Archived = false);

    public sealed record TemplateDto(Guid Id, string Name, TimeOnly StartTime, TimeOnly EndTime, int BreakMinutes, string Color, bool Archived, decimal Hours);

    /// <summary>TemplateId = ใช้เวลาจากแม่แบบ, ไม่มี TemplateId แต่มีเวลา = กะกำหนดเอง, ไม่มีทั้งคู่ = ลบกะวันนั้น</summary>
    public sealed record ShiftRequest(
        Guid EmployeeId, DateOnly Date, Guid? TemplateId, TimeOnly? StartTime = null, TimeOnly? EndTime = null, int? BreakMinutes = null, string? Note = null);

    public sealed record ShiftDto(
        Guid Id, Guid EmployeeId, DateOnly Date, Guid? TemplateId, TimeOnly StartTime, TimeOnly EndTime, int BreakMinutes, decimal Hours, string? Note);

    /// <summary>คัดลอกกะทั้งสัปดาห์ (7 วันนับจาก From) ไปสัปดาห์ที่ขึ้นต้นด้วย To</summary>
    public sealed record CopyWeekRequest(DateOnly From, DateOnly To, bool Overwrite);

    public static RouteGroupBuilder MapShiftEndpoints(this RouteGroupBuilder api)
    {
        var manager = api.MapGroup("").RequireAuthorization(Policies.Manager);

        // ---------- แม่แบบกะ ----------

        manager.MapGet("/shift-templates", async (JangnaDbContext db, CancellationToken ct) =>
            (await db.ShiftTemplates.OrderBy(t => t.Archived).ThenBy(t => t.StartTime).ThenBy(t => t.Name).ToListAsync(ct))
            .Select(ToDto));

        manager.MapPost("/shift-templates", async (TemplateRequest req, JangnaDbContext db, CancellationToken ct) =>
        {
            if (ValidateTemplate(req) is { } invalid) return invalid;
            var template = new ShiftTemplate { Name = req.Name.Trim() };
            Apply(template, req);
            db.ShiftTemplates.Add(template);
            await db.SaveChangesAsync(ct);
            return Results.Ok(ToDto(template));
        });

        manager.MapPut("/shift-templates/{id:guid}", async (Guid id, TemplateRequest req, JangnaDbContext db, CancellationToken ct) =>
        {
            if (ValidateTemplate(req) is { } invalid) return invalid;
            var template = await db.ShiftTemplates.FindAsync([id], ct);
            if (template is null) return Results.NotFound();
            Apply(template, req);
            await db.SaveChangesAsync(ct);
            return Results.Ok(ToDto(template));
        });

        // ถูกใช้ในตารางกะหรือนโยบายการทำงานแล้ว → เก็บเข้าคลัง (archived) แทนการลบ ประวัติจะได้ไม่หาย
        manager.MapDelete("/shift-templates/{id:guid}", async (Guid id, JangnaDbContext db, CancellationToken ct) =>
        {
            var template = await db.ShiftTemplates.FindAsync([id], ct);
            if (template is null) return Results.NotFound();
            if (await db.Shifts.AnyAsync(s => s.ShiftTemplateId == id, ct) || await db.WorkPolicyDays.AnyAsync(d => d.ShiftTemplateId == id, ct)) template.Archived = true;
            else db.ShiftTemplates.Remove(template);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        // ---------- ตารางกะ ----------

        manager.MapGet("/shifts", async (DateOnly from, DateOnly to, JangnaDbContext db, CancellationToken ct) =>
        {
            if (to < from || to.DayNumber - from.DayNumber >= MaxRangeDays)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                    { ["to"] = [L.T($"ช่วงวันที่ต้องไม่เกิน {MaxRangeDays} วัน", $"Date range must be at most {MaxRangeDays} days")] });
            var shifts = await db.Shifts.Where(s => s.Date >= from && s.Date <= to).OrderBy(s => s.Date).ToListAsync(ct);
            return Results.Ok(shifts.Select(ToDto));
        });

        // บันทึกหลายช่องพร้อมกัน (กดเลือกในตารางสัปดาห์)
        manager.MapPut("/shifts", async (List<ShiftRequest> items, JangnaDbContext db, CancellationToken ct) =>
        {
            if (items.Count > 500)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["items"] = [L.T("บันทึกได้ครั้งละไม่เกิน 500 ช่อง", "At most 500 cells per save")] });

            var employeeIds = items.Select(x => x.EmployeeId).Distinct().ToList();
            if (await db.Employees.CountAsync(e => employeeIds.Contains(e.Id), ct) != employeeIds.Count)
                return Results.Problem(L.T("ไม่พบพนักงาน", "Employee not found"), statusCode: StatusCodes.Status404NotFound);

            var templateIds = items.Where(x => x.TemplateId is not null).Select(x => x.TemplateId!.Value).Distinct().ToList();
            var templates = await db.ShiftTemplates.Where(t => templateIds.Contains(t.Id)).ToDictionaryAsync(t => t.Id, ct);
            if (templates.Count != templateIds.Count)
                return Results.Problem(L.T("ไม่พบแม่แบบกะ", "Shift template not found"), statusCode: StatusCodes.Status404NotFound);

            var errors = new Dictionary<string, string[]>();
            for (var i = 0; i < items.Count; i++)
            {
                var x = items[i];
                if (x.TemplateId is null && (x.StartTime is null) != (x.EndTime is null))
                    errors[$"[{i}].time"] = [L.T("ต้องระบุทั้งเวลาเข้าและเวลาออก", "Both start and end time are required")];
                else if (x.TemplateId is null && x.StartTime is { } s && x.EndTime is { } e && BreakTooLong(s, e, x.BreakMinutes ?? 0))
                    errors[$"[{i}].breakMinutes"] = [L.T("เวลาพักต้องสั้นกว่าเวลากะ", "Break must be shorter than the shift")];
            }
            if (errors.Count > 0) return Results.ValidationProblem(errors);

            var dates = items.Select(x => x.Date).Distinct().ToList();
            var existing = await db.Shifts.Where(s => employeeIds.Contains(s.EmployeeId) && dates.Contains(s.Date))
                .ToDictionaryAsync(s => (s.EmployeeId, s.Date), ct);

            foreach (var x in items)
            {
                existing.TryGetValue((x.EmployeeId, x.Date), out var shift);
                var remove = x.TemplateId is null && x.StartTime is null;
                if (remove)
                {
                    if (shift is not null) db.Shifts.Remove(shift);
                    existing.Remove((x.EmployeeId, x.Date));
                    continue;
                }

                if (shift is null)
                {
                    shift = new Shift { EmployeeId = x.EmployeeId, Date = x.Date };
                    db.Shifts.Add(shift);
                    existing[(x.EmployeeId, x.Date)] = shift;
                }

                if (x.TemplateId is { } templateId)
                {
                    var t = templates[templateId];
                    (shift.ShiftTemplateId, shift.StartTime, shift.EndTime, shift.BreakMinutes) = (t.Id, t.StartTime, t.EndTime, t.BreakMinutes);
                }
                else
                {
                    (shift.ShiftTemplateId, shift.StartTime, shift.EndTime, shift.BreakMinutes) = (null, x.StartTime!.Value, x.EndTime!.Value, x.BreakMinutes ?? 0);
                }
                shift.Note = string.IsNullOrWhiteSpace(x.Note) ? null : x.Note.Trim();
            }

            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        manager.MapPost("/shifts/copy-week", async (CopyWeekRequest req, JangnaDbContext db, CancellationToken ct) =>
        {
            var offset = req.To.DayNumber - req.From.DayNumber;
            if (offset == 0 || offset % 7 != 0)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                    { ["to"] = [L.T("สัปดาห์ปลายทางต้องห่างเป็นจำนวนเต็มสัปดาห์", "Target must be a whole number of weeks away")] });

            var source = await db.Shifts.AsNoTracking()
                .Where(s => s.Date >= req.From && s.Date <= req.From.AddDays(6)).ToListAsync(ct);
            var targetEnd = req.To.AddDays(6);
            var target = await db.Shifts.Where(s => s.Date >= req.To && s.Date <= targetEnd)
                .ToDictionaryAsync(s => (s.EmployeeId, s.Date), ct);

            var copied = 0;
            foreach (var s in source)
            {
                var date = s.Date.AddDays(offset);
                // แก้แถวเดิมแทนการลบแล้วเพิ่ม — unique (employee, date) จะได้ไม่ชนกันใน SaveChanges เดียว
                if (target.TryGetValue((s.EmployeeId, date), out var shift))
                {
                    if (!req.Overwrite) continue;
                }
                else
                {
                    shift = new Shift { EmployeeId = s.EmployeeId, Date = date };
                    db.Shifts.Add(shift);
                }
                (shift.ShiftTemplateId, shift.StartTime, shift.EndTime, shift.BreakMinutes, shift.Note) =
                    (s.ShiftTemplateId, s.StartTime, s.EndTime, s.BreakMinutes, s.Note);
                copied++;
            }
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { copied });
        });

        return api;
    }

    private static IResult? ValidateTemplate(TemplateRequest req)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(req.Name)) errors["name"] = [L.T("กรุณาตั้งชื่อกะ", "Shift name is required")];
        else if (req.Name.Trim().Length > 60) errors["name"] = [L.T("ชื่อกะยาวไม่เกิน 60 ตัวอักษร", "Shift name must be at most 60 characters")];
        if (req.BreakMinutes < 0 || BreakTooLong(req.StartTime, req.EndTime, req.BreakMinutes))
            errors["breakMinutes"] = [L.T("เวลาพักต้องไม่ติดลบและสั้นกว่าเวลากะ", "Break must be zero or more and shorter than the shift")];
        if (req.Color is not null && !Colors.Contains(req.Color)) errors["color"] = [L.T("สีไม่ถูกต้อง", "Invalid colour")];
        return errors.Count > 0 ? Results.ValidationProblem(errors) : null;
    }

    private static bool BreakTooLong(TimeOnly start, TimeOnly end, int breakMinutes) =>
        breakMinutes < 0 || Shift.WorkHours(start, end, breakMinutes) <= 0;

    private static void Apply(ShiftTemplate t, TemplateRequest req)
    {
        t.Name = req.Name.Trim();
        t.StartTime = req.StartTime;
        t.EndTime = req.EndTime;
        t.BreakMinutes = req.BreakMinutes;
        t.Color = req.Color ?? t.Color;
        t.Archived = req.Archived;
    }

    private static TemplateDto ToDto(ShiftTemplate t) =>
        new(t.Id, t.Name, t.StartTime, t.EndTime, t.BreakMinutes, t.Color, t.Archived, Shift.WorkHours(t.StartTime, t.EndTime, t.BreakMinutes));

    private static ShiftDto ToDto(Shift s) =>
        new(s.Id, s.EmployeeId, s.Date, s.ShiftTemplateId, s.StartTime, s.EndTime, s.BreakMinutes, s.Hours, s.Note);
}
