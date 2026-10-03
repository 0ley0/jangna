using Jangna.Api.Auth;
using Jangna.Api.Localization;
using Jangna.Core.Entities;
using Jangna.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jangna.Api.Endpoints;

/// <summary>
/// นโยบายการทำงาน: แพทเทิร์นกะรอบ N สัปดาห์ ตั้งชื่อแล้วกำหนดให้พนักงาน (คนละ 1 นโยบาย) + สร้างตารางกะจากนโยบาย
/// ตารางกะ (shifts) ยังเป็นตัวจริง นโยบายเป็นแค่ค่าตั้งต้น — สร้างแล้วไม่ทับกะที่มีอยู่
/// </summary>
public static class WorkPolicyEndpoints
{
    public const int MaxCycleWeeks = 8;
    public const int MaxRangeDays = 62;

    public sealed record DayCell(int WeekIndex, int DayIndex, Guid TemplateId);

    public sealed record PolicyRequest(string Name, string? Description, int CycleWeeks, DateOnly AnchorDate, List<DayCell> Days, bool Archived = false);

    public sealed record PolicyDto(
        Guid Id, string Name, string? Description, int CycleWeeks, DateOnly AnchorDate, bool Archived, IReadOnlyList<DayCell> Days, int EmployeeCount);

    /// <summary>PolicyId = null → เอานโยบายออก</summary>
    public sealed record AssignRequest(Guid? PolicyId, List<Guid> EmployeeIds);

    public sealed record GenerateRequest(DateOnly From, DateOnly To, List<Guid>? EmployeeIds = null);

    public sealed record GenerateResult(int Created, int SkippedExisting, int EmployeesWithoutPolicy);

    public static RouteGroupBuilder MapWorkPolicyEndpoints(this RouteGroupBuilder api)
    {
        var manager = api.MapGroup("").RequireAuthorization(Policies.Manager);

        manager.MapGet("/work-policies", async (JangnaDbContext db, CancellationToken ct) =>
        {
            var policies = await db.WorkPolicies.AsNoTracking().Include(p => p.Days)
                .OrderBy(p => p.Archived).ThenBy(p => p.Name).ToListAsync(ct);
            var counts = await db.Employees.Where(e => e.WorkPolicyId != null)
                .GroupBy(e => e.WorkPolicyId!.Value).Select(g => new { Id = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.Id, x => x.Count, ct);
            return policies.Select(p => ToDto(p, counts.GetValueOrDefault(p.Id)));
        });

        manager.MapPost("/work-policies", async (PolicyRequest req, JangnaDbContext db, CancellationToken ct) =>
        {
            if (await Validate(req, null, db, ct) is { } invalid) return invalid;
            var policy = new WorkPolicy { Name = req.Name.Trim() };
            Apply(policy, req, db);
            db.WorkPolicies.Add(policy);
            await db.SaveChangesAsync(ct);
            return Results.Ok(ToDto(policy, 0));
        });

        manager.MapPut("/work-policies/{id:guid}", async (Guid id, PolicyRequest req, JangnaDbContext db, CancellationToken ct) =>
        {
            if (await Validate(req, id, db, ct) is { } invalid) return invalid;
            var policy = await db.WorkPolicies.Include(p => p.Days).SingleOrDefaultAsync(p => p.Id == id, ct);
            if (policy is null) return Results.NotFound();
            Apply(policy, req, db);
            await db.SaveChangesAsync(ct);
            return Results.Ok(ToDto(policy, await db.Employees.CountAsync(e => e.WorkPolicyId == id, ct)));
        });

        // มีพนักงานใช้อยู่ → เก็บเข้าคลัง (archived) แทนการลบ
        manager.MapDelete("/work-policies/{id:guid}", async (Guid id, JangnaDbContext db, CancellationToken ct) =>
        {
            var policy = await db.WorkPolicies.FindAsync([id], ct);
            if (policy is null) return Results.NotFound();
            if (await db.Employees.AnyAsync(e => e.WorkPolicyId == id, ct)) policy.Archived = true;
            else db.WorkPolicies.Remove(policy);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        // กำหนดนโยบายให้พนักงานหลายคนพร้อมกัน (หรือเอาออก)
        manager.MapPost("/work-policies/assign", async (AssignRequest req, JangnaDbContext db, CancellationToken ct) =>
        {
            if (req.EmployeeIds is null || req.EmployeeIds.Count is 0 or > 500)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["employeeIds"] = [L.T("เลือกพนักงาน 1–500 คน", "Select 1–500 employees")] });
            if (req.PolicyId is { } policyId)
            {
                var policy = await db.WorkPolicies.AsNoTracking().SingleOrDefaultAsync(p => p.Id == policyId, ct);
                if (policy is null) return Results.Problem(L.T("ไม่พบนโยบายการทำงาน", "Work policy not found"), statusCode: 404);
                if (policy.Archived) return Results.Problem(L.T("นโยบายนี้เลิกใช้แล้ว", "This work policy is archived"), statusCode: 409);
            }

            var ids = req.EmployeeIds.Distinct().ToList();
            var employees = await db.Employees.Where(e => ids.Contains(e.Id)).ToListAsync(ct);
            if (employees.Count != ids.Count) return Results.Problem(L.T("ไม่พบพนักงาน", "Employee not found"), statusCode: 404);
            foreach (var e in employees) e.WorkPolicyId = req.PolicyId;
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { assigned = employees.Count });
        });

        // สร้างกะตามนโยบายของพนักงานแต่ละคนในช่วงวันที่ — ข้ามช่องที่มีกะอยู่แล้ว ข้ามพนักงานที่ออกแล้ว
        manager.MapPost("/shifts/generate", async (GenerateRequest req, JangnaDbContext db, CancellationToken ct) =>
        {
            if (req.To < req.From || req.To.DayNumber - req.From.DayNumber >= MaxRangeDays)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                    { ["to"] = [L.T($"ช่วงวันที่ต้องไม่เกิน {MaxRangeDays} วัน", $"Date range must be at most {MaxRangeDays} days")] });

            var employees = await db.Employees.AsNoTracking().Where(e => e.Status == EmployeeStatus.Active)
                .Where(e => req.EmployeeIds == null || req.EmployeeIds.Contains(e.Id)).ToListAsync(ct);
            var withPolicy = employees.Where(e => e.WorkPolicyId != null).ToList();

            var policyIds = withPolicy.Select(e => e.WorkPolicyId!.Value).Distinct().ToList();
            var policies = await db.WorkPolicies.AsNoTracking().Include(p => p.Days).Where(p => policyIds.Contains(p.Id)).ToDictionaryAsync(p => p.Id, ct);
            var templateIds = policies.Values.SelectMany(p => p.Days).Select(d => d.ShiftTemplateId).Distinct().ToList();
            var templates = await db.ShiftTemplates.AsNoTracking().Where(t => templateIds.Contains(t.Id)).ToDictionaryAsync(t => t.Id, ct);

            var employeeIds = withPolicy.Select(e => e.Id).ToList();
            var existing = (await db.Shifts.AsNoTracking().Where(s => s.Date >= req.From && s.Date <= req.To && employeeIds.Contains(s.EmployeeId))
                .Select(s => new { s.EmployeeId, s.Date }).ToListAsync(ct)).Select(s => (s.EmployeeId, s.Date)).ToHashSet();

            int created = 0, skipped = 0;
            for (var date = req.From; date <= req.To; date = date.AddDays(1))
            {
                foreach (var e in withPolicy)
                {
                    if (policies[e.WorkPolicyId!.Value].TemplateOn(date) is not { } templateId) continue; // วันหยุดของนโยบาย
                    if (existing.Contains((e.Id, date))) { skipped++; continue; }
                    var t = templates[templateId];
                    db.Shifts.Add(new Shift
                    {
                        EmployeeId = e.Id, Date = date, ShiftTemplateId = t.Id,
                        StartTime = t.StartTime, EndTime = t.EndTime, BreakMinutes = t.BreakMinutes,
                    });
                    created++;
                }
            }
            await db.SaveChangesAsync(ct);
            return Results.Ok(new GenerateResult(created, skipped, employees.Count - withPolicy.Count));
        });

        return api;
    }

    private static async Task<IResult?> Validate(PolicyRequest req, Guid? id, JangnaDbContext db, CancellationToken ct)
    {
        var errors = new Dictionary<string, string[]>();
        var name = req.Name?.Trim() ?? "";
        if (name.Length == 0) errors["name"] = [L.T("กรุณาตั้งชื่อนโยบาย", "Policy name is required")];
        else if (name.Length > 60) errors["name"] = [L.T("ชื่อนโยบายยาวไม่เกิน 60 ตัวอักษร", "Policy name must be at most 60 characters")];
        else if (await db.WorkPolicies.AnyAsync(p => p.Name == name && p.Id != id, ct))
            errors["name"] = [L.T("มีนโยบายชื่อนี้แล้ว", "A policy with this name already exists")];
        if (req.Description is { Length: > 300 }) errors["description"] = [L.T("คำอธิบายยาวไม่เกิน 300 ตัวอักษร", "Description must be at most 300 characters")];
        if (req.CycleWeeks is < 1 or > MaxCycleWeeks)
            errors["cycleWeeks"] = [L.T($"รอบต้องอยู่ระหว่าง 1–{MaxCycleWeeks} สัปดาห์", $"Cycle must be 1–{MaxCycleWeeks} weeks")];

        var days = req.Days ?? [];
        if (days.Any(d => d.WeekIndex < 0 || d.WeekIndex >= Math.Max(req.CycleWeeks, 1) || d.DayIndex is < 0 or > 6))
            errors["days"] = [L.T("วัน/สัปดาห์ในแพทเทิร์นอยู่นอกรอบที่กำหนด", "A day in the pattern is outside the cycle")];
        else if (days.GroupBy(d => (d.WeekIndex, d.DayIndex)).Any(g => g.Count() > 1))
            errors["days"] = [L.T("แต่ละวันมีกะได้กะเดียว", "Each day can have only one shift")];
        else
        {
            var templateIds = days.Select(d => d.TemplateId).Distinct().ToList();
            if (await db.ShiftTemplates.CountAsync(t => templateIds.Contains(t.Id), ct) != templateIds.Count)
                errors["days"] = [L.T("ไม่พบแม่แบบกะ", "Shift template not found")];
        }
        return errors.Count > 0 ? Results.ValidationProblem(errors) : null;
    }

    private static void Apply(WorkPolicy p, PolicyRequest req, JangnaDbContext db)
    {
        p.Name = req.Name.Trim();
        p.Description = string.IsNullOrWhiteSpace(req.Description) ? null : req.Description.Trim();
        p.CycleWeeks = req.CycleWeeks;
        p.AnchorDate = WorkPolicy.MondayOf(req.AnchorDate);
        p.Archived = req.Archived;

        // แก้แถวเดิม/ลบที่ไม่เหลือ/เพิ่มที่ใหม่ — ไม่ลบทั้งหมดแล้วเพิ่มใหม่ เพราะ unique (policy, week, day) จะชนกันใน SaveChanges เดียว
        var wanted = (req.Days ?? []).ToDictionary(d => (d.WeekIndex, d.DayIndex));
        foreach (var existing in p.Days.ToList())
        {
            if (wanted.TryGetValue((existing.WeekIndex, existing.DayIndex), out var cell)) existing.ShiftTemplateId = cell.TemplateId;
            else
            {
                p.Days.Remove(existing);
                db.WorkPolicyDays.Remove(existing);
            }
        }
        var have = p.Days.Select(d => (d.WeekIndex, d.DayIndex)).ToHashSet();
        foreach (var cell in wanted.Values.Where(c => !have.Contains((c.WeekIndex, c.DayIndex))))
        {
            var day = new WorkPolicyDay { WeekIndex = cell.WeekIndex, DayIndex = cell.DayIndex, ShiftTemplateId = cell.TemplateId };
            p.Days.Add(day);
            // Id สร้างฝั่งแอป → ถ้าเพิ่มเข้า collection ของนโยบายที่ track อยู่แล้ว EF จะมองเป็น Modified (UPDATE แถวที่ไม่มี) ต้อง Add ตรงๆ
            // นโยบายใหม่ (ยังไม่ track) ไม่ต้อง — db.WorkPolicies.Add จะพากราฟทั้งก้อนเข้าเป็น Added เอง
            if (db.Entry(p).State != EntityState.Detached) db.WorkPolicyDays.Add(day);
        }
    }

    private static PolicyDto ToDto(WorkPolicy p, int employeeCount) =>
        new(p.Id, p.Name, p.Description, p.CycleWeeks, p.AnchorDate, p.Archived,
            p.Days.OrderBy(d => d.WeekIndex).ThenBy(d => d.DayIndex).Select(d => new DayCell(d.WeekIndex, d.DayIndex, d.ShiftTemplateId)).ToList(),
            employeeCount);
}
