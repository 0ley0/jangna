using Jangna.Api.Localization;
using Jangna.Core.Entities;
using Jangna.Infrastructure.Persistence;
using Jangna.Payroll.Engine.Calculators;
using Jangna.Payroll.Engine.Model;
using Jangna.Payroll.Engine.Rules;
using Microsoft.EntityFrameworkCore;

namespace Jangna.Api.PayRuns;

public sealed class PayRunException(string message, int status = StatusCodes.Status409Conflict) : Exception(message)
{
    public int Status { get; } = status;
}

/// <summary>ประกอบ input จาก DB → เรียก PayrollCalculator → เก็บผลเป็น PayRunItem</summary>
public sealed class PayRunService(JangnaDbContext db, TimeProvider clock)
{
    public const int MaxPeriodDays = 31;

    public async Task<PayRun> CreateAsync(DateOnly start, DateOnly end, DateOnly? payDate, CancellationToken ct)
    {
        if (end < start) throw new PayRunException(L.T("วันสิ้นสุดต้องไม่ก่อนวันเริ่ม", "End date must not be before start date"), StatusCodes.Status400BadRequest);
        if (start.Year != end.Year || start.Month != end.Month)
            throw new PayRunException(L.T("รอบจ่ายต้องอยู่ในเดือนเดียวกัน (ประกันสังคมคิดรายเดือน)", "A pay run must fall within one calendar month (social security is monthly)"), StatusCodes.Status400BadRequest);
        ValidatePayDate(start, end, payDate ?? end);

        if (await db.PayRuns.AnyAsync(r => r.PeriodStart <= end && start <= r.PeriodEnd, ct))
            throw new PayRunException(L.T("มีรอบจ่ายที่ทับช่วงวันนี้อยู่แล้ว", "Another pay run already overlaps these dates"));
        if (await db.PayRuns.AnyAsync(r => r.Status == PayRunStatus.Locked && r.PeriodStart > end, ct))
            throw new PayRunException(L.T("มีรอบจ่ายหลังจากนี้ที่ปิดไปแล้ว — สร้างรอบย้อนหลังไม่ได้ เพราะยอดสะสมภาษี/สปส. จะผิด",
                "A later pay run is already locked — you cannot add an earlier one because year-to-date tax and social security would be wrong"));

        var rules = await ResolveRulesAsync(end, ct);
        var run = new PayRun
        {
            PeriodStart = start,
            PeriodEnd = end,
            Status = PayRunStatus.Draft,
            PayDate = payDate ?? end,
            RuleSetEffectiveFrom = rules.EffectiveFrom,
            RulesSnapshot = rules.Rules,
        };
        db.PayRuns.Add(run);
        await CalculateAsync(run, ct);
        await db.SaveChangesAsync(ct);
        return run;
    }

    public async Task<PayRun> RecalculateAsync(Guid id, CancellationToken ct)
    {
        var run = await LoadDraftAsync(id, ct);
        await CalculateAsync(run, ct);
        await db.SaveChangesAsync(ct);
        return run;
    }

    /// <summary>
    /// คำนวณใหม่ก่อน lock — ถ้าผลต่างจาก draft ที่เจ้าของเห็นล่าสุด (ข้อมูลถูกแก้ระหว่างนั้น)
    /// จะไม่ lock แต่บันทึก draft ใหม่ให้ตรวจอีกครั้ง
    /// </summary>
    public async Task<PayRun> LockAsync(Guid id, Guid userId, CancellationToken ct)
    {
        var run = await LoadDraftAsync(id, ct);
        var before = Fingerprint(run);
        await CalculateAsync(run, ct);

        if (Fingerprint(run) != before)
        {
            await db.SaveChangesAsync(ct);
            throw new PayRunException(L.T("ข้อมูลเปลี่ยนตั้งแต่คำนวณครั้งล่าสุด — คำนวณใหม่ให้แล้ว กรุณาตรวจอีกครั้งก่อนปิดรอบ",
                "Data changed since the last calculation — it has been recalculated, please review again before locking"));
        }
        if (run.Items.Count == 0) throw new PayRunException(L.T("รอบนี้ไม่มีพนักงานที่ต้องจ่าย", "Nobody to pay in this pay run"));

        run.Status = PayRunStatus.Locked;
        run.LockedAt = clock.GetUtcNow();
        run.LockedBy = userId;
        await db.SaveChangesAsync(ct);
        return run;
    }

    /// <summary>เปลี่ยนวันจ่ายได้เฉพาะรอบร่าง — รอบที่ปิดแล้วยื่น ภ.ง.ด.1 ตามวันจ่ายนั้นไปแล้ว</summary>
    public async Task<PayRun> SetPayDateAsync(Guid id, DateOnly payDate, CancellationToken ct)
    {
        var run = await LoadDraftAsync(id, ct);
        ValidatePayDate(run.PeriodStart, run.PeriodEnd, payDate);
        run.PayDate = payDate;
        await db.SaveChangesAsync(ct);
        return run;
    }

    /// <summary>
    /// วันจ่ายต้องไม่ก่อนวันเริ่มรอบ และอยู่ในปีเดียวกัน — ยอดสะสมภาษีคิดตามปีของรอบ
    /// ถ้าจ่ายข้ามปี (ค่าจ้าง ธ.ค. จ่าย ม.ค.) ภ.ง.ด.1 กับยอดสะสมจะไม่ตรงกัน จึงยังไม่รองรับ
    /// </summary>
    private static void ValidatePayDate(DateOnly start, DateOnly end, DateOnly payDate)
    {
        if (payDate < start || payDate.Year != start.Year || payDate.DayNumber - end.DayNumber > 31)
            throw new PayRunException(L.T(
                "วันจ่ายต้องไม่ก่อนวันเริ่มรอบ ไม่เกิน 31 วันหลังสิ้นรอบ และอยู่ในปีเดียวกับรอบ",
                "Pay date must be on or after the period start, within 31 days of the period end, and in the same year"),
                StatusCodes.Status400BadRequest);
    }

    public async Task DeleteDraftAsync(Guid id, CancellationToken ct)
    {
        var run = await LoadDraftAsync(id, ct);
        db.PayRuns.Remove(run);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>วันนี้อยู่ในรอบจ่ายที่ปิดแล้วไหม — ใช้กันแก้ข้อมูลเวลาทำงาน/ผลงานย้อนหลัง</summary>
    public Task<bool> IsLockedAsync(DateOnly date, CancellationToken ct) =>
        db.PayRuns.AnyAsync(r => r.Status == PayRunStatus.Locked && r.PeriodStart <= date && date <= r.PeriodEnd, ct);

    // ---------- internals ----------

    private async Task<PayRun> LoadDraftAsync(Guid id, CancellationToken ct)
    {
        var run = await db.PayRuns.Include(r => r.Items).SingleOrDefaultAsync(r => r.Id == id, ct)
                  ?? throw new PayRunException(L.T("ไม่พบรอบจ่าย", "Pay run not found"), StatusCodes.Status404NotFound);
        if (run.Status != PayRunStatus.Draft) throw new PayRunException(L.T("รอบนี้ปิดแล้ว แก้ไขไม่ได้", "This pay run is locked and cannot be changed"));
        return run;
    }

    private async Task<EffectiveRuleSet> ResolveRulesAsync(DateOnly date, CancellationToken ct)
    {
        var sets = await db.LegalRuleSets.AsNoTracking().ToListAsync(ct);
        return RuleResolver.Resolve(sets.Select(s => new EffectiveRuleSet(s.EffectiveFrom, s.Payload)), date);
    }

    private async Task CalculateAsync(PayRun run, CancellationToken ct)
    {
        var (start, end) = (run.PeriodStart, run.PeriodEnd);
        var rules = run.RulesSnapshot;

        var workDays = (await db.WorkDays.AsNoTracking().Where(w => w.Date >= start && w.Date <= end).ToListAsync(ct))
            .ToLookup(w => w.EmployeeId);
        var pieces = (await db.PieceWorkEntries.AsNoTracking().Where(p => p.Date >= start && p.Date <= end).ToListAsync(ct))
            .ToLookup(p => p.EmployeeId);
        var holidays = await db.Holidays.AsNoTracking().Where(h => h.Date >= start && h.Date <= end).ToListAsync(ct);

        var withData = workDays.Select(g => g.Key).Concat(pieces.Select(g => g.Key)).ToHashSet();
        var employees = await db.Employees.AsNoTracking().Include(e => e.Branch)
            .Where(e => e.Status == EmployeeStatus.Active || withData.Contains(e.Id))
            .OrderBy(e => e.FirstName)
            .ToListAsync(ct);

        var minimumWages = await db.MinimumWages.AsNoTracking().ToListAsync(ct);
        var history = await LockedHistoryAsync(start, ct);
        var openings = await db.OpeningBalances.AsNoTracking().Where(o => o.Year == start.Year)
            .ToDictionaryAsync(o => o.EmployeeId, ct);
        var advances = await OutstandingAdvancesAsync(end, ct);

        db.PayRunItems.RemoveRange(run.Items);
        run.Items.Clear();

        foreach (var employee in employees)
        {
            var days = workDays[employee.Id].Select(w => w.ToDayRecord()).ToList();
            // วันหยุดนักขัตฤกษ์ของร้านที่ยังไม่มีบันทึก → นับเป็นวันหยุดที่ไม่ได้มาทำ (รายวัน/ชิ้นได้ค่าจ้าง)
            days.AddRange(holidays
                .Where(h => days.All(d => d.Date != h.Date))
                .Select(h => new DayRecord(h.Date, DayKind.PublicHoliday)));

            var minimum = employee.Branch is { } branch
                ? RuleResolver.ResolveMinimumWage(minimumWages.Select(m => m.ToRate()), branch.ProvinceCode, branch.AreaCode, end)
                : null;

            var ytd = history.Where(h => h.EmployeeId == employee.Id && h.PeriodStart.Year == start.Year).ToList();
            var mtd = ytd.Where(h => h.PeriodStart.Month == start.Month).ToList();
            var opening = openings.GetValueOrDefault(employee.Id);

            var input = new PayInput
            {
                Employee = new EmployeePayProfile(ToBasis(employee.PayType), employee.BaseRate, employee.WorkerType == WorkerType.Freelance),
                Period = new PayPeriod(start, end),
                Days = days.OrderBy(d => d.Date).ToList(),
                PieceWork = pieces[employee.Id].OrderBy(p => p.Date).Select(p => p.ToPieceEntry()).ToList(),
                OutstandingAdvances = advances.GetValueOrDefault(employee.Id),
                MinimumDailyWage = minimum?.DailyRate,
                MinimumWageVerified = minimum?.Verified ?? false,
                YearToDate = new YearToDate(
                    (opening?.TaxableIncome ?? 0) + ytd.Sum(h => h.TaxableIncome),
                    (opening?.TaxWithheld ?? 0) + ytd.Sum(h => h.WithholdingTax),
                    (opening?.SocialSecurity ?? 0) + ytd.Sum(h => h.SocialSecurityEmployee)),
                MonthToDate = new MonthToDate(mtd.Sum(h => h.SocialSecurityWage), mtd.Sum(h => h.SocialSecurityEmployee)),
                RemainingPeriodsInYear = RemainingPeriods(start, end),
            };

            var result = PayrollCalculator.Calculate(input, rules);
            var warnings = result.Warnings.ToList();
            if (employee.Branch is null) warnings.Insert(0, new LocalizedText("พนักงานยังไม่ได้ระบุสาขา — ไม่รู้ค่าแรงขั้นต่ำ", "No branch set for this employee — minimum wage unknown"));
            if (start.Month > 1 && ytd.Count == 0 && opening is null && !input.Employee.IsFreelance && result.TaxableIncome > 0)
                warnings.Add(new LocalizedText(
                    "ยังไม่มียอดสะสมต้นปี — ถ้าพนักงานมีรายได้ก่อนหน้านี้ในปีนี้ ให้กรอก \"ยอดยกมา\" ไม่งั้นภาษีหัก ณ ที่จ่ายจะต่ำไป",
                    "No year-to-date opening balance — if this employee earned income earlier this year, enter an opening balance or tax withheld will be too low"));

            // ไม่มีอะไรต้องจ่ายและไม่มีอะไรให้หัก → ไม่ต้องมีในรอบนี้
            if (result.Lines.Count == 0 && input.OutstandingAdvances == 0) continue;

            // ต้อง Add ตรงๆ: Id สร้างฝั่ง client แล้ว ถ้าเพิ่มผ่าน navigation อย่างเดียว EF จะคิดว่าเป็นแถวเดิมแล้ว UPDATE
            var item = new PayRunItem
            {
                TenantId = run.TenantId,
                PayRunId = run.Id,
                EmployeeId = employee.Id,
                EmployeeName = $"{employee.FirstName} {employee.LastName}".Trim(),
                PayType = employee.PayType,
                IsFreelance = input.Employee.IsFreelance,
                Gross = result.Gross,
                TaxableIncome = result.TaxableIncome,
                SocialSecurityWage = result.SocialSecurityWage,
                SocialSecurityEmployee = result.SocialSecurityEmployee,
                SocialSecurityEmployer = result.SocialSecurityEmployer,
                WithholdingTax = result.WithholdingTax,
                AdvanceDeducted = result.AdvanceDeducted,
                AdvanceCarriedOver = result.AdvanceCarriedOver,
                Net = result.Net,
                Lines = result.Lines.ToList(),
                Warnings = warnings,
                Input = input,
            };
            db.PayRunItems.Add(item); // EF ใส่เข้า run.Items ให้เองจาก PayRunId (relationship fixup)
        }

        run.CalculatedAt = clock.GetUtcNow();
    }

    private sealed record HistoryRow(
        Guid EmployeeId, DateOnly PeriodStart, decimal TaxableIncome, decimal WithholdingTax,
        decimal SocialSecurityEmployee, decimal SocialSecurityWage);

    /// <summary>ผลของรอบที่ปิดแล้วก่อนรอบนี้ในปีเดียวกัน — ใช้คิดยอดสะสม</summary>
    private async Task<List<HistoryRow>> LockedHistoryAsync(DateOnly before, CancellationToken ct)
    {
        var periods = await db.PayRuns.AsNoTracking()
            .Where(r => r.Status == PayRunStatus.Locked && r.PeriodEnd < before && r.PeriodStart.Year == before.Year)
            .ToDictionaryAsync(r => r.Id, r => r.PeriodStart, ct);
        var runIds = periods.Keys.ToList();

        var items = await db.PayRunItems.AsNoTracking().Where(i => runIds.Contains(i.PayRunId))
            .Select(i => new { i.PayRunId, i.EmployeeId, i.TaxableIncome, i.WithholdingTax, i.SocialSecurityEmployee, i.SocialSecurityWage })
            .ToListAsync(ct);

        return items.Select(i => new HistoryRow(
            i.EmployeeId, periods[i.PayRunId], i.TaxableIncome, i.WithholdingTax, i.SocialSecurityEmployee, i.SocialSecurityWage)).ToList();
    }

    private async Task<Dictionary<Guid, decimal>> OutstandingAdvancesAsync(DateOnly asOf, CancellationToken ct)
    {
        var given = await db.Advances.AsNoTracking().Where(a => a.Date <= asOf)
            .GroupBy(a => a.EmployeeId).Select(g => new { g.Key, Sum = g.Sum(a => a.Amount) })
            .ToDictionaryAsync(x => x.Key, x => x.Sum, ct);
        var lockedRuns = await db.PayRuns.AsNoTracking().Where(r => r.Status == PayRunStatus.Locked).Select(r => r.Id).ToListAsync(ct);
        var deducted = await db.PayRunItems.AsNoTracking().Where(i => lockedRuns.Contains(i.PayRunId))
            .GroupBy(i => i.EmployeeId).Select(g => new { g.Key, Sum = g.Sum(i => i.AdvanceDeducted) })
            .ToDictionaryAsync(x => x.Key, x => x.Sum, ct);

        return given.ToDictionary(g => g.Key, g => Math.Max(0, g.Value - deducted.GetValueOrDefault(g.Key)));
    }

    /// <summary>จำนวนรอบที่เหลือในปี รวมรอบนี้ — ประมาณจากความยาวรอบ (รายเดือน = นับเดือนที่เหลือพอดี)</summary>
    public static int RemainingPeriods(DateOnly start, DateOnly end)
    {
        var period = new PayPeriod(start, end);
        if (period.IsFullCalendarMonth) return 13 - start.Month;

        var daysLeft = new DateOnly(start.Year, 12, 31).DayNumber - start.DayNumber + 1;
        return Math.Max(1, (int)Math.Round(daysLeft / (decimal)period.Days, MidpointRounding.AwayFromZero));
    }

    private static PayBasis ToBasis(PayType type) => type switch
    {
        PayType.Monthly => PayBasis.Monthly,
        PayType.Daily => PayBasis.Daily,
        PayType.Hourly => PayBasis.Hourly,
        PayType.Piece => PayBasis.Piece,
        _ => throw new ArgumentOutOfRangeException(nameof(type)),
    };

    /// <summary>
    /// format ตัวเลขแบบตายตัว: ค่าที่โหลดจาก numeric(14,2) ได้ "900.00" แต่ค่าที่เพิ่งคำนวณอาจเป็น "900"
    /// (decimal scale ต่างกัน) — ถ้าใช้ ToString() ธรรมดาจะคิดว่าข้อมูลเปลี่ยนทั้งที่ไม่เปลี่ยน
    /// </summary>
    private static string Fingerprint(PayRun run) =>
        string.Join("|", run.Items.OrderBy(i => i.EmployeeId).Select(i => string.Join(":",
            i.EmployeeId, Money(i.Gross), Money(i.Net), Money(i.WithholdingTax), Money(i.SocialSecurityEmployee), Money(i.AdvanceDeducted))));

    private static string Money(decimal v) => v.ToString("F2", System.Globalization.CultureInfo.InvariantCulture);
}
