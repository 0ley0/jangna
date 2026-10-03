using System.Net;
using System.Net.Http.Json;
using Jangna.Api.Endpoints;
using Jangna.Core.Entities;

namespace Jangna.Tests.Api;

public class WorkPolicyTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly DateOnly Mon = new(2026, 10, 5); // วันจันทร์

    private async Task<(HttpClient Http, Guid Morning, Guid Evening, Guid Employee)> Shop(string email)
    {
        var http = await factory.RegisterShopAsync("ร้านนโยบาย", $"{email}-{Guid.NewGuid():N}@test.local");
        async Task<Guid> Template(string name, string start, string end) =>
            (await (await http.PostAsJsonAsync("/api/shift-templates", new ShiftEndpoints.TemplateRequest(name, TimeOnly.Parse(start), TimeOnly.Parse(end), 60, null), Json.Options))
                .Content.ReadFromJsonAsync<ShiftEndpoints.TemplateDto>(Json.Options))!.Id;
        var morning = await Template("เช้า", "08:00", "17:00");
        var evening = await Template("บ่าย", "14:00", "23:00");
        var employee = (await (await http.PostAsJsonAsync("/api/employees",
                new EmployeeEndpoints.EmployeeRequest("สมชาย", "ใจดี", null, null, null, PayType.Daily, 400m, WorkerType.Employee, "th"), Json.Options))
            .Content.ReadFromJsonAsync<EmployeeEndpoints.EmployeeDto>(Json.Options))!.Id;
        return (http, morning, evening, employee);
    }

    /// <summary>จ-ศ กะเช้าสัปดาห์ที่ 1, จ-ศ กะบ่ายสัปดาห์ที่ 2 (หมุนเวียน 2 สัปดาห์)</summary>
    private static WorkPolicyEndpoints.PolicyRequest Rotating(Guid morning, Guid evening, string name = "หมุนเวียน", DateOnly? anchor = null) =>
        new(name, "สลับเช้า/บ่าย", 2, anchor ?? Mon,
            [.. Enumerable.Range(0, 5).Select(d => new WorkPolicyEndpoints.DayCell(0, d, morning)),
             .. Enumerable.Range(0, 5).Select(d => new WorkPolicyEndpoints.DayCell(1, d, evening))]);

    private static async Task<WorkPolicyEndpoints.PolicyDto> Create(HttpClient http, WorkPolicyEndpoints.PolicyRequest req)
    {
        var response = await http.PostAsJsonAsync("/api/work-policies", req, Json.Options);
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        return (await response.Content.ReadFromJsonAsync<WorkPolicyEndpoints.PolicyDto>(Json.Options))!;
    }

    private static async Task<List<ShiftEndpoints.ShiftDto>> Shifts(HttpClient http, DateOnly from, DateOnly to) =>
        (await http.GetFromJsonAsync<List<ShiftEndpoints.ShiftDto>>($"/api/shifts?from={from:yyyy-MM-dd}&to={to:yyyy-MM-dd}", Json.Options))!;

    private static async Task<WorkPolicyEndpoints.GenerateResult> Generate(HttpClient http, DateOnly from, DateOnly to) =>
        (await (await http.PostAsJsonAsync("/api/shifts/generate", new WorkPolicyEndpoints.GenerateRequest(from, to)))
            .Content.ReadFromJsonAsync<WorkPolicyEndpoints.GenerateResult>(Json.Options))!;

    [Fact]
    public async Task Rotating_policy_generates_the_right_shift_each_week_and_never_overwrites()
    {
        var (http, morning, evening, employee) = await Shop("rot");
        var policy = await Create(http, Rotating(morning, evening, anchor: Mon.AddDays(2))); // วันพุธ → ปรับเป็นจันทร์
        Assert.Equal(Mon, policy.AnchorDate);

        (await http.PostAsJsonAsync("/api/work-policies/assign", new WorkPolicyEndpoints.AssignRequest(policy.Id, [employee]))).EnsureSuccessStatusCode();

        // 2 สัปดาห์ = จ-ศ x2 = 10 กะ
        Assert.Equal(new WorkPolicyEndpoints.GenerateResult(10, 0, 0), await Generate(http, Mon, Mon.AddDays(13)));

        var shifts = await Shifts(http, Mon, Mon.AddDays(13));
        Assert.Equal(10, shifts.Count);
        Assert.All(shifts.Where(s => s.Date < Mon.AddDays(7)), s => Assert.Equal(new TimeOnly(8, 0), s.StartTime));
        Assert.All(shifts.Where(s => s.Date >= Mon.AddDays(7)), s => Assert.Equal(new TimeOnly(14, 0), s.StartTime));
        Assert.DoesNotContain(shifts, s => s.Date.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday);

        // สร้างซ้ำ → ไม่เพิ่ม ไม่ทับ
        Assert.Equal(new WorkPolicyEndpoints.GenerateResult(0, 10, 0), await Generate(http, Mon, Mon.AddDays(13)));

        // รอบวนกลับ: สัปดาห์ที่ 3 = เช้า แต่กะที่จัดเองไว้ (บ่าย) ไม่ถูกทับ
        var week3 = Mon.AddDays(14);
        (await http.PutAsJsonAsync("/api/shifts", new[] { new ShiftEndpoints.ShiftRequest(employee, week3, evening) }, Json.Options)).EnsureSuccessStatusCode();
        Assert.Equal(new WorkPolicyEndpoints.GenerateResult(4, 1, 0), await Generate(http, week3, week3.AddDays(6)));
        var week3Shifts = await Shifts(http, week3, week3.AddDays(6));
        Assert.Equal(new TimeOnly(14, 0), week3Shifts.Single(s => s.Date == week3).StartTime);
        Assert.Equal(new TimeOnly(8, 0), week3Shifts.First(s => s.Date == week3.AddDays(1)).StartTime);

        // ย้อนก่อนวันเริ่มรอบ: สัปดาห์ -1 ตรงกับสัปดาห์ที่ 2 ของรอบ = บ่าย
        var before = Mon.AddDays(-7);
        await Generate(http, before, before.AddDays(6));
        Assert.All(await Shifts(http, before, before.AddDays(6)), s => Assert.Equal(new TimeOnly(14, 0), s.StartTime));
    }

    [Fact]
    public async Task Policy_validation_and_unique_name()
    {
        var (http, morning, evening, _) = await Shop("val");
        await Create(http, Rotating(morning, evening));

        async Task<HttpStatusCode> Post(WorkPolicyEndpoints.PolicyRequest req) => (await http.PostAsJsonAsync("/api/work-policies", req, Json.Options)).StatusCode;
        Assert.Equal(HttpStatusCode.BadRequest, await Post(Rotating(morning, evening)));                                    // ชื่อซ้ำ
        Assert.Equal(HttpStatusCode.BadRequest, await Post(new("", null, 1, Mon, [])));                                   // ไม่มีชื่อ
        Assert.Equal(HttpStatusCode.BadRequest, await Post(new("ยาวไป", null, 9, Mon, [])));                              // รอบเกิน 8
        Assert.Equal(HttpStatusCode.BadRequest, await Post(new("นอกรอบ", null, 1, Mon, [new(1, 0, morning)])));           // สัปดาห์ที่ 2 ในรอบ 1 สัปดาห์
        Assert.Equal(HttpStatusCode.BadRequest, await Post(new("วันผิด", null, 1, Mon, [new(0, 7, morning)])));
        Assert.Equal(HttpStatusCode.BadRequest, await Post(new("ซ้ำวัน", null, 1, Mon, [new(0, 0, morning), new(0, 0, evening)])));
        Assert.Equal(HttpStatusCode.BadRequest, await Post(new("ไม่มีกะ", null, 1, Mon, [new(0, 0, Guid.NewGuid())])));
        Assert.Equal(HttpStatusCode.OK, await Post(new("ว่างเปล่า", null, 1, Mon, []))); // ทุกวันหยุด ก็ได้
    }

    [Fact]
    public async Task Update_changes_days_in_place_and_archives_instead_of_deleting_when_in_use()
    {
        var (http, morning, evening, employee) = await Shop("upd");
        var policy = await Create(http, Rotating(morning, evening));

        // แก้: เหลือรอบ 1 สัปดาห์ เปลี่ยนกะวันจันทร์ ตัดวันที่เหลือ เพิ่มวันพุธ
        var updated = await http.PutAsJsonAsync($"/api/work-policies/{policy.Id}",
            new WorkPolicyEndpoints.PolicyRequest("หมุนเวียน", null, 1, Mon, [new(0, 0, evening), new(0, 2, morning)]), Json.Options);
        var dto = (await updated.Content.ReadFromJsonAsync<WorkPolicyEndpoints.PolicyDto>(Json.Options))!;
        Assert.Equal(1, dto.CycleWeeks);
        Assert.Equal([new WorkPolicyEndpoints.DayCell(0, 0, evening), new(0, 2, morning)], dto.Days);

        // แม่แบบที่นโยบายอ้างอยู่ ลบไม่ได้จริง → archived
        (await http.DeleteAsync($"/api/shift-templates/{morning}")).EnsureSuccessStatusCode();
        var templates = (await http.GetFromJsonAsync<List<ShiftEndpoints.TemplateDto>>("/api/shift-templates", Json.Options))!;
        Assert.True(templates.Single(t => t.Id == morning).Archived);

        // มีคนใช้ → ลบ = archived, กำหนดเพิ่มไม่ได้ แต่คนเดิมยังอยู่
        (await http.PostAsJsonAsync("/api/work-policies/assign", new WorkPolicyEndpoints.AssignRequest(policy.Id, [employee]))).EnsureSuccessStatusCode();
        (await http.DeleteAsync($"/api/work-policies/{policy.Id}")).EnsureSuccessStatusCode();
        var list = (await http.GetFromJsonAsync<List<WorkPolicyEndpoints.PolicyDto>>("/api/work-policies", Json.Options))!;
        Assert.True(list.Single().Archived);
        Assert.Equal(1, list.Single().EmployeeCount);
        var other = (await (await http.PostAsJsonAsync("/api/employees",
                new EmployeeEndpoints.EmployeeRequest("คนใหม่", null, null, null, null, PayType.Daily, 400m, WorkerType.Employee, "th"), Json.Options))
            .Content.ReadFromJsonAsync<EmployeeEndpoints.EmployeeDto>(Json.Options))!.Id;
        Assert.Equal(HttpStatusCode.Conflict, (await http.PostAsJsonAsync("/api/work-policies/assign", new WorkPolicyEndpoints.AssignRequest(policy.Id, [other]))).StatusCode);

        // ไม่มีคนใช้ → ลบจริง
        var empty = await Create(http, new("ชั่วคราว", null, 1, Mon, []));
        (await http.DeleteAsync($"/api/work-policies/{empty.Id}")).EnsureSuccessStatusCode();
        Assert.DoesNotContain((await http.GetFromJsonAsync<List<WorkPolicyEndpoints.PolicyDto>>("/api/work-policies", Json.Options))!, p => p.Id == empty.Id);
    }

    [Fact]
    public async Task Employee_form_carries_policy_and_other_shops_policy_is_rejected()
    {
        var (http, morning, evening, employee) = await Shop("emp");
        var policy = await Create(http, Rotating(morning, evening));
        var request = new EmployeeEndpoints.EmployeeRequest("สมชาย", "ใจดี", null, null, null, PayType.Daily, 400m, WorkerType.Employee, "th", WorkPolicyId: policy.Id);

        var saved = (await (await http.PutAsJsonAsync($"/api/employees/{employee}", request, Json.Options)).Content.ReadFromJsonAsync<EmployeeEndpoints.EmployeeDto>(Json.Options))!;
        Assert.Equal(policy.Id, saved.WorkPolicyId);
        Assert.Equal("หมุนเวียน", saved.WorkPolicyName);

        var stranger = await factory.RegisterShopAsync("ร้านอื่น", $"other-{Guid.NewGuid():N}@test.local");
        Assert.Equal(HttpStatusCode.BadRequest, (await stranger.PostAsJsonAsync("/api/employees", request, Json.Options)).StatusCode);

        // เอาออก
        (await http.PostAsJsonAsync("/api/work-policies/assign", new WorkPolicyEndpoints.AssignRequest(null, [employee]))).EnsureSuccessStatusCode();
        var cleared = (await http.GetFromJsonAsync<EmployeeEndpoints.EmployeeDto>($"/api/employees/{employee}", Json.Options))!;
        Assert.Null(cleared.WorkPolicyId);

        // พนักงานที่ไม่มีนโยบายนับแยกในผลสร้างกะ
        Assert.Equal(new WorkPolicyEndpoints.GenerateResult(0, 0, 1), await Generate(http, Mon, Mon.AddDays(6)));
    }
}
