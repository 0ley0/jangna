namespace Jangna.Payroll.Engine.Rules;

public static class RuleResolver
{
    /// <summary>เลือก rule set ล่าสุดที่มีผลแล้ว ณ วันที่ <paramref name="date"/></summary>
    public static EffectiveRuleSet Resolve(IEnumerable<EffectiveRuleSet> ruleSets, DateOnly date) =>
        ruleSets
            .Where(r => r.EffectiveFrom <= date)
            .MaxBy(r => r.EffectiveFrom)
        ?? throw new InvalidOperationException($"ไม่มี legal rule set ที่มีผล ณ วันที่ {date:yyyy-MM-dd}");

    /// <summary>
    /// หาค่าแรงขั้นต่ำ ณ วันที่ — อัตราของพื้นที่ (AreaCode) ชนะอัตราทั้งจังหวัด
    /// คืน null ถ้าไม่มีข้อมูลจังหวัดนั้น
    /// </summary>
    public static MinimumWageRate? ResolveMinimumWage(
        IEnumerable<MinimumWageRate> rates, string provinceCode, string? areaCode, DateOnly date)
    {
        var candidates = rates
            .Where(r => r.ProvinceCode == provinceCode && r.EffectiveFrom <= date)
            .ToList();

        if (areaCode is not null)
        {
            var area = candidates.Where(r => r.AreaCode == areaCode).MaxBy(r => r.EffectiveFrom);
            if (area is not null) return area;
        }

        return candidates.Where(r => r.AreaCode is null).MaxBy(r => r.EffectiveFrom);
    }
}
