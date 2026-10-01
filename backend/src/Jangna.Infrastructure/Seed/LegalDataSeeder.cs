using System.Text.Json;
using Jangna.Core.Entities;
using Jangna.Infrastructure.Persistence;
using Jangna.Payroll.Engine.Rules;
using Microsoft.EntityFrameworkCore;

namespace Jangna.Infrastructure.Seed;

/// <summary>ใส่ข้อมูลกฎหมายตั้งต้น (idempotent — ข้ามถ้ามีข้อมูลแล้ว)</summary>
public static class LegalDataSeeder
{
    private static readonly WorkingTimeRule WorkingTime = new(MaxHoursPerDay: 8, MaxHoursPerWeek: 48);

    private static readonly OvertimeRule Overtime = new(
        WorkdayOvertime: 1.5m,
        HolidayWorkMonthlyPaid: 1m,
        HolidayWorkNonMonthlyPaid: 2m,
        HolidayOvertime: 3m);

    private static LegalRules WithSso(decimal maxBase) => new()
    {
        SocialSecurity = new SocialSecurityRule(Rate: 0.05m, MinMonthlyBase: 1650m, MaxMonthlyBase: maxBase),
        WorkingTime = WorkingTime,
        Overtime = Overtime,
    };

    public static IReadOnlyList<LegalRuleSet> RuleSets() =>
    [
        new() { EffectiveFrom = new(2000, 1, 1), Payload = WithSso(15000m), Source = "ฐาน สปส. เดิม 15,000 (ก่อนปี 2026)" },
        new() { EffectiveFrom = new(2026, 1, 1), Payload = WithSso(17500m), Source = "ขยายฐาน สปส. ระยะที่ 1 (2026–2028)" },
        new() { EffectiveFrom = new(2029, 1, 1), Payload = WithSso(20000m), Source = "ขยายฐาน สปส. ระยะที่ 2 (2029–2031) ตามแผน" },
        new() { EffectiveFrom = new(2032, 1, 1), Payload = WithSso(23000m), Source = "ขยายฐาน สปส. ระยะที่ 3 (2032–) ตามแผน" },
    ];

    public static async Task SeedAsync(JangnaDbContext db, string minimumWageJsonPath, CancellationToken ct = default)
    {
        if (!await db.LegalRuleSets.AnyAsync(ct))
        {
            db.LegalRuleSets.AddRange(RuleSets());
        }

        if (!await db.MinimumWages.AnyAsync(ct) && File.Exists(minimumWageJsonPath))
        {
            db.MinimumWages.AddRange(LoadMinimumWages(await File.ReadAllTextAsync(minimumWageJsonPath, ct)));
        }

        await db.SaveChangesAsync(ct);
    }

    public static IEnumerable<MinimumWage> LoadMinimumWages(string json)
    {
        var file = JsonSerializer.Deserialize<MinimumWageFile>(json, new JsonSerializerOptions(JsonSerializerDefaults.Web))
                   ?? throw new InvalidDataException("minimum wage seed ว่าง");

        foreach (var tier in file.Tiers)
        foreach (var province in tier.Provinces)
        {
            yield return new MinimumWage
            {
                ProvinceCode = province, DailyRate = tier.Rate, EffectiveFrom = file.EffectiveFrom,
                Verified = file.Verified, Source = file.Source,
            };
        }

        foreach (var area in file.Areas)
        {
            yield return new MinimumWage
            {
                ProvinceCode = area.Province, AreaCode = area.Area, DailyRate = area.Rate,
                EffectiveFrom = file.EffectiveFrom, Verified = file.Verified, Source = file.Source,
            };
        }
    }

    private sealed record MinimumWageFile(
        string Source, DateOnly EffectiveFrom, bool Verified, List<Tier> Tiers, List<AreaRate> Areas);

    private sealed record Tier(decimal Rate, List<string> Provinces);

    private sealed record AreaRate(string Province, string Area, string Name, decimal Rate);
}
