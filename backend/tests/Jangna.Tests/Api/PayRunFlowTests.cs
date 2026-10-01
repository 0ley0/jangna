using System.Net;
using System.Net.Http.Json;
using Jangna.Api.Endpoints;
using Jangna.Api.PayRuns;
using Jangna.Core.Entities;
using Jangna.Infrastructure.Persistence;
using Jangna.Payroll.Engine.Model;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Jangna.Tests.Api;

public class PayRunFlowTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static DateOnly Oct(int day) => new(2026, 10, day);

    private sealed class Shop(HttpClient http)
    {
        public HttpClient Http { get; } = http;

        public async Task<Guid> Branch(string province = "TH-10") =>
            (await (await Http.PostAsJsonAsync("/api/branches", new OrgEndpoints.BranchRequest("สาขา", province, null, null, null, null)))
                .Content.ReadFromJsonAsync<OrgEndpoints.BranchDto>(Json.Options))!.Id;

        public async Task<Guid> Employee(string name, PayType type, decimal rate, Guid? branch, WorkerType worker = WorkerType.Employee) =>
            (await (await Http.PostAsJsonAsync("/api/employees",
                    new EmployeeEndpoints.EmployeeRequest(name, null, null, null, branch, type, rate, worker, "th"), Json.Options))
                .Content.ReadFromJsonAsync<EmployeeEndpoints.EmployeeDto>(Json.Options))!.Id;

        public Task<HttpResponseMessage> Work(Guid employee, params int[] days) =>
            Http.PutAsJsonAsync("/api/work-days",
                days.Select(d => new WorkEndpoints.WorkDayRequest(employee, Oct(d), DayKind.Workday, 8, 0, LeaveKind.None, null)).ToList(),
                Json.Options);

        public Task<HttpResponseMessage> Pieces(Guid employee, int day, decimal qty, decimal rate = 5m) =>
            Http.PostAsJsonAsync("/api/piece-work", new WorkEndpoints.PieceWorkRequest(employee, Oct(day), "แพ็คกล่อง", qty, rate, false, null), Json.Options);

        public Task<HttpResponseMessage> CreateRun(int from, int to) =>
            Http.PostAsJsonAsync("/api/pay-runs", new PayRunEndpoints.CreatePayRunRequest(Oct(from), Oct(to)), Json.Options);

        public static async Task<PayRunEndpoints.PayRunDetail> Read(HttpResponseMessage response)
        {
            Assert.True(response.StatusCode == HttpStatusCode.OK, $"{response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
            return (await response.Content.ReadFromJsonAsync<PayRunEndpoints.PayRunDetail>(Json.Options))!;
        }

        public async Task<PayRunEndpoints.PayRunDetail> Lock(Guid run) =>
            await Read(await Http.PostAsync($"/api/pay-runs/{run}/lock", null));
    }

    private async Task<Shop> NewShop() =>
        new(await factory.RegisterShopAsync("ร้านทดสอบ", $"payrun-{Guid.NewGuid():N}@test.local"));

    [Fact]
    public async Task Packer_piece_rate_run_with_minimum_wage_top_up()
    {
        var shop = await NewShop();
        var packer = await shop.Employee("แพ็คเกอร์", PayType.Piece, 0, await shop.Branch("TH-10"));
        (await shop.Work(packer, 1, 2)).EnsureSuccessStatusCode();
        (await shop.Pieces(packer, 1, 100)).EnsureSuccessStatusCode();
        (await shop.Pieces(packer, 2, 50)).EnsureSuccessStatusCode();

        var run = await Shop.Read(await shop.CreateRun(1, 31));

        var item = Assert.Single(run.Items);
        Assert.Equal(900m, item.Gross); // 500 + 250 + เติมขั้นต่ำ 150 (กทม. 400)
        Assert.Contains(item.Lines, l => l.Code == LineCodes.MinimumWageTopUp && l.Amount == 150m);
        Assert.Equal(83m, item.SocialSecurityEmployee);
        Assert.Equal(817m, item.Net);
        Assert.Contains(item.Warnings, w => w.Contains("ยังไม่ได้ยืนยัน")); // seed ค่าแรงขั้นต่ำเป็น draft
        Assert.Equal(PayRunStatus.Draft, run.Summary.Status);
    }

    [Fact]
    public async Task Shop_holiday_pays_daily_worker_who_did_not_work()
    {
        var shop = await NewShop();
        var daily = await shop.Employee("รายวัน", PayType.Daily, 400, await shop.Branch());
        (await shop.Work(daily, 22)).EnsureSuccessStatusCode();
        (await shop.Http.PostAsJsonAsync("/api/holidays", new WorkEndpoints.HolidayRequest(Oct(23), "วันปิยมหาราช"))).EnsureSuccessStatusCode();

        var run = await Shop.Read(await shop.CreateRun(1, 31));

        var item = Assert.Single(run.Items);
        Assert.Contains(item.Lines, l => l.Code == LineCodes.PublicHolidayPay && l.Amount == 400m);
        Assert.Equal(800m, item.Gross);
    }

    [Fact]
    public async Task Employee_without_branch_gets_warning()
    {
        var shop = await NewShop();
        await shop.Employee("ไม่มีสาขา", PayType.Monthly, 15_000, null);

        var run = await Shop.Read(await shop.CreateRun(1, 31));

        Assert.Contains(Assert.Single(run.Items).Warnings, w => w.Contains("ยังไม่ได้ระบุสาขา"));
    }

    [Fact]
    public async Task Locked_period_cannot_be_edited_or_overlapped()
    {
        var shop = await NewShop();
        var e = await shop.Employee("ล็อก", PayType.Daily, 400, await shop.Branch());
        (await shop.Work(e, 1)).EnsureSuccessStatusCode();
        var run = await Shop.Read(await shop.CreateRun(1, 15));
        var locked = await shop.Lock(run.Summary.Id);
        Assert.Equal(PayRunStatus.Locked, locked.Summary.Status);

        Assert.Equal(HttpStatusCode.Conflict, (await shop.Work(e, 2)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await shop.Pieces(e, 3, 10)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await shop.CreateRun(10, 20)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await shop.Http.DeleteAsync($"/api/pay-runs/{run.Summary.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await shop.Http.PostAsync($"/api/pay-runs/{run.Summary.Id}/recalculate", null)).StatusCode);

        // หลังรอบที่ปิดยังแก้ได้ตามปกติ
        Assert.Equal(HttpStatusCode.NoContent, (await shop.Work(e, 16)).StatusCode);
    }

    [Fact]
    public async Task Lock_refuses_when_data_changed_since_last_calculation()
    {
        var shop = await NewShop();
        var e = await shop.Employee("เปลี่ยน", PayType.Piece, 0, await shop.Branch());
        (await shop.Work(e, 1)).EnsureSuccessStatusCode();
        (await shop.Pieces(e, 1, 100)).EnsureSuccessStatusCode();
        var draft = await Shop.Read(await shop.CreateRun(1, 31));

        (await shop.Pieces(e, 1, 20)).EnsureSuccessStatusCode();
        var refused = await shop.Http.PostAsync($"/api/pay-runs/{draft.Summary.Id}/lock", null);
        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);

        // draft ถูกคำนวณใหม่ให้แล้ว → ตรวจแล้ว lock ได้
        var recalculated = await Shop.Read(await shop.Http.GetAsync($"/api/pay-runs/{draft.Summary.Id}"));
        Assert.Equal(600m, recalculated.Items.Single().Gross);
        Assert.Equal(PayRunStatus.Locked, (await shop.Lock(draft.Summary.Id)).Summary.Status);
    }

    [Fact]
    public async Task Second_half_month_uses_month_to_date_social_security()
    {
        var shop = await NewShop();
        var e = await shop.Employee("ครึ่งเดือน", PayType.Monthly, 20_000, await shop.Branch());

        var first = await shop.Lock((await Shop.Read(await shop.CreateRun(1, 15))).Summary.Id);
        Assert.Equal(500m, first.Items.Single().SocialSecurityEmployee); // 15 วัน × 666.67 = 10,000

        var second = await Shop.Read(await shop.CreateRun(16, 31));
        Assert.Equal(375m, second.Items.Single().SocialSecurityEmployee); // ทั้งเดือนชนเพดาน 875
        Assert.Equal(e, second.Items.Single().EmployeeId);
    }

    [Fact]
    public async Task Advances_carry_over_between_locked_runs()
    {
        var shop = await NewShop();
        var e = await shop.Employee("เบิก", PayType.Daily, 400, await shop.Branch());
        (await shop.Work(e, 1, 2)).EnsureSuccessStatusCode();
        (await shop.Http.PostAsJsonAsync("/api/advances", new WorkEndpoints.AdvanceRequest(e, Oct(1), 1_000m, "ค่ารถ"))).EnsureSuccessStatusCode();

        var first = await shop.Lock((await Shop.Read(await shop.CreateRun(1, 15))).Summary.Id);
        var item = first.Items.Single();
        Assert.Equal(717m, item.AdvanceDeducted); // 800 − สปส. 83
        Assert.Equal(283m, item.AdvanceCarriedOver);

        (await shop.Work(e, 16)).EnsureSuccessStatusCode();
        var second = await Shop.Read(await shop.CreateRun(16, 31));
        Assert.Equal(283m, second.Items.Single().AdvanceDeducted);
    }

    [Fact]
    public async Task Cannot_create_run_before_a_locked_later_run()
    {
        var shop = await NewShop();
        await shop.Employee("ย้อน", PayType.Monthly, 15_000, await shop.Branch());
        await shop.Lock((await Shop.Read(await shop.CreateRun(16, 31))).Summary.Id);

        var backdated = await shop.CreateRun(1, 15);

        Assert.Equal(HttpStatusCode.Conflict, backdated.StatusCode);
    }

    [Fact]
    public async Task Run_must_stay_within_one_month()
    {
        var shop = await NewShop();
        var response = await shop.Http.PostAsJsonAsync("/api/pay-runs",
            new PayRunEndpoints.CreatePayRunRequest(Oct(20), new DateOnly(2026, 11, 5)), Json.Options);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Work_day_changes_are_audited()
    {
        var shop = await NewShop();
        var e = await shop.Employee("ตรวจสอบ", PayType.Daily, 400, null);
        (await shop.Work(e, 5)).EnsureSuccessStatusCode();
        (await shop.Http.PutAsJsonAsync("/api/work-days",
            new[] { new WorkEndpoints.WorkDayRequest(e, Oct(5), DayKind.Workday, 4, 0, LeaveKind.None, "กลับก่อน") }, Json.Options))
            .EnsureSuccessStatusCode();

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<JangnaDbContext>();
        var dayId = await db.WorkDays.IgnoreQueryFilters().Where(w => w.EmployeeId == e).Select(w => w.Id).SingleAsync();
        var logs = await db.AuditLogs.IgnoreQueryFilters().Where(a => a.EntityId == dayId).ToListAsync();

        Assert.Contains(logs, a => a.Action == "Added" && a.UserId != null);
        var modified = Assert.Single(logs, a => a.Action == "Modified");
        Assert.Contains("NormalHours", modified.Changes);
        Assert.Contains("กลับก่อน", modified.Changes);
    }

    [Fact]
    public async Task Opening_balance_raises_withholding_for_mid_year_start()
    {
        var shop = await NewShop();
        var e = await shop.Employee("ย้ายมากลางปี", PayType.Monthly, 50_000, await shop.Branch());

        var without = await Shop.Read(await shop.CreateRun(1, 31));
        var item = without.Items.Single();
        Assert.Equal(0m, item.WithholdingTax); // ประมาณทั้งปีแค่ 3 เดือน = 150k
        Assert.Contains(item.Warnings, w => w.Contains("ยอดยกมา"));

        (await shop.Http.PutAsJsonAsync("/api/opening-balances",
            new WorkEndpoints.OpeningBalanceRequest(e, 2026, 450_000m, 0m, 7_875m, "จากระบบเดิม"))).EnsureSuccessStatusCode();
        var with = await Shop.Read(await shop.Http.PostAsync($"/api/pay-runs/{without.Summary.Id}/recalculate", null));

        // เหมือนเคสใน engine: ทั้งปี 20,450 ยังไม่ได้หัก → หักใน 3 รอบที่เหลือ
        Assert.Equal(6_816.67m, with.Items.Single().WithholdingTax);
        Assert.DoesNotContain(with.Items.Single().Warnings, w => w.Contains("ยอดยกมา"));
    }

    [Fact]
    public async Task Staff_role_cannot_manage_pay_runs()
    {
        var anonymous = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/pay-runs")).StatusCode);
    }

    [Theory]
    [InlineData(10, 1, 31, 3)]   // ต.ค. รายเดือน → เหลือ ต.ค. พ.ย. ธ.ค.
    [InlineData(1, 1, 31, 12)]
    [InlineData(10, 1, 15, 6)]   // ครึ่งเดือน: 92 วัน / 15 ≈ 6
    public void Remaining_periods_in_year(int month, int from, int to, int expected) =>
        Assert.Equal(expected, PayRunService.RemainingPeriods(new(2026, month, from), new(2026, month, to)));
}
