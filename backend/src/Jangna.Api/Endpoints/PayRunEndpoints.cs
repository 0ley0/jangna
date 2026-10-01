using System.Security.Claims;
using Jangna.Api.Auth;
using Jangna.Api.PayRuns;
using Jangna.Core.Entities;
using Jangna.Infrastructure.Persistence;
using Jangna.Payroll.Engine.Model;
using Microsoft.EntityFrameworkCore;

namespace Jangna.Api.Endpoints;

public static class PayRunEndpoints
{
    public sealed record CreatePayRunRequest(DateOnly PeriodStart, DateOnly PeriodEnd);

    public sealed record PayRunSummary(
        Guid Id, DateOnly PeriodStart, DateOnly PeriodEnd, PayRunStatus Status, int Employees,
        decimal Gross, decimal Net, decimal SocialSecurityEmployer, int Warnings, DateTimeOffset CalculatedAt, DateTimeOffset? LockedAt);

    public sealed record PayRunItemDto(
        Guid Id, Guid EmployeeId, string EmployeeName, PayType PayType, bool IsFreelance,
        decimal Gross, decimal SocialSecurityEmployee, decimal SocialSecurityEmployer, decimal WithholdingTax,
        decimal AdvanceDeducted, decimal AdvanceCarriedOver, decimal Net,
        IReadOnlyList<PayLine> Lines, IReadOnlyList<string> Warnings);

    public sealed record PayRunDetail(PayRunSummary Summary, DateOnly RuleSetEffectiveFrom, IReadOnlyList<PayRunItemDto> Items);

    public static RouteGroupBuilder MapPayRunEndpoints(this RouteGroupBuilder api)
    {
        var runs = api.MapGroup("/pay-runs").RequireAuthorization(Policies.Manager);

        runs.MapGet("/", async (JangnaDbContext db, CancellationToken ct) =>
        {
            var list = await db.PayRuns.Include(r => r.Items).OrderByDescending(r => r.PeriodStart).ToListAsync(ct);
            return list.Select(Summary);
        });

        runs.MapGet("/{id:guid}", async (Guid id, JangnaDbContext db, CancellationToken ct) =>
            await db.PayRuns.Include(r => r.Items).SingleOrDefaultAsync(r => r.Id == id, ct) is { } run
                ? Results.Ok(Detail(run))
                : Results.NotFound());

        runs.MapPost("/", (CreatePayRunRequest req, PayRunService service, CancellationToken ct) =>
            Handle(async () => Results.Ok(Detail(await service.CreateAsync(req.PeriodStart, req.PeriodEnd, ct)))));

        runs.MapPost("/{id:guid}/recalculate", (Guid id, PayRunService service, CancellationToken ct) =>
            Handle(async () => Results.Ok(Detail(await service.RecalculateAsync(id, ct)))));

        runs.MapPost("/{id:guid}/lock", (Guid id, ClaimsPrincipal user, PayRunService service, CancellationToken ct) =>
            Handle(async () => Results.Ok(Detail(await service.LockAsync(id, user.UserId(), ct)))))
            .RequireAuthorization(Policies.Owner);

        runs.MapDelete("/{id:guid}", (Guid id, PayRunService service, CancellationToken ct) =>
            Handle(async () =>
            {
                await service.DeleteDraftAsync(id, ct);
                return Results.NoContent();
            }));

        return api;
    }

    private static async Task<IResult> Handle(Func<Task<IResult>> action)
    {
        try
        {
            return await action();
        }
        catch (PayRunException e)
        {
            return Results.Problem(e.Message, statusCode: e.Status);
        }
    }

    private static PayRunSummary Summary(PayRun r) =>
        new(r.Id, r.PeriodStart, r.PeriodEnd, r.Status, r.Items.Count,
            r.Items.Sum(i => i.Gross), r.Items.Sum(i => i.Net), r.Items.Sum(i => i.SocialSecurityEmployer),
            r.Items.Sum(i => i.Warnings.Count), r.CalculatedAt, r.LockedAt);

    private static PayRunDetail Detail(PayRun r) =>
        new(Summary(r), r.RuleSetEffectiveFrom,
            r.Items.OrderBy(i => i.EmployeeName).Select(i => new PayRunItemDto(
                i.Id, i.EmployeeId, i.EmployeeName, i.PayType, i.IsFreelance,
                i.Gross, i.SocialSecurityEmployee, i.SocialSecurityEmployer, i.WithholdingTax,
                i.AdvanceDeducted, i.AdvanceCarriedOver, i.Net, i.Lines, i.Warnings)).ToList());
}
