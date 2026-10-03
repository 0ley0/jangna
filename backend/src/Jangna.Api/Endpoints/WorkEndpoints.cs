using Jangna.Api.Auth;
using Jangna.Api.Localization;
using Jangna.Api.PayRuns;
using Jangna.Core.Entities;
using Jangna.Infrastructure.Persistence;
using Jangna.Payroll.Engine.Model;
using Microsoft.EntityFrameworkCore;

namespace Jangna.Api.Endpoints;

/// <summary>ข้อมูลที่ใช้คำนวณเงินเดือน: วันทำงาน, ผลงานต่อชิ้น, เงินเบิก, วันหยุดร้าน</summary>
public static class WorkEndpoints
{
    /// <summary>หน้ากรอกตารางทั้งเดือน: พนักงาน ~50 คน × 31 วัน = 1,550 แถว</summary>
    public const int MaxWorkDayBatch = 2000;

    public sealed record WorkDayRequest(
        Guid EmployeeId, DateOnly Date, DayKind Kind, decimal NormalHours, decimal OvertimeHours, LeaveKind Leave, string? Note);

    public sealed record WorkDayDto(
        Guid Id, Guid EmployeeId, DateOnly Date, DayKind Kind, decimal NormalHours, decimal OvertimeHours, LeaveKind Leave,
        WorkSource Source, string? Note);

    public sealed record PieceWorkRequest(
        Guid EmployeeId, DateOnly Date, string Description, decimal Quantity, decimal Rate, bool Overtime, string? Note);

    public sealed record PieceWorkDto(
        Guid Id, Guid EmployeeId, DateOnly Date, string Description, decimal Quantity, decimal Rate, bool Overtime,
        WorkSource Source, string? Note);

    public sealed record AdvanceRequest(Guid EmployeeId, DateOnly Date, decimal Amount, string? Note);

    public sealed record AdvanceDto(Guid Id, Guid EmployeeId, DateOnly Date, decimal Amount, string? Note);

    public sealed record OpeningBalanceRequest(
        Guid EmployeeId, int Year, decimal TaxableIncome, decimal TaxWithheld, decimal SocialSecurity, string? Note);

    public sealed record OpeningBalanceDto(
        Guid Id, Guid EmployeeId, int Year, decimal TaxableIncome, decimal TaxWithheld, decimal SocialSecurity, string? Note);

    public sealed record HolidayRequest(DateOnly Date, string Name);

    public sealed record HolidayDto(Guid Id, DateOnly Date, string Name);

    public static RouteGroupBuilder MapWorkEndpoints(this RouteGroupBuilder api)
    {
        var manager = api.MapGroup("").RequireAuthorization(Policies.Manager);

        // ---------- วันทำงาน ----------

        manager.MapGet("/work-days", async (DateOnly from, DateOnly to, Guid? employeeId, JangnaDbContext db, CancellationToken ct) =>
            await db.WorkDays
                .Where(w => w.Date >= from && w.Date <= to && (employeeId == null || w.EmployeeId == employeeId))
                .OrderBy(w => w.Date)
                .Select(w => new WorkDayDto(w.Id, w.EmployeeId, w.Date, w.Kind, w.NormalHours, w.OvertimeHours, w.Leave, w.Source, w.Note))
                .ToListAsync(ct));

        // upsert หลายวันพร้อมกัน (หน้ากรอกตารางทั้งเดือน) — 1 พนักงาน 1 วัน มีได้ 1 แถว
        manager.MapPut("/work-days", async (List<WorkDayRequest> items, JangnaDbContext db, PayRunService runs, CancellationToken ct) =>
        {
            if (items.Count > MaxWorkDayBatch)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["items"] = [L.T($"บันทึกได้ครั้งละไม่เกิน {MaxWorkDayBatch} วัน", $"At most {MaxWorkDayBatch} days per save")] });
            var errors = new Dictionary<string, string[]>();
            for (var i = 0; i < items.Count; i++)
            {
                var x = items[i];
                if (x.NormalHours is < 0 or > 24 || x.OvertimeHours is < 0 or > 24 || x.NormalHours + x.OvertimeHours > 24)
                    errors[$"[{i}].hours"] = [L.T("ชั่วโมงต้องอยู่ระหว่าง 0–24 และรวมกันไม่เกิน 24", "Hours must be 0–24 and total at most 24")];
            }
            if (errors.Count > 0) return Results.ValidationProblem(errors);
            if (await Guard(items.Select(x => x.Date), items.Select(x => x.EmployeeId), db, runs, ct) is { } blocked) return blocked;

            var employeeIds = items.Select(x => x.EmployeeId).Distinct().ToList();
            var dates = items.Select(x => x.Date).Distinct().ToList();
            var existing = await db.WorkDays
                .Where(w => employeeIds.Contains(w.EmployeeId) && dates.Contains(w.Date))
                .ToDictionaryAsync(w => (w.EmployeeId, w.Date), ct);

            foreach (var x in items)
            {
                if (!existing.TryGetValue((x.EmployeeId, x.Date), out var day))
                {
                    day = new WorkDay { EmployeeId = x.EmployeeId, Date = x.Date, Source = WorkSource.Manual };
                    db.WorkDays.Add(day);
                    existing[(x.EmployeeId, x.Date)] = day;
                }
                day.Kind = x.Kind;
                day.NormalHours = x.NormalHours;
                day.OvertimeHours = x.OvertimeHours;
                day.Leave = x.Leave;
                day.Note = string.IsNullOrWhiteSpace(x.Note) ? null : x.Note.Trim();
            }
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        manager.MapDelete("/work-days/{id:guid}", async (Guid id, JangnaDbContext db, PayRunService runs, CancellationToken ct) =>
        {
            var day = await db.WorkDays.FindAsync([id], ct);
            if (day is null) return Results.NotFound();
            if (await Guard([day.Date], [day.EmployeeId], db, runs, ct) is { } blocked) return blocked;
            db.WorkDays.Remove(day);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        // ---------- ผลงานต่อชิ้น ----------

        manager.MapGet("/piece-work", async (DateOnly from, DateOnly to, Guid? employeeId, JangnaDbContext db, CancellationToken ct) =>
            await db.PieceWorkEntries
                .Where(p => p.Date >= from && p.Date <= to && (employeeId == null || p.EmployeeId == employeeId))
                .OrderBy(p => p.Date).ThenBy(p => p.CreatedAt)
                .Select(p => new PieceWorkDto(p.Id, p.EmployeeId, p.Date, p.Description, p.Quantity, p.Rate, p.Overtime, p.Source, p.Note))
                .ToListAsync(ct));

        manager.MapPost("/piece-work", async (PieceWorkRequest x, JangnaDbContext db, PayRunService runs, CancellationToken ct) =>
        {
            var errors = new Dictionary<string, string[]>();
            if (string.IsNullOrWhiteSpace(x.Description)) errors["description"] = [L.T("กรุณาระบุงาน", "Describe the work")];
            if (x.Quantity <= 0) errors["quantity"] = [L.T("จำนวนต้องมากกว่า 0", "Quantity must be greater than 0")];
            else if (x.Quantity > Limits.Money) errors["quantity"] = [L.T("จำนวนสูงเกินไป", "Quantity is too large")];
            if (x.Rate < 0) errors["rate"] = [L.T("อัตราติดลบไม่ได้", "Rate cannot be negative")];
            else if (x.Rate > Limits.Rate) errors["rate"] = [L.T("อัตราสูงเกินไป", "Rate is too large")];
            if (errors.Count > 0) return Results.ValidationProblem(errors);
            if (await Guard([x.Date], [x.EmployeeId], db, runs, ct) is { } blocked) return blocked;

            var entry = new PieceWorkEntry
            {
                EmployeeId = x.EmployeeId, Date = x.Date, Description = x.Description.Trim(), Quantity = x.Quantity,
                Rate = x.Rate, Overtime = x.Overtime, Source = WorkSource.Manual, Note = x.Note,
            };
            db.PieceWorkEntries.Add(entry);
            await db.SaveChangesAsync(ct);
            return Results.Ok(new PieceWorkDto(entry.Id, entry.EmployeeId, entry.Date, entry.Description, entry.Quantity,
                entry.Rate, entry.Overtime, entry.Source, entry.Note));
        });

        manager.MapDelete("/piece-work/{id:guid}", async (Guid id, JangnaDbContext db, PayRunService runs, CancellationToken ct) =>
        {
            var entry = await db.PieceWorkEntries.FindAsync([id], ct);
            if (entry is null) return Results.NotFound();
            if (await Guard([entry.Date], [entry.EmployeeId], db, runs, ct) is { } blocked) return blocked;
            db.PieceWorkEntries.Remove(entry);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        // ---------- เงินเบิกล่วงหน้า (ไม่มีลบ — ถ้าผิดให้บันทึกยอดติดลบเพื่อกลับรายการ จะได้มีประวัติ) ----------

        manager.MapGet("/advances", async (Guid? employeeId, JangnaDbContext db, CancellationToken ct) =>
            await db.Advances
                .Where(a => employeeId == null || a.EmployeeId == employeeId)
                .OrderByDescending(a => a.Date)
                .Select(a => new AdvanceDto(a.Id, a.EmployeeId, a.Date, a.Amount, a.Note))
                .ToListAsync(ct));

        manager.MapPost("/advances", async (AdvanceRequest x, JangnaDbContext db, CancellationToken ct) =>
        {
            if (x.Amount == 0) return Results.ValidationProblem(new Dictionary<string, string[]> { ["amount"] = [L.T("กรุณาระบุจำนวนเงิน", "Enter an amount")] });
            if (Math.Abs(x.Amount) > Limits.Money) return Results.ValidationProblem(new Dictionary<string, string[]> { ["amount"] = [L.T("จำนวนเงินสูงเกินไป", "Amount is too large")] });
            if (!await db.Employees.AnyAsync(e => e.Id == x.EmployeeId, ct)) return Results.NotFound();

            var advance = new Advance { EmployeeId = x.EmployeeId, Date = x.Date, Amount = x.Amount, Note = x.Note };
            db.Advances.Add(advance);
            await db.SaveChangesAsync(ct);
            return Results.Ok(new AdvanceDto(advance.Id, advance.EmployeeId, advance.Date, advance.Amount, advance.Note));
        });

        // ---------- ยอดยกมาต้นปี ----------

        manager.MapGet("/opening-balances", async (int year, JangnaDbContext db, CancellationToken ct) =>
            await db.OpeningBalances.Where(o => o.Year == year)
                .Select(o => new OpeningBalanceDto(o.Id, o.EmployeeId, o.Year, o.TaxableIncome, o.TaxWithheld, o.SocialSecurity, o.Note))
                .ToListAsync(ct));

        api.MapPut("/opening-balances", async (OpeningBalanceRequest x, JangnaDbContext db, CancellationToken ct) =>
        {
            if (x.TaxableIncome < 0 || x.TaxWithheld < 0 || x.SocialSecurity < 0)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["amount"] = [L.T("ยอดติดลบไม่ได้", "Amounts cannot be negative")] });
            if (x.Year is < 2000 or > 2100)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["year"] = [L.T("ปีไม่ถูกต้อง", "Invalid year")] });
            if (Math.Max(x.TaxableIncome, Math.Max(x.TaxWithheld, x.SocialSecurity)) > Limits.BigMoney)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["amount"] = [L.T("ยอดสูงเกินไป", "Amount is too large")] });
            if (x.TaxWithheld > x.TaxableIncome)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["taxWithheld"] = [L.T("ภาษีที่หักไปแล้วต้องไม่เกินเงินได้สะสม", "Tax withheld cannot exceed taxable income")] });
            if (!await db.Employees.AnyAsync(e => e.Id == x.EmployeeId, ct)) return Results.NotFound();
            // ยอดยกมาใช้ตั้งต้นการประมาณภาษี — เปลี่ยนหลังปิดรอบแรกของปีแล้วจะทำให้รอบที่ปิดไปไม่ตรงกับยอดใหม่
            if (await db.PayRuns.AnyAsync(r => r.Status == PayRunStatus.Locked && r.PeriodStart.Year == x.Year, ct))
                return Results.Problem(L.T("ปีนี้มีรอบจ่ายที่ปิดแล้ว แก้ยอดยกมาไม่ได้", "This year already has a locked pay run — opening balances can no longer change"), statusCode: StatusCodes.Status409Conflict);

            var balance = await db.OpeningBalances.SingleOrDefaultAsync(o => o.EmployeeId == x.EmployeeId && o.Year == x.Year, ct);
            if (balance is null)
            {
                balance = new OpeningBalance { EmployeeId = x.EmployeeId, Year = x.Year };
                db.OpeningBalances.Add(balance);
            }
            balance.TaxableIncome = x.TaxableIncome;
            balance.TaxWithheld = x.TaxWithheld;
            balance.SocialSecurity = x.SocialSecurity;
            balance.Note = x.Note;
            await db.SaveChangesAsync(ct);
            return Results.Ok(new OpeningBalanceDto(balance.Id, balance.EmployeeId, balance.Year, balance.TaxableIncome,
                balance.TaxWithheld, balance.SocialSecurity, balance.Note));
        }).RequireAuthorization(Policies.Owner);

        // ---------- วันหยุดของร้าน ----------

        manager.MapGet("/holidays", async (int year, JangnaDbContext db, CancellationToken ct) =>
            await db.Holidays.Where(h => h.Date.Year == year).OrderBy(h => h.Date)
                .Select(h => new HolidayDto(h.Id, h.Date, h.Name)).ToListAsync(ct));

        api.MapPost("/holidays", async (HolidayRequest x, JangnaDbContext db, PayRunService runs, CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(x.Name)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["name"] = [L.T("กรุณาระบุชื่อวันหยุด", "Holiday name is required")] });
            if (await runs.IsLockedAsync(x.Date, ct)) return LockedProblem();
            if (await db.Holidays.AnyAsync(h => h.Date == x.Date, ct))
                return Results.Problem(L.T("วันนี้เป็นวันหยุดอยู่แล้ว", "This date is already a holiday"), statusCode: StatusCodes.Status409Conflict);

            var holiday = new Holiday { Date = x.Date, Name = x.Name.Trim() };
            db.Holidays.Add(holiday);
            await db.SaveChangesAsync(ct);
            return Results.Ok(new HolidayDto(holiday.Id, holiday.Date, holiday.Name));
        }).RequireAuthorization(Policies.Owner);

        api.MapDelete("/holidays/{id:guid}", async (Guid id, JangnaDbContext db, PayRunService runs, CancellationToken ct) =>
        {
            var holiday = await db.Holidays.FindAsync([id], ct);
            if (holiday is null) return Results.NotFound();
            if (await runs.IsLockedAsync(holiday.Date, ct)) return LockedProblem();
            db.Holidays.Remove(holiday);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        }).RequireAuthorization(Policies.Owner);

        return api;
    }

    /// <summary>พนักงานต้องเป็นของร้านนี้ และวันที่ต้องไม่อยู่ในรอบจ่ายที่ปิดแล้ว</summary>
    private static async Task<IResult?> Guard(IEnumerable<DateOnly> dates, IEnumerable<Guid> employeeIds,
        JangnaDbContext db, PayRunService runs, CancellationToken ct)
    {
        var ids = employeeIds.Distinct().ToList();
        if (await db.Employees.CountAsync(e => ids.Contains(e.Id), ct) != ids.Count)
            return Results.Problem(L.T("ไม่พบพนักงาน", "Employee not found"), statusCode: StatusCodes.Status404NotFound);

        foreach (var date in dates.Distinct())
            if (await runs.IsLockedAsync(date, ct)) return LockedProblem(date);
        return null;
    }

    private static IResult LockedProblem(DateOnly? date = null) =>
        Results.Problem(date is { } d
                ? L.T($"วันที่ {d:dd/MM/yyyy} อยู่ในรอบจ่ายที่ปิดแล้ว แก้ไขไม่ได้", $"{d:dd/MM/yyyy} is in a locked pay run and cannot be changed")
                : L.T("อยู่ในรอบจ่ายที่ปิดแล้ว แก้ไขไม่ได้", "This date is in a locked pay run and cannot be changed"),
            statusCode: StatusCodes.Status409Conflict);
}
