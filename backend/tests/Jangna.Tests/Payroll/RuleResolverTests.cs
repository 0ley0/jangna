using Jangna.Infrastructure.Seed;
using Jangna.Payroll.Engine.Rules;

namespace Jangna.Tests.Payroll;

public class RuleResolverTests
{
    private static readonly IReadOnlyList<EffectiveRuleSet> Seeded =
        LegalDataSeeder.RuleSets().Select(r => new EffectiveRuleSet(r.EffectiveFrom, r.Payload)).ToList();

    [Theory]
    [InlineData("2025-12-31", 15000)]
    [InlineData("2026-01-01", 17500)]
    [InlineData("2028-12-31", 17500)]
    [InlineData("2029-01-01", 20000)]
    [InlineData("2035-06-15", 23000)]
    public void Picks_latest_rule_set_in_effect(string date, decimal expectedMaxBase)
    {
        var resolved = RuleResolver.Resolve(Seeded, DateOnly.Parse(date));
        Assert.Equal(expectedMaxBase, resolved.Rules.SocialSecurity.MaxMonthlyBase);
    }

    [Fact]
    public void Throws_when_no_rule_set_in_effect() =>
        Assert.Throws<InvalidOperationException>(() => RuleResolver.Resolve(Seeded, new DateOnly(1999, 1, 1)));

    [Fact]
    public void Area_rate_wins_over_province_rate()
    {
        var from = new DateOnly(2025, 7, 1);
        MinimumWageRate[] rates =
        [
            new("TH-90", null, 352m, from, false),
            new("TH-90", "9011", 380m, from, false),
        ];

        Assert.Equal(380m, RuleResolver.ResolveMinimumWage(rates, "TH-90", "9011", from)!.DailyRate);
        Assert.Equal(352m, RuleResolver.ResolveMinimumWage(rates, "TH-90", "9001", from)!.DailyRate);
        Assert.Equal(352m, RuleResolver.ResolveMinimumWage(rates, "TH-90", null, from)!.DailyRate);
        Assert.Null(RuleResolver.ResolveMinimumWage(rates, "TH-90", null, from.AddDays(-1)));
        Assert.Null(RuleResolver.ResolveMinimumWage(rates, "TH-10", null, from));
    }

    [Fact]
    public void Newer_minimum_wage_replaces_older()
    {
        MinimumWageRate[] rates =
        [
            new("TH-10", null, 363m, new(2024, 1, 1), true),
            new("TH-10", null, 400m, new(2025, 7, 1), true),
        ];

        Assert.Equal(363m, RuleResolver.ResolveMinimumWage(rates, "TH-10", null, new(2025, 6, 30))!.DailyRate);
        Assert.Equal(400m, RuleResolver.ResolveMinimumWage(rates, "TH-10", null, new(2025, 7, 1))!.DailyRate);
    }
}
