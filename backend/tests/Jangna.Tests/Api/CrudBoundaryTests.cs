using System.Net;
using System.Net.Http.Json;
using System.Text;
using Jangna.Api.Endpoints;
using Jangna.Core.Entities;
using Jangna.Payroll.Engine.Model;

namespace Jangna.Tests.Api;

/// <summary>
/// ทดสอบ CRUD ของแต่ละทรัพยากรแบบเน้นกรณีขอบ/ข้อมูลผิด: ต้องได้ 4xx พร้อมข้อความ ไม่ใช่ 500 และไม่ทำให้ข้อมูลเพี้ยน
/// เทสต์ที่ล้ม = บั๊กจริง (ดูรายงานใน docs/gotchas.md ถ้าเจอซ้ำ)
/// </summary>
public class CrudBoundaryTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly DateOnly Day = new(2026, 11, 3);

    private Task<HttpClient> Shop(string tag) => factory.RegisterShopAsync($"ร้าน {tag}", $"{tag}-{Guid.NewGuid():N}@test.local");

    private static StringContent Raw(string json) => new(json, Encoding.UTF8, "application/json");

    private static async Task<Guid> AddEmployee(HttpClient http, string name = "สมชาย", PayType payType = PayType.Daily, decimal rate = 400m)
    {
        var response = await http.PostAsJsonAsync("/api/employees",
            new EmployeeEndpoints.EmployeeRequest(name, "ใจดี", null, null, null, payType, rate, WorkerType.Employee, "th"), Json.Options);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<EmployeeEndpoints.EmployeeDto>(Json.Options))!.Id;
    }

    // ---------------------------------------------------------------- branches

    [Fact]
    public async Task Branch_create_update_list_and_trim()
    {
        var http = await Shop("branch");
        var created = await http.PostAsJsonAsync("/api/branches", new OrgEndpoints.BranchRequest("  โกดังบางนา  ", "TH-10", " 1001 ", 13.66, 100.6, 200));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var branch = (await created.Content.ReadFromJsonAsync<OrgEndpoints.BranchDto>(Json.Options))!;
        Assert.Equal("โกดังบางนา", branch.Name);
        Assert.Equal("1001", branch.AreaCode);
        Assert.Equal(200, branch.GeoRadiusMeters);

        // radius = null ตอนแก้ → คงค่าเดิม, ล้างพิกัดได้
        var updated = await http.PutAsJsonAsync($"/api/branches/{branch.Id}", new OrgEndpoints.BranchRequest("โกดังใหม่", "TH-11", null, null, null, null));
        var dto = (await updated.Content.ReadFromJsonAsync<OrgEndpoints.BranchDto>(Json.Options))!;
        Assert.Equal("โกดังใหม่", dto.Name);
        Assert.Equal(200, dto.GeoRadiusMeters);
        Assert.Null(dto.GeoLat);
        Assert.Null(dto.AreaCode);

        var list = (await http.GetFromJsonAsync<List<OrgEndpoints.BranchDto>>("/api/branches", Json.Options))!;
        Assert.Single(list);
    }

    [Theory]
    [InlineData("", "TH-10", null, null, null)]                 // ชื่อว่าง
    [InlineData("   ", "TH-10", null, null, null)]              // ชื่อเป็นช่องว่าง
    [InlineData("สาขา", "XX-10", null, null, null)]            // รหัสจังหวัดผิดรูปแบบ
    [InlineData("สาขา", "TH-1", null, null, null)]
    [InlineData("สาขา", null, null, null, null)]               // ไม่ส่งรหัสจังหวัด
    [InlineData("สาขา", "TH-10", 13.0, null, null)]            // มี lat ไม่มี lng
    [InlineData("สาขา", "TH-10", null, 100.0, null)]
    [InlineData("สาขา", "TH-10", 13.0, 100.0, 10)]             // รัศมีน้อยไป
    [InlineData("สาขา", "TH-10", 13.0, 100.0, 5001)]           // รัศมีมากไป
    [InlineData("สาขา", "TH-10", 91.0, 100.0, 150)]            // lat เกิน 90
    [InlineData("สาขา", "TH-10", -91.0, 100.0, 150)]
    [InlineData("สาขา", "TH-10", 13.0, 181.0, 150)]            // lng เกิน 180
    [InlineData("สาขา", "TH-10", 13.0, -181.0, 150)]
    public async Task Branch_rejects_bad_input(string? name, string? province, double? lat, double? lng, int? radius)
    {
        var http = await Shop("branchbad");
        var response = await http.PostAsJsonAsync("/api/branches", new OrgEndpoints.BranchRequest(name!, province!, null, lat, lng, radius));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty((await http.GetFromJsonAsync<List<OrgEndpoints.BranchDto>>("/api/branches", Json.Options))!);
    }

    [Fact]
    public async Task Branch_update_unknown_or_other_shop_is_404()
    {
        var owner = await Shop("branchown");
        var stranger = await Shop("branchstr");
        var branch = (await (await owner.PostAsJsonAsync("/api/branches", new OrgEndpoints.BranchRequest("ของฉัน", "TH-10", null, null, null, null)))
            .Content.ReadFromJsonAsync<OrgEndpoints.BranchDto>(Json.Options))!;

        var request = new OrgEndpoints.BranchRequest("ยึด", "TH-10", null, null, null, null);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.PutAsJsonAsync($"/api/branches/{branch.Id}", request)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await owner.PutAsJsonAsync($"/api/branches/{Guid.NewGuid()}", request)).StatusCode);
        Assert.Equal("ของฉัน", (await owner.GetFromJsonAsync<List<OrgEndpoints.BranchDto>>("/api/branches", Json.Options))!.Single().Name);
    }

    // ---------------------------------------------------------------- shop

    [Fact]
    public async Task Shop_update_trims_blanks_and_rejects_bad_numbers()
    {
        var http = await Shop("shop");
        var ok = await http.PutAsJsonAsync("/api/shop", new OrgEndpoints.ShopDto("  ร้านใหม่  ", "  ", " ที่อยู่ ", " 1234567890123 ", "000001", "", "000000", "  "));
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var shop = (await http.GetFromJsonAsync<OrgEndpoints.ShopDto>("/api/shop", Json.Options))!;
        Assert.Equal("ร้านใหม่", shop.Name);
        Assert.Null(shop.LegalName);
        Assert.Equal("ที่อยู่", shop.Address);
        Assert.Equal("1234567890123", shop.TaxId);
        Assert.Null(shop.SsoAccountNo);
        Assert.Null(shop.RdUserId);

        foreach (var bad in new[]
                 {
                     new OrgEndpoints.ShopDto("", null, null, null, "000000", null, "000000", null),                       // ไม่มีชื่อ
                     new OrgEndpoints.ShopDto("ร้าน", null, null, "12345678901AB", "000000", null, "000000", null),         // ตัวอักษรในเลขภาษี
                     new OrgEndpoints.ShopDto("ร้าน", null, null, null, "", null, "000000", null),                         // สาขาว่าง
                     new OrgEndpoints.ShopDto("ร้าน", null, null, null, "000000", "123456789", "000000", null),            // สปส. 9 หลัก
                     new OrgEndpoints.ShopDto("ร้าน", null, new string('ก', 501), null, "000000", null, "000000", null),   // ที่อยู่ยาวเกิน 500
                     new OrgEndpoints.ShopDto("ร้าน", new string('ก', 201), null, null, "000000", null, "000000", null),   // ชื่อนิติบุคคลยาวเกิน 200
                     new OrgEndpoints.ShopDto("ร้าน", null, null, null, "000000", null, "000000", new string('x', 21)),    // RD user ยาวเกิน 20
                 })
        {
            var response = await http.PutAsJsonAsync("/api/shop", bad);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }
        Assert.Equal("ร้านใหม่", (await http.GetFromJsonAsync<OrgEndpoints.ShopDto>("/api/shop", Json.Options))!.Name); // ไม่เพี้ยนจากคำขอที่ผิด
    }

    // ---------------------------------------------------------------- auth (ส่ง JSON ไม่ครบ field)

    [Theory]
    [InlineData("/api/auth/register", "{}")]
    [InlineData("/api/auth/register", "{\"shopName\":\"ร้าน\",\"displayName\":\"ก\"}")]
    [InlineData("/api/auth/register", "{\"shopName\":\"ร้าน\",\"email\":\"a@b.c\",\"displayName\":\"ก\"}")]
    [InlineData("/api/auth/login", "{}")]
    [InlineData("/api/auth/login", "{\"email\":\"a@b.c\"}")]
    public async Task Auth_with_missing_fields_is_a_4xx_not_a_500(string path, string json)
    {
        var response = await factory.CreateClient().PostAsync(path, Raw(json));
        Assert.True((int)response.StatusCode is >= 400 and < 500, $"{path} {json} → {(int)response.StatusCode}");
    }

    [Fact]
    public async Task Register_rejects_duplicate_email_case_insensitively_and_short_password()
    {
        var email = $"dup-{Guid.NewGuid():N}@test.local";
        var first = await factory.CreateClient().PostAsJsonAsync("/api/auth/register", new AuthEndpoints.RegisterRequest("ร้านหนึ่ง", email, "password123", "ก"));
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var again = await factory.CreateClient().PostAsJsonAsync("/api/auth/register", new AuthEndpoints.RegisterRequest("ร้านสอง", email.ToUpperInvariant(), "password123", "ข"));
        Assert.Equal(HttpStatusCode.BadRequest, again.StatusCode);
        var weak = await factory.CreateClient().PostAsJsonAsync("/api/auth/register", new AuthEndpoints.RegisterRequest("ร้าน", $"x-{Guid.NewGuid():N}@test.local", "short", "ก"));
        Assert.Equal(HttpStatusCode.BadRequest, weak.StatusCode);
    }

    [Fact]
    public async Task Endpoints_require_authentication()
    {
        var anonymous = factory.CreateClient();
        foreach (var path in new[] { "/api/employees", "/api/branches", "/api/holidays?year=2026", "/api/pay-runs", "/api/work-policies", "/api/shift-templates", "/api/shop", "/api/me" })
            Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(path)).StatusCode);
    }

    // ---------------------------------------------------------------- employees

    [Fact]
    public async Task Employee_crud_edge_cases()
    {
        var http = await Shop("emp");
        var id = await AddEmployee(http);

        Assert.Equal(HttpStatusCode.NotFound, (await http.GetAsync($"/api/employees/{Guid.NewGuid()}")).StatusCode);
        var ghost = new EmployeeEndpoints.EmployeeRequest("ผี", null, null, null, null, PayType.Daily, 400m, WorkerType.Employee, "th");
        Assert.Equal(HttpStatusCode.NotFound, (await http.PutAsJsonAsync($"/api/employees/{Guid.NewGuid()}", ghost, Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await http.PostAsJsonAsync($"/api/employees/{Guid.NewGuid()}/status", new EmployeeEndpoints.StatusRequest(EmployeeStatus.Inactive), Json.Options)).StatusCode);

        async Task<HttpStatusCode> Post(EmployeeEndpoints.EmployeeRequest r) => (await http.PostAsJsonAsync("/api/employees", r, Json.Options)).StatusCode;
        Assert.Equal(HttpStatusCode.BadRequest, await Post(ghost with { FirstName = "  " }));                       // ชื่อว่าง
        Assert.Equal(HttpStatusCode.BadRequest, await Post(ghost with { BaseRate = -1 }));                        // ค่าจ้างติดลบ
        Assert.Equal(HttpStatusCode.BadRequest, await Post(ghost with { BaseRate = 0 }));                         // รายวันต้องมีอัตรา
        Assert.Equal(HttpStatusCode.BadRequest, await Post(ghost with { Language = "fr" }));
        Assert.Equal(HttpStatusCode.BadRequest, await Post(ghost with { BranchId = Guid.NewGuid() }));
        Assert.Equal(HttpStatusCode.BadRequest, await Post(ghost with { PostalCode = "1234" }));
        Assert.Equal(HttpStatusCode.BadRequest, await Post(ghost with { NationalId = "123" }));
        Assert.Equal(HttpStatusCode.Created, await Post(ghost with { PayType = PayType.Piece, BaseRate = 0 }));  // ต่อชิ้นไม่ต้องมีอัตรา

        // ชื่อ/นามสกุลยาวมากต้องไม่ทำให้ 500
        var longName = (int)await Post(ghost with { FirstName = new string('ก', 5000) });
        Assert.True(longName is >= 200 and < 500, $"ชื่อยาว 5000 ตัว → {longName}");

        // PUT แล้วไม่เหลือค่าเดิมที่ไม่ได้ส่งมา และชื่อถูก trim
        var updated = await http.PutAsJsonAsync($"/api/employees/{id}", ghost with { FirstName = "  แก้ไข  ", Nickname = "  เล็ก  ", Phone = "  " }, Json.Options);
        var dto = (await updated.Content.ReadFromJsonAsync<EmployeeEndpoints.EmployeeDto>(Json.Options))!;
        Assert.Equal("แก้ไข", dto.FirstName);
        Assert.Equal("เล็ก", dto.Nickname);
        Assert.Null(dto.Phone);

        // สถานะ: ค่านอก enum ต้องเป็น 400
        var bogus = await http.PostAsync($"/api/employees/{id}/status", Raw("{\"status\":\"Fired\"}"));
        // Development ตั้ง ThrowOnBadRequest ไว้ → BadHttpRequest กลายเป็น 500 ใน env นี้ (production ได้ 400) จึงเช็กแค่ "ต้องไม่สำเร็จ"
        Assert.False(bogus.IsSuccessStatusCode, $"status Fired → {(int)bogus.StatusCode}");
        var numeric = await http.PostAsync($"/api/employees/{id}/status", Raw("{\"status\":99}"));
        Assert.False(numeric.IsSuccessStatusCode, $"status 99 → {(int)numeric.StatusCode}");
        Assert.Equal(EmployeeStatus.Active, (await http.GetFromJsonAsync<EmployeeEndpoints.EmployeeDto>($"/api/employees/{id}", Json.Options))!.Status); // สถานะไม่เพี้ยน
    }

    [Fact]
    public async Task Employee_with_a_branch_from_another_shop_is_rejected_and_inactive_stays_listed()
    {
        var a = await Shop("empa");
        var b = await Shop("empb");
        var theirBranch = (await (await b.PostAsJsonAsync("/api/branches", new OrgEndpoints.BranchRequest("ของเขา", "TH-10", null, null, null, null)))
            .Content.ReadFromJsonAsync<OrgEndpoints.BranchDto>(Json.Options))!.Id;
        var request = new EmployeeEndpoints.EmployeeRequest("ก", null, null, null, theirBranch, PayType.Daily, 400m, WorkerType.Employee, "th");
        Assert.Equal(HttpStatusCode.BadRequest, (await a.PostAsJsonAsync("/api/employees", request, Json.Options)).StatusCode);

        var id = await AddEmployee(a);
        (await a.PostAsJsonAsync($"/api/employees/{id}/status", new EmployeeEndpoints.StatusRequest(EmployeeStatus.Inactive), Json.Options)).EnsureSuccessStatusCode();
        var list = (await a.GetFromJsonAsync<List<EmployeeEndpoints.EmployeeDto>>("/api/employees", Json.Options))!;
        Assert.Equal(EmployeeStatus.Inactive, list.Single().Status);
    }

    // ---------------------------------------------------------------- holidays

    [Fact]
    public async Task Holiday_crud()
    {
        var http = await Shop("hol");
        var created = await http.PostAsJsonAsync("/api/holidays", new WorkEndpoints.HolidayRequest(new(2026, 4, 13), "  สงกรานต์  "));
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        var holiday = (await created.Content.ReadFromJsonAsync<WorkEndpoints.HolidayDto>(Json.Options))!;
        Assert.Equal("สงกรานต์", holiday.Name);

        Assert.Equal(HttpStatusCode.Conflict, (await http.PostAsJsonAsync("/api/holidays", new WorkEndpoints.HolidayRequest(new(2026, 4, 13), "ซ้ำ"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await http.PostAsJsonAsync("/api/holidays", new WorkEndpoints.HolidayRequest(new(2026, 4, 14), "  "))).StatusCode);

        await http.PostAsJsonAsync("/api/holidays", new WorkEndpoints.HolidayRequest(new(2027, 1, 1), "ปีใหม่ถัดไป"));
        Assert.Single((await http.GetFromJsonAsync<List<WorkEndpoints.HolidayDto>>("/api/holidays?year=2026", Json.Options))!);
        Assert.Single((await http.GetFromJsonAsync<List<WorkEndpoints.HolidayDto>>("/api/holidays?year=2027", Json.Options))!);
        Assert.Empty((await http.GetFromJsonAsync<List<WorkEndpoints.HolidayDto>>("/api/holidays?year=2030", Json.Options))!);

        Assert.Equal(HttpStatusCode.NotFound, (await http.DeleteAsync($"/api/holidays/{Guid.NewGuid()}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await http.DeleteAsync($"/api/holidays/{holiday.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await http.DeleteAsync($"/api/holidays/{holiday.Id}")).StatusCode); // ลบซ้ำ
        Assert.Empty((await http.GetFromJsonAsync<List<WorkEndpoints.HolidayDto>>("/api/holidays?year=2026", Json.Options))!);
    }

    [Fact]
    public async Task Holiday_of_another_shop_cannot_be_deleted_and_same_date_is_allowed_per_shop()
    {
        var a = await Shop("hola");
        var b = await Shop("holb");
        var date = new DateOnly(2026, 5, 1);
        var holiday = (await (await a.PostAsJsonAsync("/api/holidays", new WorkEndpoints.HolidayRequest(date, "วันแรงงาน"))).Content.ReadFromJsonAsync<WorkEndpoints.HolidayDto>(Json.Options))!;
        Assert.Equal(HttpStatusCode.NotFound, (await b.DeleteAsync($"/api/holidays/{holiday.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await b.PostAsJsonAsync("/api/holidays", new WorkEndpoints.HolidayRequest(date, "วันแรงงาน"))).StatusCode);
        Assert.Single((await a.GetFromJsonAsync<List<WorkEndpoints.HolidayDto>>("/api/holidays?year=2026", Json.Options))!);
    }

    // ---------------------------------------------------------------- work days

    [Fact]
    public async Task WorkDay_upsert_is_idempotent_and_delete_works()
    {
        var http = await Shop("wd");
        var emp = await AddEmployee(http);
        WorkEndpoints.WorkDayRequest Req(decimal normal, decimal ot = 0, string? note = null) =>
            new(emp, Day, DayKind.Workday, normal, ot, LeaveKind.None, note);

        (await http.PutAsJsonAsync("/api/work-days", new[] { Req(8), Req(4, 2, "  ซ้ำในคำขอเดียว  ") }, Json.Options)).EnsureSuccessStatusCode(); // วันเดียวกันสองรายการ → แถวเดียว
        (await http.PutAsJsonAsync("/api/work-days", new[] { Req(6, 1) }, Json.Options)).EnsureSuccessStatusCode();                              // ส่งซ้ำ → แก้แถวเดิม

        var days = (await http.GetFromJsonAsync<List<WorkEndpoints.WorkDayDto>>($"/api/work-days?from=2026-11-01&to=2026-11-30&employeeId={emp}", Json.Options))!;
        var day = Assert.Single(days);
        Assert.Equal(6, day.NormalHours);
        Assert.Equal(1, day.OvertimeHours);
        Assert.Null(day.Note); // ครั้งสุดท้ายไม่มีหมายเหตุ

        Assert.Equal(HttpStatusCode.NoContent, (await http.PutAsJsonAsync("/api/work-days", Array.Empty<WorkEndpoints.WorkDayRequest>(), Json.Options)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await http.DeleteAsync($"/api/work-days/{day.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await http.DeleteAsync($"/api/work-days/{day.Id}")).StatusCode);
        Assert.Empty((await http.GetFromJsonAsync<List<WorkEndpoints.WorkDayDto>>($"/api/work-days?from=2026-11-01&to=2026-11-30", Json.Options))!);
    }

    [Theory]
    [InlineData(-1, 0)]
    [InlineData(25, 0)]
    [InlineData(0, 25)]
    [InlineData(16, 9)]   // รวมเกิน 24
    public async Task WorkDay_rejects_impossible_hours(double normal, double overtime)
    {
        var http = await Shop("wdbad");
        var emp = await AddEmployee(http);
        var response = await http.PutAsJsonAsync("/api/work-days", new[] { new WorkEndpoints.WorkDayRequest(emp, Day, DayKind.Workday, (decimal)normal, (decimal)overtime, LeaveKind.None, null) }, Json.Options);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task WorkDay_unknown_employee_and_other_shop_employee_are_404_and_batch_is_all_or_nothing()
    {
        var a = await Shop("wda");
        var b = await Shop("wdb");
        var mine = await AddEmployee(a);
        var theirs = await AddEmployee(b);

        var request = new[]
        {
            new WorkEndpoints.WorkDayRequest(mine, Day, DayKind.Workday, 8, 0, LeaveKind.None, null),
            new WorkEndpoints.WorkDayRequest(theirs, Day, DayKind.Workday, 8, 0, LeaveKind.None, null),
        };
        Assert.Equal(HttpStatusCode.NotFound, (await a.PutAsJsonAsync("/api/work-days", request, Json.Options)).StatusCode);
        Assert.Empty((await a.GetFromJsonAsync<List<WorkEndpoints.WorkDayDto>>("/api/work-days?from=2026-11-01&to=2026-11-30", Json.Options))!);
        Assert.Empty((await b.GetFromJsonAsync<List<WorkEndpoints.WorkDayDto>>("/api/work-days?from=2026-11-01&to=2026-11-30", Json.Options))!);
    }

    [Fact]
    public async Task WorkDay_huge_batch_is_rejected_rather_than_trusted()
    {
        var http = await Shop("wdhuge");
        var emp = await AddEmployee(http);
        var items = Enumerable.Range(0, 3000).Select(i => new WorkEndpoints.WorkDayRequest(emp, Day.AddDays(i), DayKind.Workday, 8, 0, LeaveKind.None, null)).ToList();
        var response = await http.PutAsJsonAsync("/api/work-days", items, Json.Options);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode); // เหมือนตารางกะที่จำกัด 500 ช่อง/ครั้ง
    }

    // ---------------------------------------------------------------- piece work

    [Fact]
    public async Task PieceWork_crud_and_validation()
    {
        var http = await Shop("pw");
        var emp = await AddEmployee(http, payType: PayType.Piece, rate: 0);
        WorkEndpoints.PieceWorkRequest Req(string desc = "แพ็ค", decimal qty = 10, decimal rate = 5, string? note = null) => new(emp, Day, desc, qty, rate, false, note);

        var created = await http.PostAsJsonAsync("/api/piece-work", Req("  แพ็คกล่อง  "));
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        var entry = (await created.Content.ReadFromJsonAsync<WorkEndpoints.PieceWorkDto>(Json.Options))!;
        Assert.Equal("แพ็คกล่อง", entry.Description);

        Assert.Equal(HttpStatusCode.OK, (await http.PostAsJsonAsync("/api/piece-work", Req(rate: 0))).StatusCode);   // อัตรา 0 ได้ (งานฟรี/ทดลอง)
        foreach (var bad in new[] { Req(desc: " "), Req(qty: 0), Req(qty: -3), Req(rate: -1) })
            Assert.Equal(HttpStatusCode.BadRequest, (await http.PostAsJsonAsync("/api/piece-work", bad)).StatusCode);

        var list = (await http.GetFromJsonAsync<List<WorkEndpoints.PieceWorkDto>>($"/api/piece-work?from=2026-11-01&to=2026-11-30&employeeId={emp}", Json.Options))!;
        Assert.Equal(2, list.Count);

        Assert.Equal(HttpStatusCode.NoContent, (await http.DeleteAsync($"/api/piece-work/{entry.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await http.DeleteAsync($"/api/piece-work/{entry.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await http.PostAsJsonAsync("/api/piece-work", Req() with { EmployeeId = Guid.NewGuid() })).StatusCode);
    }

    [Fact]
    public async Task PieceWork_absurd_numbers_do_not_become_a_500()
    {
        // numeric(12,2)/(12,4) บน Postgres: ค่าใหญ่เกินจะทำให้ INSERT พัง (InMemory ไม่เห็น) → ต้องกันที่ validation
        var http = await Shop("pwbig");
        var emp = await AddEmployee(http, payType: PayType.Piece, rate: 0);
        var response = await http.PostAsJsonAsync("/api/piece-work", new WorkEndpoints.PieceWorkRequest(emp, Day, "แพ็ค", 99_999_999_999_999m, 5, false, null));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ---------------------------------------------------------------- advances

    [Fact]
    public async Task Advance_create_reversal_and_list_order()
    {
        var http = await Shop("adv");
        var emp = await AddEmployee(http);

        Assert.Equal(HttpStatusCode.BadRequest, (await http.PostAsJsonAsync("/api/advances", new WorkEndpoints.AdvanceRequest(emp, Day, 0, null))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await http.PostAsJsonAsync("/api/advances", new WorkEndpoints.AdvanceRequest(Guid.NewGuid(), Day, 100, null))).StatusCode);

        (await http.PostAsJsonAsync("/api/advances", new WorkEndpoints.AdvanceRequest(emp, Day, 1000, "เบิก"))).EnsureSuccessStatusCode();
        (await http.PostAsJsonAsync("/api/advances", new WorkEndpoints.AdvanceRequest(emp, Day.AddDays(2), -300, "กลับรายการ"))).EnsureSuccessStatusCode();
        var list = (await http.GetFromJsonAsync<List<WorkEndpoints.AdvanceDto>>($"/api/advances?employeeId={emp}", Json.Options))!;
        Assert.Equal([-300m, 1000m], list.Select(a => a.Amount)); // ใหม่ก่อน
        Assert.Empty((await http.GetFromJsonAsync<List<WorkEndpoints.AdvanceDto>>($"/api/advances?employeeId={Guid.NewGuid()}", Json.Options))!);
    }

    [Fact]
    public async Task Advance_absurd_amount_is_a_4xx()
    {
        var http = await Shop("advbig");
        var emp = await AddEmployee(http);
        var response = await http.PostAsJsonAsync("/api/advances", new WorkEndpoints.AdvanceRequest(emp, Day, 99_999_999_999_999m, null));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ---------------------------------------------------------------- opening balances

    [Fact]
    public async Task OpeningBalance_upsert_validation_and_year_filter()
    {
        var http = await Shop("ob");
        var emp = await AddEmployee(http);
        async Task<HttpStatusCode> Put(int year, decimal income = 1000, decimal tax = 10, decimal sso = 5, Guid? who = null) =>
            (await http.PutAsJsonAsync("/api/opening-balances", new WorkEndpoints.OpeningBalanceRequest(who ?? emp, year, income, tax, sso, null))).StatusCode;

        Assert.Equal(HttpStatusCode.OK, await Put(2026));
        Assert.Equal(HttpStatusCode.OK, await Put(2026, income: 2000));   // อัปเดตแถวเดิม
        Assert.Equal(HttpStatusCode.OK, await Put(2025));
        Assert.Equal(HttpStatusCode.BadRequest, await Put(2026, income: -1));
        Assert.Equal(HttpStatusCode.BadRequest, await Put(2026, tax: -1));
        Assert.Equal(HttpStatusCode.BadRequest, await Put(2026, sso: -1));
        Assert.Equal(HttpStatusCode.NotFound, await Put(2026, who: Guid.NewGuid()));

        var y2026 = (await http.GetFromJsonAsync<List<WorkEndpoints.OpeningBalanceDto>>("/api/opening-balances?year=2026", Json.Options))!;
        Assert.Equal(2000m, Assert.Single(y2026).TaxableIncome);
        Assert.Single((await http.GetFromJsonAsync<List<WorkEndpoints.OpeningBalanceDto>>("/api/opening-balances?year=2025", Json.Options))!);

        // ปีที่ไม่สมเหตุสมผล และภาษีที่หักเกินเงินได้ ไม่ควรรับ
        Assert.Equal(HttpStatusCode.BadRequest, await Put(1, income: 1000));
        Assert.Equal(HttpStatusCode.BadRequest, await Put(2026, income: 100, tax: 5000));
    }

    // ---------------------------------------------------------------- work policy: ส่ง JSON ไม่ครบ

    [Fact]
    public async Task WorkPolicy_without_days_or_name_is_not_a_500()
    {
        var http = await Shop("polnull");
        var noDays = await http.PostAsync("/api/work-policies", Raw("{\"name\":\"ไม่มีวัน\",\"cycleWeeks\":1,\"anchorDate\":\"2026-10-05\"}"));
        Assert.True((int)noDays.StatusCode is < 500, $"ไม่ส่ง days → {(int)noDays.StatusCode}");
        var noName = await http.PostAsync("/api/work-policies", Raw("{\"cycleWeeks\":1,\"anchorDate\":\"2026-10-05\",\"days\":[]}"));
        Assert.Equal(HttpStatusCode.BadRequest, noName.StatusCode);
        var empty = await http.PostAsync("/api/work-policies", Raw("{}"));
        Assert.True((int)empty.StatusCode is >= 400 and < 500, $"{{}} → {(int)empty.StatusCode}");
    }
}
