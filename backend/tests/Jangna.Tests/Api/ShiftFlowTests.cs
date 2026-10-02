using System.Net;
using System.Net.Http.Json;
using Jangna.Api.Endpoints;
using Jangna.Core.Entities;

namespace Jangna.Tests.Api;

public class ShiftFlowTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    // สัปดาห์ จ. 5 ต.ค. 2026 – อา. 11 ต.ค.
    private static readonly DateOnly Monday = new(2026, 10, 5);

    private async Task<(HttpClient Http, Guid Employee)> Shop()
    {
        var http = await factory.RegisterShopAsync("ร้านกะ", $"shift-{Guid.NewGuid():N}@test.local");
        var employee = (await (await http.PostAsJsonAsync("/api/employees",
                new EmployeeEndpoints.EmployeeRequest("แพ็คเกอร์", null, null, null, null, PayType.Daily, 400m, WorkerType.Employee, "th"), Json.Options))
            .Content.ReadFromJsonAsync<EmployeeEndpoints.EmployeeDto>(Json.Options))!.Id;
        return (http, employee);
    }

    private static async Task<ShiftEndpoints.TemplateDto> Template(HttpClient http, string name, string start, string end, int breakMinutes)
    {
        var response = await http.PostAsJsonAsync("/api/shift-templates",
            new ShiftEndpoints.TemplateRequest(name, TimeOnly.Parse(start), TimeOnly.Parse(end), breakMinutes, "sage"), Json.Options);
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        return (await response.Content.ReadFromJsonAsync<ShiftEndpoints.TemplateDto>(Json.Options))!;
    }

    private static async Task<List<ShiftEndpoints.ShiftDto>> Week(HttpClient http, DateOnly monday) =>
        (await http.GetFromJsonAsync<List<ShiftEndpoints.ShiftDto>>(
            $"/api/shifts?from={monday:yyyy-MM-dd}&to={monday.AddDays(6):yyyy-MM-dd}", Json.Options))!;

    [Fact]
    public async Task Plan_a_week_from_templates_and_custom_times()
    {
        var (http, employee) = await Shop();
        var morning = await Template(http, "กะเช้า", "08:00", "17:00", 60);
        var night = await Template(http, "กะดึก", "22:00", "06:00", 30);
        Assert.Equal(8m, morning.Hours);    // 9 ชม. − พัก 1 ชม.
        Assert.Equal(7.5m, night.Hours);    // ข้ามเที่ยงคืน 8 ชม. − 30 นาที

        var save = await http.PutAsJsonAsync("/api/shifts", new List<ShiftEndpoints.ShiftRequest>
        {
            new(employee, Monday, morning.Id),
            new(employee, Monday.AddDays(1), night.Id),
            new(employee, Monday.AddDays(2), null, new TimeOnly(10, 0), new TimeOnly(14, 0), 0, "ช่วยแพ็คช่วงเซล"),
        }, Json.Options);
        Assert.Equal(HttpStatusCode.NoContent, save.StatusCode);

        var week = await Week(http, Monday);
        Assert.Equal(3, week.Count);
        Assert.Equal(19.5m, week.Sum(s => s.Hours)); // 8 + 7.5 + 4
        Assert.Equal("ช่วยแพ็คช่วงเซล", week[2].Note);

        // เปลี่ยนวันจันทร์เป็นกะดึก + ลบวันพุธ
        await http.PutAsJsonAsync("/api/shifts", new List<ShiftEndpoints.ShiftRequest>
        {
            new(employee, Monday, night.Id),
            new(employee, Monday.AddDays(2), null),
        }, Json.Options);
        week = await Week(http, Monday);
        Assert.Equal(2, week.Count);
        Assert.All(week, s => Assert.Equal(night.Id, s.TemplateId));

        // แก้แม่แบบทีหลัง → กะที่จัดไปแล้วไม่เปลี่ยน
        await http.PutAsJsonAsync($"/api/shift-templates/{night.Id}",
            new ShiftEndpoints.TemplateRequest("กะดึก", new TimeOnly(23, 0), new TimeOnly(7, 0), 30, "plum"), Json.Options);
        Assert.All(await Week(http, Monday), s => Assert.Equal(new TimeOnly(22, 0), s.StartTime));
    }

    [Fact]
    public async Task Copy_week_skips_or_overwrites_existing()
    {
        var (http, employee) = await Shop();
        var morning = await Template(http, "กะเช้า", "08:00", "17:00", 60);
        var late = await Template(http, "กะบ่าย", "13:00", "22:00", 60);
        var next = Monday.AddDays(7);

        await http.PutAsJsonAsync("/api/shifts", new List<ShiftEndpoints.ShiftRequest>
        {
            new(employee, Monday, morning.Id),
            new(employee, Monday.AddDays(1), morning.Id),
            new(employee, next, late.Id), // สัปดาห์หน้ามีอยู่แล้ว 1 วัน
        }, Json.Options);

        var skip = await http.PostAsJsonAsync("/api/shifts/copy-week", new ShiftEndpoints.CopyWeekRequest(Monday, next, Overwrite: false), Json.Options);
        Assert.Contains("\"copied\":1", await skip.Content.ReadAsStringAsync());
        Assert.Equal(late.Id, (await Week(http, next)).Single(s => s.Date == next).TemplateId);

        var overwrite = await http.PostAsJsonAsync("/api/shifts/copy-week", new ShiftEndpoints.CopyWeekRequest(Monday, next, Overwrite: true), Json.Options);
        Assert.Contains("\"copied\":2", await overwrite.Content.ReadAsStringAsync());
        Assert.All(await Week(http, next), s => Assert.Equal(morning.Id, s.TemplateId));

        Assert.Equal(HttpStatusCode.BadRequest,
            (await http.PostAsJsonAsync("/api/shifts/copy-week", new ShiftEndpoints.CopyWeekRequest(Monday, Monday.AddDays(3), false), Json.Options)).StatusCode);
    }

    [Fact]
    public async Task Deleting_a_used_template_archives_it()
    {
        var (http, employee) = await Shop();
        var used = await Template(http, "กะเช้า", "08:00", "17:00", 60);
        var unused = await Template(http, "กะทดลอง", "09:00", "12:00", 0);
        await http.PutAsJsonAsync("/api/shifts", new List<ShiftEndpoints.ShiftRequest> { new(employee, Monday, used.Id) }, Json.Options);

        await http.DeleteAsync($"/api/shift-templates/{used.Id}");
        await http.DeleteAsync($"/api/shift-templates/{unused.Id}");

        var templates = (await http.GetFromJsonAsync<List<ShiftEndpoints.TemplateDto>>("/api/shift-templates", Json.Options))!;
        Assert.True(Assert.Single(templates).Archived);
        Assert.Single(await Week(http, Monday));
    }

    [Fact]
    public async Task Invalid_shifts_are_rejected()
    {
        var (http, employee) = await Shop();
        var tooLongBreak = await http.PostAsJsonAsync("/api/shift-templates",
            new ShiftEndpoints.TemplateRequest("สั้น", new TimeOnly(8, 0), new TimeOnly(9, 0), 60, null), Json.Options);
        Assert.Equal(HttpStatusCode.BadRequest, tooLongBreak.StatusCode);

        var halfTime = await http.PutAsJsonAsync("/api/shifts",
            new List<ShiftEndpoints.ShiftRequest> { new(employee, Monday, null, new TimeOnly(8, 0)) }, Json.Options);
        Assert.Equal(HttpStatusCode.BadRequest, halfTime.StatusCode);

        var otherShop = await factory.RegisterShopAsync("ร้านอื่น", $"other-{Guid.NewGuid():N}@test.local");
        var foreign = await otherShop.PutAsJsonAsync("/api/shifts",
            new List<ShiftEndpoints.ShiftRequest> { new(employee, Monday, null, new TimeOnly(8, 0), new TimeOnly(17, 0)) }, Json.Options);
        Assert.Equal(HttpStatusCode.NotFound, foreign.StatusCode);
    }
}
