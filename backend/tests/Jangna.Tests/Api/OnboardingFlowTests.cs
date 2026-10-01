using System.Net;
using System.Net.Http.Json;
using Jangna.Api.Endpoints;
using Jangna.Core.Entities;

namespace Jangna.Tests.Api;

public class OnboardingFlowTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static EmployeeEndpoints.EmployeeRequest Packer(string name, Guid? branchId = null) =>
        new(name, null, null, null, branchId, PayType.Piece, 0m, WorkerType.Employee, "th");

    [Fact]
    public async Task Owner_registers_creates_branch_and_employee_then_employee_links_line()
    {
        var owner = await factory.RegisterShopAsync("ร้านแพ็คไว", $"owner-{Guid.NewGuid():N}@test.local");

        var branchResponse = await owner.PostAsJsonAsync("/api/branches",
            new OrgEndpoints.BranchRequest("โกดังบางนา", "TH-10", null, 13.66, 100.6, 200));
        Assert.Equal(HttpStatusCode.Created, branchResponse.StatusCode);
        var branch = await branchResponse.Content.ReadFromJsonAsync<OrgEndpoints.BranchDto>(Json.Options);

        var employeeResponse = await owner.PostAsJsonAsync("/api/employees", Packer("สมชาย", branch!.Id), Json.Options);
        Assert.Equal(HttpStatusCode.Created, employeeResponse.StatusCode);
        var employee = await employeeResponse.Content.ReadFromJsonAsync<EmployeeEndpoints.EmployeeDto>(Json.Options);
        Assert.Equal("โกดังบางนา", employee!.BranchName);
        Assert.False(employee.LineLinked);

        var invite = await (await owner.PostAsync($"/api/employees/{employee.Id}/invites", null))
            .Content.ReadFromJsonAsync<EmployeeEndpoints.InviteResponse>(Json.Options);
        Assert.Contains($"code={invite!.Code}", invite.Url);

        var staff = factory.CreateClient();
        var preview = await staff.GetFromJsonAsync<LiffEndpoints.InvitePreview>($"/api/liff/invites/{invite.Code}", Json.Options);
        Assert.Equal("ร้านแพ็คไว", preview!.ShopName);

        var join = await staff.PostAsJsonAsync("/api/liff/join", new LiffEndpoints.JoinRequest(invite.Code, "dev:somchai:สมชาย"));
        Assert.Equal(HttpStatusCode.OK, join.StatusCode);

        var linked = await owner.GetFromJsonAsync<EmployeeEndpoints.EmployeeDto>($"/api/employees/{employee.Id}", Json.Options);
        Assert.True(linked!.LineLinked);

        // ลิงก์เชิญใช้ได้ครั้งเดียว
        var reuse = await staff.PostAsJsonAsync("/api/liff/join", new LiffEndpoints.JoinRequest(invite.Code, "dev:other:x"));
        Assert.Equal(HttpStatusCode.NotFound, reuse.StatusCode);
    }

    [Fact]
    public async Task Same_line_account_cannot_link_two_employees_in_one_shop()
    {
        var owner = await factory.RegisterShopAsync("ร้าน 2", $"owner-{Guid.NewGuid():N}@test.local");
        var codes = new List<string>();
        foreach (var name in new[] { "หนึ่ง", "สอง" })
        {
            var e = await (await owner.PostAsJsonAsync("/api/employees", Packer(name), Json.Options))
                .Content.ReadFromJsonAsync<EmployeeEndpoints.EmployeeDto>(Json.Options);
            var invite = await (await owner.PostAsync($"/api/employees/{e!.Id}/invites", null))
                .Content.ReadFromJsonAsync<EmployeeEndpoints.InviteResponse>(Json.Options);
            codes.Add(invite!.Code);
        }

        var staff = factory.CreateClient();
        Assert.Equal(HttpStatusCode.OK,
            (await staff.PostAsJsonAsync("/api/liff/join", new LiffEndpoints.JoinRequest(codes[0], "dev:same"))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await staff.PostAsJsonAsync("/api/liff/join", new LiffEndpoints.JoinRequest(codes[1], "dev:same"))).StatusCode);
    }

    [Fact]
    public async Task New_invite_revokes_previous_one()
    {
        var owner = await factory.RegisterShopAsync("ร้าน 3", $"owner-{Guid.NewGuid():N}@test.local");
        var e = await (await owner.PostAsJsonAsync("/api/employees", Packer("สาม"), Json.Options))
            .Content.ReadFromJsonAsync<EmployeeEndpoints.EmployeeDto>(Json.Options);

        var first = await (await owner.PostAsync($"/api/employees/{e!.Id}/invites", null))
            .Content.ReadFromJsonAsync<EmployeeEndpoints.InviteResponse>(Json.Options);
        await owner.PostAsync($"/api/employees/{e.Id}/invites", null);

        var staff = factory.CreateClient();
        Assert.Equal(HttpStatusCode.NotFound, (await staff.GetAsync($"/api/liff/invites/{first!.Code}")).StatusCode);
    }

    [Fact]
    public async Task Shops_cannot_see_each_others_employees()
    {
        var shopA = await factory.RegisterShopAsync("ร้าน A", $"a-{Guid.NewGuid():N}@test.local");
        var shopB = await factory.RegisterShopAsync("ร้าน B", $"b-{Guid.NewGuid():N}@test.local");

        var e = await (await shopA.PostAsJsonAsync("/api/employees", Packer("ของร้าน A"), Json.Options))
            .Content.ReadFromJsonAsync<EmployeeEndpoints.EmployeeDto>(Json.Options);

        Assert.Equal(HttpStatusCode.NotFound, (await shopB.GetAsync($"/api/employees/{e!.Id}")).StatusCode);
        var listB = await shopB.GetFromJsonAsync<List<EmployeeEndpoints.EmployeeDto>>("/api/employees", Json.Options);
        Assert.DoesNotContain(listB!, x => x.Id == e.Id);
    }

    [Fact]
    public async Task Endpoints_require_login()
    {
        var anonymous = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/employees")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/branches")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync("/health")).StatusCode);
    }

    [Fact]
    public async Task Login_rejects_wrong_password()
    {
        var email = $"login-{Guid.NewGuid():N}@test.local";
        await factory.RegisterShopAsync("ร้าน login", email);

        var client = factory.CreateClient();
        var ok = await client.PostAsJsonAsync("/api/auth/login", new AuthEndpoints.LoginRequest(email.ToUpperInvariant(), "password123", null));
        var bad = await client.PostAsJsonAsync("/api/auth/login", new AuthEndpoints.LoginRequest(email, "wrong-pass", null));

        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, bad.StatusCode);
    }
}
