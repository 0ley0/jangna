using Jangna.Infrastructure.Persistence;
using Jangna.Payroll.Engine.Rules;
using Microsoft.EntityFrameworkCore;

namespace Jangna.Api.Endpoints;

public static class LegalEndpoints
{
    public static RouteGroupBuilder MapLegalEndpoints(this RouteGroupBuilder api)
    {
        var legal = api.MapGroup("/legal");

        legal.MapGet("/rules", async (DateOnly? date, JangnaDbContext db, TimeProvider clock, CancellationToken ct) =>
        {
            var at = date ?? DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
            var sets = await db.LegalRuleSets.AsNoTracking().ToListAsync(ct);
            var resolved = RuleResolver.Resolve(sets.Select(s => new EffectiveRuleSet(s.EffectiveFrom, s.Payload)), at);
            return Results.Ok(resolved);
        });

        legal.MapGet("/minimum-wage", async (string province, string? area, DateOnly? date, JangnaDbContext db,
            TimeProvider clock, CancellationToken ct) =>
        {
            var at = date ?? DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
            var rates = await db.MinimumWages.AsNoTracking().Where(m => m.ProvinceCode == province).ToListAsync(ct);
            var rate = RuleResolver.ResolveMinimumWage(rates.Select(r => r.ToRate()), province, area, at);
            return rate is null ? Results.NotFound() : Results.Ok(rate);
        });

        return api;
    }
}
