using Jangna.Api.Localization;
using Jangna.Core.Entities;
using Jangna.Core.Tenancy;
using Jangna.Infrastructure.Persistence;
using Jangna.Payroll.Engine.Model;
using Microsoft.EntityFrameworkCore;

namespace Jangna.Api.Exports;

public sealed class ExportException(string message, int status) : Exception(message)
{
    public int Status { get; } = status;
}

/// <summary>
/// เอกสารนำส่งรายเดือนจากรอบจ่ายที่ปิดแล้วเท่านั้น
/// - สปส.1-10: รอบที่ "งวดค่าจ้าง" (PeriodStart) อยู่ในเดือนนั้น
/// - ภ.ง.ด.1: รอบที่ "วันจ่าย" (PayDate) อยู่ในเดือนนั้น — ภาษีหัก ณ ที่จ่ายยื่นตามเดือนที่จ่ายเงิน
/// </summary>
public sealed class ExportService(JangnaDbContext db, ITenantContext tenantContext)
{
    public sealed record SsoSummary(int Employees, decimal Wages, decimal EmployeeContribution, decimal EmployerContribution, IReadOnlyList<LocalizedText> Issues);

    public sealed record Pnd1Summary(int Employees, decimal Paid, decimal Tax, IReadOnlyList<LocalizedText> Issues);

    public sealed record MonthSummary(int Year, int Month, int LockedRuns, int DraftRuns, SsoSummary Sso, Pnd1Summary Pnd1);

    public sealed record FileResult(byte[] Content, string ContentType, string FileName);

    public async Task<MonthSummary> SummaryAsync(int year, int month, CancellationToken ct)
    {
        var (start, end) = MonthRange(year, month);
        var tenant = await TenantAsync(ct);
        var sso = await SsoDataAsync(tenant, year, month, ct);
        var pnd1 = await Pnd1DataAsync(tenant, year, month, ct);
        var runs = await db.PayRuns.AsNoTracking()
            .Where(r => (r.PeriodStart >= start && r.PeriodStart <= end) || (r.PayDate >= start && r.PayDate <= end))
            .Select(r => r.Status).ToListAsync(ct);

        return new MonthSummary(year, month,
            runs.Count(s => s == PayRunStatus.Locked), runs.Count(s => s == PayRunStatus.Draft),
            new SsoSummary(sso.Rows.Count, sso.Rows.Sum(r => r.Wage), sso.Rows.Sum(r => r.Contribution), sso.Employer, sso.Issues),
            new Pnd1Summary(pnd1.Rows.Select(r => r.NationalId).Distinct().Count(), pnd1.Rows.Sum(r => r.PaidAmount), pnd1.Rows.Sum(r => r.Tax), pnd1.Issues));
    }

    /// <summary>paymentDate = วันที่จะชำระเงินสมทบ (ภายในวันที่ 15 ของเดือนถัดไป)</summary>
    public async Task<FileResult> SsoAsync(int year, int month, DateOnly paymentDate, CancellationToken ct)
    {
        MonthRange(year, month);
        var tenant = await TenantAsync(ct);
        var data = await SsoDataAsync(tenant, year, month, ct);
        if (data.Issues.Count > 0) throw new ExportException(L.T(data.Issues[0]), 422);
        if (data.Rows.Count == 0)
            throw new ExportException(L.T("เดือนนี้ไม่มีรอบจ่ายที่ปิดแล้วที่มีผู้ประกันตน", "No locked pay runs with insured employees in this month"), 404);

        var header = new SsoFile.Header(tenant.SsoAccountNo!, tenant.SsoBranchNo, paymentDate, year, month, tenant.DisplayName, data.Rate);
        var content = SsoFile.Build(header, data.Rows, data.Employer);
        return new FileResult(SsoFile.Encode(content), "text/plain; charset=windows-874",
            $"SSO1-10_{tenant.SsoAccountNo}_{year}{month:00}.txt");
    }

    public async Task<FileResult> Pnd1Async(int year, int month, CancellationToken ct)
    {
        MonthRange(year, month);
        var tenant = await TenantAsync(ct);
        var data = await Pnd1DataAsync(tenant, year, month, ct);
        if (data.Issues.Count > 0) throw new ExportException(L.T(data.Issues[0]), 422);
        if (data.Rows.Count == 0)
            throw new ExportException(L.T("เดือนนี้ไม่มีภาษีหัก ณ ที่จ่ายจากรอบที่ปิดแล้ว — ไม่ต้องยื่น ภ.ง.ด.1", "No tax withheld in locked pay runs this month — no PND 1 to file"), 404);

        var header = new Pnd1File.Header(tenant.TaxId!, tenant.TaxBranchNo, year, month, tenant.RdUserId);
        var content = Pnd1File.Build(header, data.Rows);
        return new FileResult(System.Text.Encoding.UTF8.GetBytes(content), "text/plain; charset=utf-8", Pnd1File.FileName(header));
    }

    /// <summary>
    /// สลิปของรอบที่ปิดแล้ว — lang: "th" / "en" / null = ตามภาษาของพนักงานแต่ละคน (my → อังกฤษ ไปก่อน)
    /// </summary>
    public async Task<FileResult> PayslipsAsync(Guid runId, Guid? employeeId, string? lang, CancellationToken ct)
    {
        var run = await db.PayRuns.AsNoTracking().Include(r => r.Items).SingleOrDefaultAsync(r => r.Id == runId, ct)
                  ?? throw new ExportException(L.T("ไม่พบรอบจ่าย", "Pay run not found"), 404);
        if (run.Status != PayRunStatus.Locked)
            throw new ExportException(L.T("ออกสลิปได้หลังปิดรอบแล้วเท่านั้น", "Payslips are available once the pay run is locked"), 409);

        var items = run.Items.Where(i => employeeId is null || i.EmployeeId == employeeId).OrderBy(i => i.EmployeeName).ToList();
        if (items.Count == 0) throw new ExportException(L.T("ไม่พบพนักงานในรอบนี้", "Employee not in this pay run"), 404);

        var tenant = await TenantAsync(ct);
        var ids = items.Select(i => i.EmployeeId).ToList();
        var employees = await db.Employees.AsNoTracking().Where(e => ids.Contains(e.Id)).ToDictionaryAsync(e => e.Id, ct);

        var slips = items.Select(i =>
        {
            var employee = employees.GetValueOrDefault(i.EmployeeId);
            var english = lang switch
            {
                "en" => true,
                "th" => false,
                _ => employee?.Language is "en" or "my",
            };
            var ytd = i.Input.YearToDate;
            return new PayslipPdf.Slip(
                tenant.DisplayName, tenant.Address, tenant.TaxId,
                i.EmployeeName, employee?.NationalId, i.PayType, i.IsFreelance,
                run.PeriodStart, run.PeriodEnd, run.PayDate,
                i.Lines, i.Gross, i.Net, i.SocialSecurityEmployer,
                ytd.TaxableIncome + i.TaxableIncome, ytd.TaxWithheld + i.WithholdingTax, ytd.SocialSecurity + i.SocialSecurityEmployee,
                english);
        }).ToList();

        var name = items.Count == 1 ? $"payslip_{run.PeriodStart:yyyy-MM-dd}_{Safe(items[0].EmployeeName)}.pdf" : $"payslips_{run.PeriodStart:yyyy-MM-dd}.pdf";
        return new FileResult(PayslipPdf.Render(slips), "application/pdf", name);
    }

    // ---------- data ----------

    private sealed record SsoData(List<SsoFile.Row> Rows, decimal Employer, decimal Rate, List<LocalizedText> Issues);

    private async Task<SsoData> SsoDataAsync(Tenant tenant, int year, int month, CancellationToken ct)
    {
        var (start, end) = MonthRange(year, month);
        var runs = await db.PayRuns.AsNoTracking().Include(r => r.Items)
            .Where(r => r.Status == PayRunStatus.Locked && r.PeriodStart >= start && r.PeriodStart <= end)
            .OrderBy(r => r.PeriodStart).ToListAsync(ct);
        var issues = new List<LocalizedText>();
        if (runs.Count == 0) return new SsoData([], 0, 0, issues);

        var rule = runs[^1].RulesSnapshot.SocialSecurity;
        var items = runs.SelectMany(r => r.Items).Where(i => !i.IsFreelance && i.SocialSecurityWage > 0).ToList();
        if (items.Count == 0) return new SsoData([], 0, rule.Rate, issues);
        var employees = await EmployeesAsync(items.Select(i => i.EmployeeId), ct);

        if (!IsDigits(tenant.SsoAccountNo, 10))
            issues.Add(new("ยังไม่ได้กรอกเลขที่บัญชีนายจ้าง สปส. (10 หลัก) ในหน้าตั้งค่าร้าน", "Employer social security account no. (10 digits) is missing — see Shop settings"));
        if (!IsDigits(tenant.SsoBranchNo, 6))
            issues.Add(new("ลำดับที่สาขา สปส. ต้องเป็นตัวเลข 6 หลัก", "Social security branch no. must be 6 digits"));

        var rows = new List<SsoFile.Row>();
        var employer = 0m;
        foreach (var group in items.GroupBy(i => i.EmployeeId))
        {
            var e = employees.GetValueOrDefault(group.Key);
            var name = e is null ? group.First().EmployeeName : $"{e.FirstName} {e.LastName}".Trim();
            if (e is null || !IsDigits(e.NationalId, 13))
                issues.Add(new($"{name}: ยังไม่มีเลขประจำตัวประชาชน/เลขประกันสังคม 13 หลัก", $"{name}: national ID / social security no. (13 digits) is missing"));
            if (e?.Title is null)
                issues.Add(new($"{name}: ยังไม่ได้เลือกคำนำหน้าชื่อ", $"{name}: title (Mr/Mrs/Miss) is missing"));
            if (e is null || !IsDigits(e.NationalId, 13) || e.Title is null) continue;

            // ค่าจ้างที่แจ้ง = ค่าจ้างทั้งเดือนตัดตามฐานต่ำสุด/สูงสุด ให้ตรงกับเงินสมทบที่คิดไว้
            var wage = Math.Clamp(group.Sum(i => i.SocialSecurityWage), rule.MinMonthlyBase, rule.MaxMonthlyBase);
            rows.Add(new SsoFile.Row(e.NationalId!, SsoFile.TitleCode(e.Title.Value), e.FirstName, e.LastName, wage,
                group.Sum(i => i.SocialSecurityEmployee)));
            employer += group.Sum(i => i.SocialSecurityEmployer);
        }

        return new SsoData(rows.OrderBy(r => r.FirstName).ToList(), employer, rule.Rate, issues);
    }

    private sealed record Pnd1Data(List<Pnd1File.Row> Rows, List<LocalizedText> Issues);

    private async Task<Pnd1Data> Pnd1DataAsync(Tenant tenant, int year, int month, CancellationToken ct)
    {
        var (start, end) = MonthRange(year, month);
        var runs = await db.PayRuns.AsNoTracking().Include(r => r.Items)
            .Where(r => r.Status == PayRunStatus.Locked && r.PayDate >= start && r.PayDate <= end)
            .OrderBy(r => r.PayDate).ToListAsync(ct);
        var issues = new List<LocalizedText>();
        var items = runs.SelectMany(r => r.Items.Select(i => (Run: r, Item: i)))
            .Where(x => !x.Item.IsFreelance && x.Item.WithholdingTax > 0).ToList();
        if (items.Count == 0) return new Pnd1Data([], issues);

        if (!IsDigits(tenant.TaxId, 13))
            issues.Add(new("ยังไม่ได้กรอกเลขประจำตัวผู้เสียภาษีของร้าน (13 หลัก) ในหน้าตั้งค่าร้าน", "Shop tax ID (13 digits) is missing — see Shop settings"));
        if (!IsDigits(tenant.TaxBranchNo, 6))
            issues.Add(new("สาขาภาษี ต้องเป็นตัวเลข 6 หลัก (สำนักงานใหญ่ 000000)", "Tax branch no. must be 6 digits (head office 000000)"));

        var employees = await EmployeesAsync(items.Select(x => x.Item.EmployeeId), ct);
        var rows = new List<Pnd1File.Row>();
        var reported = new HashSet<Guid>();
        foreach (var (run, item) in items)
        {
            var e = employees.GetValueOrDefault(item.EmployeeId);
            var ok = e is not null && IsDigits(e.NationalId, 13) && !string.IsNullOrWhiteSpace(e.District)
                     && !string.IsNullOrWhiteSpace(e.Province) && IsDigits(e.PostalCode, 5);
            if (!ok)
            {
                if (reported.Add(item.EmployeeId))
                    issues.Add(new($"{item.EmployeeName}: ต้องมีเลขประจำตัวประชาชน และที่อยู่ (อำเภอ/เขต จังหวัด รหัสไปรษณีย์)",
                        $"{item.EmployeeName}: national ID and address (district, province, postal code) are required"));
                continue;
            }
            rows.Add(new Pnd1File.Row(e!.NationalId!, Pnd1File.TitleText(e.Title), e.FirstName, e.LastName, run.PayDate,
                item.TaxableIncome, item.WithholdingTax, e.AddressLine, e.Subdistrict, e.District!, e.Province!, e.PostalCode!));
        }
        return new Pnd1Data(rows, issues);
    }

    private async Task<Dictionary<Guid, Employee>> EmployeesAsync(IEnumerable<Guid> ids, CancellationToken ct)
    {
        var list = ids.Distinct().ToList();
        return await db.Employees.AsNoTracking().Where(e => list.Contains(e.Id)).ToDictionaryAsync(e => e.Id, ct);
    }

    private async Task<Tenant> TenantAsync(CancellationToken ct) =>
        await db.Tenants.AsNoTracking().SingleAsync(t => t.Id == tenantContext.TenantId, ct);

    private static (DateOnly Start, DateOnly End) MonthRange(int year, int month)
    {
        if (year is < 2000 or > 2100 || month is < 1 or > 12)
            throw new ExportException(L.T("เดือน/ปีไม่ถูกต้อง", "Invalid month or year"), 400);
        var start = new DateOnly(year, month, 1);
        return (start, start.AddMonths(1).AddDays(-1));
    }

    private static bool IsDigits(string? value, int length) => value is not null && value.Length == length && value.All(char.IsAsciiDigit);

    private static string Safe(string name) => string.Concat(name.Select(c => char.IsLetterOrDigit(c) ? c : '_'));
}
