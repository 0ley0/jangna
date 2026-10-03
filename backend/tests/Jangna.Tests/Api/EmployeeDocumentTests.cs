using System.Net;
using System.Net.Http.Json;
using Jangna.Api.Endpoints;
using Jangna.Core.Entities;

namespace Jangna.Tests.Api;

public class EmployeeDocumentTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

    private static async Task<Guid> AddEmployee(HttpClient http, string name)
    {
        var request = new EmployeeEndpoints.EmployeeRequest(name, "แรงงาน", null, null, null, PayType.Daily, 400m, WorkerType.Employee, "my");
        var created = await http.PostAsJsonAsync("/api/employees", request, Json.Options);
        created.EnsureSuccessStatusCode();
        return (await created.Content.ReadFromJsonAsync<EmployeeEndpoints.EmployeeDto>(Json.Options))!.Id;
    }

    [Fact]
    public async Task Expiring_lists_expired_and_soon_but_not_far_or_open_ended()
    {
        var http = await factory.RegisterShopAsync("ร้านเอกสาร", $"docs-{Guid.NewGuid():N}@test.local");
        var employee = await AddEmployee(http, "มินท์");

        async Task<DocumentEndpoints.DocumentDto> Add(DocumentType type, int? daysFromToday) =>
            (await (await http.PostAsJsonAsync("/api/employee-documents",
                new DocumentEndpoints.DocumentRequest(employee, type, "A123", null, daysFromToday is { } d ? Today.AddDays(d) : null, null), Json.Options))
                .Content.ReadFromJsonAsync<DocumentEndpoints.DocumentDto>(Json.Options))!;

        await Add(DocumentType.Passport, -3);       // หมดแล้ว 3 วัน
        await Add(DocumentType.Visa, 30);           // อีก 30 วัน
        await Add(DocumentType.WorkPermit, 200);    // ไกล
        await Add(DocumentType.PinkCard, null);     // ไม่มีวันหมดอายุ

        var expiring = (await http.GetFromJsonAsync<List<DocumentEndpoints.DocumentDto>>("/api/employee-documents/expiring", Json.Options))!;
        Assert.Equal([DocumentType.Passport, DocumentType.Visa], expiring.Select(d => d.Type));
        Assert.Equal(-3, expiring[0].DaysLeft);
        Assert.Equal(30, expiring[1].DaysLeft);
        Assert.Equal("มินท์ แรงงาน", expiring[0].EmployeeName);

        var wide = (await http.GetFromJsonAsync<List<DocumentEndpoints.DocumentDto>>("/api/employee-documents/expiring?days=365", Json.Options))!;
        Assert.Equal(3, wide.Count);

        var all = (await http.GetFromJsonAsync<List<DocumentEndpoints.DocumentDto>>($"/api/employee-documents?employeeId={employee}", Json.Options))!;
        Assert.Equal(4, all.Count);
        Assert.Null(all[^1].DaysLeft); // ไม่มีวันหมดอายุไปท้ายสุด
    }


    [Fact]
    public async Task Inactive_employees_are_not_nagged_and_validation_works()
    {
        var http = await factory.RegisterShopAsync("ร้านเอกสาร2", $"docs2-{Guid.NewGuid():N}@test.local");
        var employee = await AddEmployee(http, "ออกแล้ว");
        (await http.PostAsJsonAsync("/api/employee-documents",
            new DocumentEndpoints.DocumentRequest(employee, DocumentType.Visa, null, null, Today.AddDays(5), null), Json.Options)).EnsureSuccessStatusCode();
        Assert.Single((await http.GetFromJsonAsync<List<DocumentEndpoints.DocumentDto>>("/api/employee-documents/expiring", Json.Options))!);

        (await http.PostAsJsonAsync($"/api/employees/{employee}/status", new EmployeeEndpoints.StatusRequest(EmployeeStatus.Inactive), Json.Options)).EnsureSuccessStatusCode();
        Assert.Empty((await http.GetFromJsonAsync<List<DocumentEndpoints.DocumentDto>>("/api/employee-documents/expiring", Json.Options))!);

        var backwards = await http.PostAsJsonAsync("/api/employee-documents",
            new DocumentEndpoints.DocumentRequest(employee, DocumentType.Visa, null, Today, Today.AddDays(-1), null), Json.Options);
        Assert.Equal(HttpStatusCode.BadRequest, backwards.StatusCode);

        var ghost = await http.PostAsJsonAsync("/api/employee-documents",
            new DocumentEndpoints.DocumentRequest(Guid.NewGuid(), DocumentType.Visa, null, null, null, null), Json.Options);
        Assert.Equal(HttpStatusCode.NotFound, ghost.StatusCode);
    }

    [Fact]
    public async Task Update_delete_and_other_shops_cannot_touch_documents()
    {
        var owner = await factory.RegisterShopAsync("ร้านเจ้าของเอกสาร", $"docs3-{Guid.NewGuid():N}@test.local");
        var stranger = await factory.RegisterShopAsync("ร้านอื่น", $"docs4-{Guid.NewGuid():N}@test.local");
        var employee = await AddEmployee(owner, "เอกสารลับ");
        var created = await owner.PostAsJsonAsync("/api/employee-documents",
            new DocumentEndpoints.DocumentRequest(employee, DocumentType.Passport, "P1", null, Today.AddDays(10), null), Json.Options);
        var id = (await created.Content.ReadFromJsonAsync<DocumentEndpoints.DocumentDto>(Json.Options))!.Id;

        Assert.Empty((await stranger.GetFromJsonAsync<List<DocumentEndpoints.DocumentDto>>($"/api/employee-documents?employeeId={employee}", Json.Options))!);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.DeleteAsync($"/api/employee-documents/{id}")).StatusCode);

        var updated = await owner.PutAsJsonAsync($"/api/employee-documents/{id}",
            new DocumentEndpoints.DocumentRequest(employee, DocumentType.Passport, "P2", null, Today.AddDays(400), "ต่อแล้ว"), Json.Options);
        var dto = (await updated.Content.ReadFromJsonAsync<DocumentEndpoints.DocumentDto>(Json.Options))!;
        Assert.Equal("P2", dto.Number);
        Assert.Equal(400, dto.DaysLeft);

        Assert.Equal(HttpStatusCode.NoContent, (await owner.DeleteAsync($"/api/employee-documents/{id}")).StatusCode);
        Assert.Empty((await owner.GetFromJsonAsync<List<DocumentEndpoints.DocumentDto>>($"/api/employee-documents?employeeId={employee}", Json.Options))!);
    }
}
