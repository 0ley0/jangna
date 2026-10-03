using System.Net;
using System.Net.Http.Json;
using ClosedXML.Excel;
using Jangna.Api.Endpoints;
using Jangna.Api.Imports;
using Jangna.Core.Entities;

namespace Jangna.Tests.Api;

public class EmployeeImportTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static byte[] Workbook(params string[][] rows)
    {
        using var wb = new XLWorkbook();
        var ws = wb.AddWorksheet("พนักงาน");
        ws.Cell(1, 1).Value = "header";
        for (var r = 0; r < rows.Length; r++)
            for (var c = 0; c < rows[r].Length; c++)
                ws.Cell(r + 2, c + 1).Value = rows[r][c];
        using var stream = new MemoryStream();
        wb.SaveAs(stream);
        return stream.ToArray();
    }

    private static MultipartFormDataContent Upload(byte[] bytes)
    {
        var content = new MultipartFormDataContent();
        content.Add(new ByteArrayContent(bytes), "file", "employees.xlsx");
        return content;
    }

    // ชื่อ, นามสกุล, เล่น, โทร, สาขา, ค่าจ้าง, อัตรา, สถานะ, ภาษา, คำนำหน้า, บัตร, ที่อยู่, ตำบล, อำเภอ, จังหวัด, ไปรษณีย์
    private static string[] Good(string name, string nationalId = "1101700203450") =>
        [name, "ใจดี", "", "0812345678", "", "รายวัน", "400", "ลูกจ้าง", "th", "นาย", nationalId, "12/3", "พญาไท", "ราชเทวี", "กรุงเทพมหานคร", "10400"];

    [Fact]
    public async Task Template_is_a_valid_workbook_with_branch_dropdown()
    {
        var http = await factory.RegisterShopAsync("ร้านแม่แบบ", $"tpl-{Guid.NewGuid():N}@test.local");
        await http.PostAsJsonAsync("/api/branches", new OrgEndpoints.BranchRequest("โกดังบางนา", "TH-10", null, null, null, null));

        var response = await http.GetAsync("/api/employees/import/template");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("jangna-employees-template.xlsx", response.Content.Headers.ContentDisposition?.FileName);

        using var wb = new XLWorkbook(await response.Content.ReadAsStreamAsync());
        var ws = wb.Worksheet("พนักงาน");
        Assert.Contains("ชื่อ", ws.Cell(1, 1).GetString());
        Assert.Equal(16, ws.LastColumnUsed()!.ColumnNumber());
        Assert.Contains("โกดังบางนา", ws.Cell(2, 5).GetDataValidation().Value);
    }

    [Fact]
    public async Task Dry_run_reports_each_bad_row_and_adds_nobody()
    {
        var http = await factory.RegisterShopAsync("ร้านนำเข้า", $"imp-{Guid.NewGuid():N}@test.local");
        var bytes = Workbook(
            Good("สมชาย"),
            Good("สมหญิง", "1101700203450"),                                    // ซ้ำบัตรกับแถว 2
            ["", "", "", "", "สาขาลวง", "รายปี", "abc", "", "", "", "1234567890123", "", "", "", "", "123"]);

        var response = await http.PostAsync("/api/employees/import?dryRun=true", Upload(bytes));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var report = (await response.Content.ReadFromJsonAsync<EmployeeImport.Report>(Json.Options))!;

        Assert.Equal(3, report.Total);
        Assert.Equal(1, report.Valid);
        Assert.Equal(0, report.Imported);
        Assert.Empty(report.Rows[0].Errors);
        Assert.Contains(report.Rows[1].Errors, e => e.Contains("แถว 2"));
        Assert.Contains(report.Rows[2].Errors, e => e.Contains("สาขาลวง"));
        Assert.Contains(report.Rows[2].Errors, e => e.Contains("รูปแบบค่าจ้าง"));
        Assert.Contains(report.Rows[2].Errors, e => e.Contains("อัตรา"));
        Assert.Contains(report.Rows[2].Errors, e => e.Contains("กรุณากรอกชื่อ"));
        Assert.Contains(report.Rows[2].Errors, e => e.Contains("เลขประจำตัวประชาชน"));

        var employees = (await http.GetFromJsonAsync<List<EmployeeEndpoints.EmployeeDto>>("/api/employees", Json.Options))!;
        Assert.Empty(employees);
    }

    [Fact]
    public async Task Commit_is_all_or_nothing_then_creates_everyone()
    {
        var http = await factory.RegisterShopAsync("ร้านนำเข้า2", $"imp2-{Guid.NewGuid():N}@test.local");
        await http.PostAsJsonAsync("/api/branches", new OrgEndpoints.BranchRequest("โกดัง", "TH-10", null, null, null, null));

        // มีแถวผิด → ไม่เพิ่มใครเลย แม้ commit
        var broken = await http.PostAsync("/api/employees/import", Upload(Workbook(Good("สมชาย"), ["", "", "", "", "", "รายวัน", "400"])));
        var brokenReport = (await broken.Content.ReadFromJsonAsync<EmployeeImport.Report>(Json.Options))!;
        Assert.Equal(0, brokenReport.Imported);
        Assert.Empty((await http.GetFromJsonAsync<List<EmployeeEndpoints.EmployeeDto>>("/api/employees", Json.Options))!);

        // ภาษาอังกฤษ + ขีดในเลขบัตร + สาขาตรงชื่อ + ฟรีแลนซ์ + ต่อชิ้นไม่ต้องมีอัตรา
        var ok = await http.PostAsync("/api/employees/import", Upload(Workbook(
            Good("สมชาย"),
            ["Mary", "Smith", "", "", "โกดัง", "Monthly", "30,000", "Freelance", "en", "Miss", "1-1017-00203-46-8", "", "", "", "", ""],
            ["ปลา", "", "", "", "", "ต่อชิ้น", "", "", "", "", "", "", "", "", "", ""])));
        var report = (await ok.Content.ReadFromJsonAsync<EmployeeImport.Report>(Json.Options))!;
        Assert.Equal(3, report.Imported);

        var employees = (await http.GetFromJsonAsync<List<EmployeeEndpoints.EmployeeDto>>("/api/employees", Json.Options))!;
        Assert.Equal(3, employees.Count);
        var mary = employees.Single(e => e.FirstName == "Mary");
        Assert.Equal(PayType.Monthly, mary.PayType);
        Assert.Equal(30_000m, mary.BaseRate);
        Assert.Equal(WorkerType.Freelance, mary.WorkerType);
        Assert.Equal(Title.Miss, mary.Title);
        Assert.Equal("1101700203468", mary.NationalId);
        Assert.Equal("โกดัง", mary.BranchName);
        Assert.Equal("0812345678", employees.Single(e => e.FirstName == "สมชาย").Phone);

        // นำเข้าซ้ำ → ชนบัตรที่มีอยู่แล้ว
        var again = await http.PostAsync("/api/employees/import?dryRun=true", Upload(Workbook(Good("ซ้ำ"))));
        Assert.Contains((await again.Content.ReadFromJsonAsync<EmployeeImport.Report>(Json.Options))!.Rows[0].Errors, e => e.Contains("ใช้กับพนักงานคนอื่นแล้ว"));
    }

    [Fact]
    public async Task Non_excel_and_empty_files_are_rejected_politely()
    {
        var http = await factory.RegisterShopAsync("ร้านไฟล์ผิด", $"bad-{Guid.NewGuid():N}@test.local");
        var junk = await http.PostAsync("/api/employees/import?dryRun=true", Upload("not excel"u8.ToArray()));
        Assert.Equal(HttpStatusCode.BadRequest, junk.StatusCode);
        Assert.Contains("Excel", await junk.Content.ReadAsStringAsync());

        var empty = await http.PostAsync("/api/employees/import?dryRun=true", Upload(Workbook()));
        Assert.Equal(HttpStatusCode.BadRequest, empty.StatusCode);
    }
}
