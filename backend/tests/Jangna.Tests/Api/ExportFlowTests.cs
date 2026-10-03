using System.Net;
using System.Net.Http.Json;
using System.Text;
using Jangna.Api.Endpoints;
using Jangna.Api.Exports;
using Jangna.Core.Entities;
using Jangna.Payroll.Engine.Model;

namespace Jangna.Tests.Api;

public class ExportFlowTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private const string NationalId = "1101700203450";

    /// <summary>
    /// ร้าน 1 คน เงินเดือน 50,000 รอบ ต.ค. 2026 + ยอดยกมา 450,000 (ภาษี 0, สปส. 7,875)
    /// คิดมือ (docs/payroll.md): ภาษีหัก 6,816.67, สปส. ฐานเพดาน 17,500 × 5% = 875
    /// </summary>
    private async Task<(HttpClient Http, Guid Employee, Guid Run)> LockedOctoberRun(bool withFilingInfo = true)
    {
        var http = await factory.RegisterShopAsync("ร้านส่งออก", $"export-{Guid.NewGuid():N}@test.local");
        var branch = (await (await http.PostAsJsonAsync("/api/branches", new OrgEndpoints.BranchRequest("สาขา", "TH-10", null, null, null, null)))
            .Content.ReadFromJsonAsync<OrgEndpoints.BranchDto>(Json.Options))!.Id;

        var request = new EmployeeEndpoints.EmployeeRequest("สมชาย", "ใจดี", null, null, branch, PayType.Monthly, 50_000m, WorkerType.Employee, "th",
            withFilingInfo ? Title.Mr : null, withFilingInfo ? NationalId : null, "12/3 หมู่ 4", "พญาไท", withFilingInfo ? "ราชเทวี" : null,
            withFilingInfo ? "กรุงเทพมหานคร" : null, withFilingInfo ? "10400" : null);
        var created = await http.PostAsJsonAsync("/api/employees", request, Json.Options);
        Assert.True(created.IsSuccessStatusCode, await created.Content.ReadAsStringAsync());
        var employee = (await created.Content.ReadFromJsonAsync<EmployeeEndpoints.EmployeeDto>(Json.Options))!.Id;

        (await http.PutAsJsonAsync("/api/opening-balances",
            new WorkEndpoints.OpeningBalanceRequest(employee, 2026, 450_000m, 0m, 7_875m, null))).EnsureSuccessStatusCode();

        if (withFilingInfo)
        {
            var shop = await http.PutAsJsonAsync("/api/shop", new OrgEndpoints.ShopDto(
                "ร้านส่งออก", "บริษัท ส่งออก จำกัด", "1 ถนนพญาไท กรุงเทพฯ", "1234567890121", "000000", "1234567890", "000000", null));
            Assert.True(shop.IsSuccessStatusCode, await shop.Content.ReadAsStringAsync());
        }

        var run = (await (await http.PostAsJsonAsync("/api/pay-runs",
                new PayRunEndpoints.CreatePayRunRequest(new(2026, 10, 1), new(2026, 10, 31), new(2026, 10, 30)), Json.Options))
            .Content.ReadFromJsonAsync<PayRunEndpoints.PayRunDetail>(Json.Options))!;
        var item = Assert.Single(run.Items);
        Assert.Equal(6_816.67m, item.WithholdingTax);
        Assert.Equal(875m, item.SocialSecurityEmployee);
        Assert.Equal(new DateOnly(2026, 10, 30), run.Summary.PayDate);

        (await http.PostAsync($"/api/pay-runs/{run.Summary.Id}/lock", null)).EnsureSuccessStatusCode();
        return (http, employee, run.Summary.Id);
    }

    [Fact]
    public async Task Summary_and_files_for_a_locked_month()
    {
        var (http, _, _) = await LockedOctoberRun();

        var summary = (await http.GetFromJsonAsync<ExportService.MonthSummary>("/api/exports/summary?year=2026&month=10", Json.Options))!;
        Assert.Equal(1, summary.LockedRuns);
        Assert.Equal(17_500m, summary.Sso.Wages);
        Assert.Equal(875m, summary.Sso.EmployeeContribution);
        Assert.Equal(875m, summary.Sso.EmployerContribution);
        Assert.Empty(summary.Sso.Issues);
        Assert.Equal(6_816.67m, summary.Pnd1.Tax);
        Assert.Empty(summary.Pnd1.Issues);

        var sso = await http.GetAsync("/api/exports/sso?year=2026&month=10&paymentDate=2026-11-15");
        Assert.Equal(HttpStatusCode.OK, sso.StatusCode);
        Assert.Equal("SSO1-10_1234567890_202610.txt", sso.Content.Headers.ContentDisposition?.FileName);
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        var ssoLines = Encoding.GetEncoding(874).GetString(await sso.Content.ReadAsByteArrayAsync()).Split("\r\n", StringSplitOptions.RemoveEmptyEntries);
        Assert.Equal(2, ssoLines.Length);
        Assert.StartsWith("11234567890000000151169" + "1069" + "บริษัท ส่งออก จำกัด", ssoLines[0]);
        Assert.EndsWith("0500" + "000001" + "000000001750000" + "00000000175000" + "000000087500" + "000000087500", ssoLines[0]);
        Assert.StartsWith("2" + NationalId + "003" + "สมชาย", ssoLines[1]);
        Assert.Contains("00000001750000" + "000000087500", ssoLines[1]);

        var pnd1 = await http.GetAsync("/api/exports/pnd1?year=2026&month=10");
        Assert.Equal(HttpStatusCode.OK, pnd1.StatusCode);
        var pndLines = (await pnd1.Content.ReadAsStringAsync()).Split("\r\n", StringSplitOptions.RemoveEmptyEntries);
        Assert.Contains("|1|50000.00|6816.67|0.00|6816.67|0.00||1", pndLines[0]);
        Assert.Equal(
            $"D|1|000000|{NationalId}|0000000000|นาย|สมชาย|ใจดี|30102569|0.00|50000.00|6816.67|1|1|||||12-3 หมู่ 4||||พญาไท|ราชเทวี|กรุงเทพมหานคร|10400",
            pndLines[1]);
    }

    /// <summary>
    /// ลูกจ้างเดือน 50,000 (ภาษี 6,816.67 เมื่อมียอดยกมา 450,000) + ฟรีแลนซ์เดือน 10,000 → หัก 3% = 300.00
    /// </summary>
    [Fact]
    public async Task Freelancer_pnd3_annual_pnd1a_and_certificates()
    {
        var (http, _, _) = await LockedOctoberRun();
        var freelancer = new EmployeeEndpoints.EmployeeRequest("มานี", "รับจ้าง", null, null, null, PayType.Monthly, 10_000m, WorkerType.Freelance, "th",
            Title.Miss, "1101700203468", "9 ถนนสุข", "บางรัก", "บางรัก", "กรุงเทพมหานคร", "10500");
        Assert.Equal(HttpStatusCode.Created, (await http.PostAsJsonAsync("/api/employees", freelancer, Json.Options)).StatusCode);

        var run = (await (await http.PostAsJsonAsync("/api/pay-runs",
                new PayRunEndpoints.CreatePayRunRequest(new(2026, 11, 1), new(2026, 11, 30), new(2026, 11, 30)), Json.Options))
            .Content.ReadFromJsonAsync<PayRunEndpoints.PayRunDetail>(Json.Options))!;
        var free = run.Items.Single(i => i.IsFreelance);
        Assert.Equal(10_000m, free.Gross);
        Assert.Equal(300m, free.WithholdingTax);
        (await http.PostAsync($"/api/pay-runs/{run.Summary.Id}/lock", null)).EnsureSuccessStatusCode();

        var month = (await http.GetFromJsonAsync<ExportService.MonthSummary>("/api/exports/summary?year=2026&month=11", Json.Options))!;
        Assert.Equal(1, month.Pnd3.Employees);
        Assert.Equal(300m, month.Pnd3.Tax);
        Assert.Empty(month.Pnd3.Issues);

        var pnd3 = await http.GetAsync("/api/exports/pnd3?year=2026&month=11");
        Assert.Equal(HttpStatusCode.OK, pnd3.StatusCode);
        Assert.Equal($"PND3_1234567890121_000000_2569_11.csv", pnd3.Content.Headers.ContentDisposition?.FileName);
        var csv = (await pnd3.Content.ReadAsStringAsync()).Split("\r\n", StringSplitOptions.RemoveEmptyEntries);
        Assert.Equal(2, csv.Length);
        Assert.Contains("\"1101700203468\",\"นางสาว\",\"มานี\",\"รับจ้าง\"", csv[1]);
        Assert.EndsWith("\"30/11/2569\",\"ค่าจ้างทำของ/บริการ\",\"3\",\"10000.00\",\"300.00\",\"1\"", csv[1]);
        Assert.Equal(HttpStatusCode.NotFound, (await http.GetAsync("/api/exports/pnd3?year=2026&month=10")).StatusCode);

        // ลูกจ้างไม่อยู่ใน ภ.ง.ด.3 และฟรีแลนซ์ไม่อยู่ใน ภ.ง.ด.1
        var pnd1 = (await http.GetStringAsync("/api/exports/pnd1?year=2026&month=11")).Split("\r\n", StringSplitOptions.RemoveEmptyEntries);
        Assert.Equal(2, pnd1.Length);
        Assert.DoesNotContain("1101700203468", string.Join('\n', pnd1));

        var year = (await http.GetFromJsonAsync<ExportService.YearSummary>("/api/exports/year-summary?year=2026", Json.Options))!;
        Assert.Equal(2, year.LockedRuns);
        Assert.Equal(1, year.Pnd1A.Employees);
        Assert.Equal(2, year.Certificates.Employees);
        Assert.Equal(50_000m + 50_000m, year.Pnd1A.Paid); // ต.ค. + พ.ย. ของลูกจ้าง
        Assert.Equal(300m + year.Pnd1A.Tax, year.Certificates.Tax);

        var pnd1a = await http.GetAsync("/api/exports/pnd1a?year=2026");
        Assert.Equal(HttpStatusCode.OK, pnd1a.StatusCode);
        Assert.Equal("PND1A_1234567890121_000000_2569_00_00_00.txt", pnd1a.Content.Headers.ContentDisposition?.FileName);
        var lines = (await pnd1a.Content.ReadAsStringAsync()).Split("\r\n", StringSplitOptions.RemoveEmptyEntries);
        Assert.Equal(2, lines.Length); // header + ลูกจ้าง 1 คน (ฟรีแลนซ์ไม่อยู่ใน 1ก)
        Assert.StartsWith("H|0000|1234567890121|000000|1|PND1A|", lines[0]);
        Assert.Contains($"|{NationalId}|", lines[1]);

        var certs = await http.GetAsync("/api/exports/certificates?year=2026");
        Assert.Equal(HttpStatusCode.OK, certs.StatusCode);
        Assert.Equal("%PDF", Encoding.ASCII.GetString(await certs.Content.ReadAsByteArrayAsync(), 0, 4));
    }

    [Fact]
    public async Task Missing_filing_info_is_reported_bilingually_and_blocks_download()
    {
        var (http, _, _) = await LockedOctoberRun(withFilingInfo: false);

        var summary = (await http.GetFromJsonAsync<ExportService.MonthSummary>("/api/exports/summary?year=2026&month=10", Json.Options))!;
        Assert.Contains(summary.Sso.Issues, i => i.Th.Contains("บัญชีนายจ้าง") && i.En.Contains("account"));
        Assert.Contains(summary.Sso.Issues, i => i.Th.Contains("สมชาย") && i.Th.Contains("คำนำหน้า"));
        Assert.Contains(summary.Pnd1.Issues, i => i.Th.Contains("เลขประจำตัวผู้เสียภาษี"));

        var sso = await http.GetAsync("/api/exports/sso?year=2026&month=10&paymentDate=2026-11-15");
        Assert.Equal(HttpStatusCode.UnprocessableEntity, sso.StatusCode);

        var request = new HttpRequestMessage(HttpMethod.Get, "/api/exports/pnd1?year=2026&month=10");
        request.Headers.AcceptLanguage.ParseAdd("en-US,en;q=0.9");
        var english = await http.SendAsync(request);
        Assert.Contains("Shop tax ID", await english.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Payslips_only_after_lock_and_render_pdf()
    {
        var (http, employee, run) = await LockedOctoberRun();

        var all = await http.GetAsync($"/api/pay-runs/{run}/payslips");
        Assert.Equal(HttpStatusCode.OK, all.StatusCode);
        Assert.Equal("application/pdf", all.Content.Headers.ContentType?.MediaType);
        var bytes = await all.Content.ReadAsByteArrayAsync();
        Assert.Equal("%PDF", Encoding.ASCII.GetString(bytes, 0, 4));

        var one = await http.GetAsync($"/api/pay-runs/{run}/payslips?employeeId={employee}&lang=en");
        Assert.Equal(HttpStatusCode.OK, one.StatusCode);

        var draft = (await (await http.PostAsJsonAsync("/api/pay-runs",
                new PayRunEndpoints.CreatePayRunRequest(new(2026, 11, 1), new(2026, 11, 30)), Json.Options))
            .Content.ReadFromJsonAsync<PayRunEndpoints.PayRunDetail>(Json.Options))!;
        Assert.Equal(HttpStatusCode.Conflict, (await http.GetAsync($"/api/pay-runs/{draft.Summary.Id}/payslips")).StatusCode);
    }

    [Fact]
    public async Task Pay_date_can_change_on_draft_only_and_must_be_valid()
    {
        var http = await factory.RegisterShopAsync("ร้านวันจ่าย", $"paydate-{Guid.NewGuid():N}@test.local");
        var run = (await (await http.PostAsJsonAsync("/api/pay-runs",
                new PayRunEndpoints.CreatePayRunRequest(new(2026, 10, 1), new(2026, 10, 31)), Json.Options))
            .Content.ReadFromJsonAsync<PayRunEndpoints.PayRunDetail>(Json.Options))!;
        Assert.Equal(new DateOnly(2026, 10, 31), run.Summary.PayDate); // ไม่ระบุ = วันสิ้นรอบ

        var moved = await http.PutAsJsonAsync($"/api/pay-runs/{run.Summary.Id}/pay-date", new PayRunEndpoints.PayDateRequest(new(2026, 11, 5)));
        Assert.Equal(new DateOnly(2026, 11, 5), (await moved.Content.ReadFromJsonAsync<PayRunEndpoints.PayRunDetail>(Json.Options))!.Summary.PayDate);

        Assert.Equal(HttpStatusCode.BadRequest,
            (await http.PutAsJsonAsync($"/api/pay-runs/{run.Summary.Id}/pay-date", new PayRunEndpoints.PayDateRequest(new(2026, 9, 30)))).StatusCode);
    }

    [Fact]
    public async Task Shop_settings_validate_numbers()
    {
        var http = await factory.RegisterShopAsync("ร้านตั้งค่า", $"shop-{Guid.NewGuid():N}@test.local");
        var bad = await http.PutAsJsonAsync("/api/shop", new OrgEndpoints.ShopDto("ร้าน", null, null, "123", "000000", "12", "0", null));
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
        var body = await bad.Content.ReadAsStringAsync();
        Assert.Contains("taxId", body);
        Assert.Contains("ssoAccountNo", body);
        Assert.Contains("ssoBranchNo", body);
    }

    [Fact]
    public async Task Employee_national_id_is_checked()
    {
        var http = await factory.RegisterShopAsync("ร้านบัตร", $"nid-{Guid.NewGuid():N}@test.local");
        EmployeeEndpoints.EmployeeRequest Req(string id) =>
            new("ก", null, null, null, null, PayType.Daily, 400m, WorkerType.Employee, "th", Title.Mr, id);

        Assert.Equal(HttpStatusCode.BadRequest, (await http.PostAsJsonAsync("/api/employees", Req("1101700203451"), Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await http.PostAsJsonAsync("/api/employees", Req("1-1017-00203-45-0"), Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await http.PostAsJsonAsync("/api/employees", Req("1101700203450"), Json.Options)).StatusCode); // ซ้ำ
    }

    [Fact]
    public async Task Errors_follow_accept_language()
    {
        var http = factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        {
            Content = JsonContent.Create(new AuthEndpoints.LoginRequest("nobody@test.local", "wrong-password", null)),
        };
        request.Headers.AcceptLanguage.ParseAdd("en");
        Assert.Contains("Incorrect email or password", await (await http.SendAsync(request)).Content.ReadAsStringAsync());

        var thai = await http.PostAsJsonAsync("/api/auth/login", new AuthEndpoints.LoginRequest("nobody@test.local", "wrong-password", null));
        Assert.Contains("อีเมลหรือรหัสผ่านไม่ถูกต้อง", await thai.Content.ReadAsStringAsync());
    }
}
